/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import {
    ContextManager,
    Http,
    Manifest,
    MemoryServiceContextStore,
    ServiceContextStatus,
    ServiceContextStore,
    ServiceDefinition,
    ServiceDefinitionOptions,
    ServiceUriResolver
} from "@asmv/core";
import { createEventEmitter, emitEvent, onceEvent, removeAllEventListeners } from "@asmv/utils";
import * as koa from "koa";
import Router from "@koa/router";
import { v4 as uuid_v4 } from "uuid";

import { HttpCommandDefinition } from "./Command";
import { DefaultHttpServiceContext, HttpServiceContext, HttpServiceContextConstructor } from "./HttpServiceContext";
import { RouterKoaContext, sendMessageToClient } from "../Shared/ProtocolHelpers";
import { createServiceRouter, getCommandInvokeUrl, getServiceChannelUrl, ServiceRoutingSchema } from "./ServiceRouter";
import { ServiceChannel } from "./Channel";

/**
 * Service options
 */
export interface ServiceOptions<ServiceContext extends DefaultHttpServiceContext> extends ServiceDefinitionOptions {
    baseUrl: string;
    pathPrefix?: string;
    contextConstructor: HttpServiceContextConstructor<ServiceContext>;
    routingSchema: ServiceRoutingSchema;
    userActionTimeout?: number;
    serviceContextStore?: ServiceContextStore;
    commands: HttpCommandDefinition<ServiceContext>[];
}

type RouterMiddlewareFromContext<ServiceContext extends DefaultHttpServiceContext> = 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ServiceContext extends HttpServiceContext<infer _State, infer KoaContext>
        ? KoaContext extends koa.ParameterizedContext<infer KoaStateT, infer KoaContextT>
            ? Router.Middleware<KoaStateT, KoaContextT>
            : never
        : never;

/**
 * Service definition
 */
export class HttpService<ServiceContext extends DefaultHttpServiceContext> extends ServiceDefinition {
    public readonly baseUrl: string;
    public readonly pathPrefix: string;

    public readonly contextConstructor: HttpServiceContextConstructor<ServiceContext>;
    public readonly userActionTimeout: number;
    public readonly routingSchema: ServiceRoutingSchema;

    private serviceContextStore: ServiceContextStore;
    private contextManager: ContextManager<ServiceContext> = new ContextManager<ServiceContext>();

    protected override commands: Map<string, HttpCommandDefinition<ServiceContext>> = new Map();
    public readonly middlewares: RouterMiddlewareFromContext<ServiceContext>[] = [];

    public readonly onContextCreated = createEventEmitter<ServiceContext>();
    public readonly onContextDisposed = createEventEmitter<ServiceContext>();
    public readonly onError = createEventEmitter<unknown>();

    public constructor(options: ServiceOptions<ServiceContext>) {
        super(options);

        this.baseUrl = options.baseUrl;
        this.pathPrefix = options.pathPrefix ?? "";
        this.contextConstructor = options.contextConstructor;
        this.userActionTimeout = options.userActionTimeout || 300;
        this.routingSchema = options.routingSchema;
        this.serviceContextStore = options.serviceContextStore ?? new MemoryServiceContextStore();

        for (const command of options.commands ?? []) {
            this.addCommand(command);
        }
    }

    /**
     * Adds command to the service
     *
     * @param command Command definition
     */
    public override addCommand(command: HttpCommandDefinition<ServiceContext>): void {
        super.addCommand(command);
    }

    /**
     * Returns command definition
     *
     * @param commandName Command name
     * @returns Command definition or undefined if command is not defined
     */
    public getCommand(commandName: string): HttpCommandDefinition<ServiceContext>|undefined {
        return this.commands.get(commandName);
    }

    /**
     * Returns service manifest
     *
     * @returns Service manifest
     */
    public override getManifest(): Manifest.ServiceManifest {
        const uriResolver: ServiceUriResolver = {
            getBaseUri: () => this.baseUrl,
            getCommandEndpointUri: (commandName: string) => getCommandInvokeUrl(this.routingSchema, this.baseUrl, commandName)
        };

        return super.getManifest(uriResolver);
    }

    /**
     * Adds router middleware
     * Middleware will be executed before any service routes
     *
     * @param middlewares Middleware functions
     */
    public use(...middlewares: RouterMiddlewareFromContext<ServiceContext>[]): void {
        this.middlewares.push(...middlewares);
    }

    /**
     * Returns koa router for the service
     *
     * @returns Koa router
     */
    public getRouter(): Router {
        return createServiceRouter<ServiceContext>(this);
    }

    /**
     * Creates context and channel
     *
     * @param clientChannel Client channel
     * @param koaContext Koa context
     * @param commandName Command name
     */
    public createContext(clientChannel: Http.ClientChannel, koaContext: RouterKoaContext, commandName: string): ServiceContext {
        const commandDef = this.commands.get(commandName);
        
        if (!commandDef) {
            throw new Error(`Command '${commandName}' is not defined in service.`);
        }

        const serviceChannelId = uuid_v4();
        const serviceChannelToken = uuid_v4();

        const httpChannel: ServiceChannel = {
            commandName: commandName,
            clientChannelUrl: clientChannel.clientChannelUrl,
            clientChannelToken: clientChannel.clientChannelToken,
            clientChannelId: clientChannel.clientChannelId,
            serviceChannelUrl: getServiceChannelUrl(this.routingSchema, this.baseUrl, serviceChannelId),
            serviceChannelId: serviceChannelId,
            serviceChannelToken: serviceChannelToken,
            protocolVersion: koaContext.asmvVersion
        };

        const serviceContext = new this.contextConstructor(
            sendMessageToClient,
            {
                validateReturnTypes: true
            },
            commandDef,
            koaContext,
            httpChannel
        );

        this.handleContextCreated(serviceContext);

        return serviceContext;
    }

    /**
     * Returns context by service channel ID or undefined if context is not found
     *
     * @param serviceChannelId Service channel ID
     * @returns Service context or undefined if context is not found
     */
    public getLocalContext(serviceChannelId: string): ServiceContext|undefined {
        return this.contextManager.get(serviceChannelId);
    }

    /**
     * Stores serialized context state to the store and disposes context instance
     * WARNING: Context is not usable after this operation
     *
     * @param serviceContext Service context
     */
    public storeAndDisposeContext(serviceContext: ServiceContext): Promise<void> {
        const channel = serviceContext.channel;
        const serializedState = serviceContext.serialize();

        this.contextManager.remove(channel.serviceChannelId);
        serviceContext.dispose();

        return this.serviceContextStore.store(channel.serviceChannelId, channel, serializedState);
    }

    /**
     * Restores context from store
     *
     * @param serviceChannelId Service channel ID
     * @param koaContext Koajs context
     * @returns Service context or undefined if context is not found
     */
    public async restoreContext(serviceChannelId: string, koaContext?: RouterKoaContext): Promise<ServiceContext|undefined> {
        // Get data from store
        const data = await this.serviceContextStore.get(serviceChannelId);

        if (!data) {
            return undefined;
        }

        const channel = data.channel as ServiceChannel;
        const state = data.state;
        const commandDef = this.commands.get(channel.commandName);
        
        if (!commandDef) {
            throw new Error(`Command '${channel.commandName}' is not defined in service.`);
        }

        const serviceContext = new this.contextConstructor(
            sendMessageToClient,
            {
                validateReturnTypes: true
            },
            commandDef,
            koaContext,
            channel,
            {
                ...state,
                // Activate the context again if it was suspended
                status: state.status == ServiceContextStatus.Suspended
                    ? ServiceContextStatus.Active
                    : state.status
            }
        );

        this.handleContextCreated(serviceContext);

        return serviceContext;
    }

    /**
     * Deletes context both from memory and from store and disposes context instance
     * WARNING: Context is not usable after this operation
     *
     * @param serviceChannelId Service channel ID
     */
    public deleteAndDisposeContext(serviceChannelId: string): void {
        const context = this.contextManager.get(serviceChannelId);

        this.contextManager.remove(serviceChannelId);
        this.serviceContextStore.delete(serviceChannelId).catch((err) => {
            emitEvent(this.onError, err);
        });
        
        context?.dispose();
    }

    /**
     * Called when context is created
     *
     * @param serviceContext Service context
     */
    private handleContextCreated(serviceContext: ServiceContext): void {
        const serviceChannelId = serviceContext.channel.serviceChannelId;

        onceEvent(serviceContext.onCancel, () => {
            this.deleteAndDisposeContext(serviceChannelId);
        });

        onceEvent(serviceContext.onDispose, () => {
            this.handleContextDisposed(serviceContext);
        });

        this.contextManager.add(serviceChannelId, serviceContext);

        try {
            emitEvent(this.onContextCreated, serviceContext);
        } catch (err) {
            emitEvent(this.onError, err);
        }
    }

    /**
     * Called when context is disposed
     *
     * @param serviceContext Disposed service context
     */
    private handleContextDisposed(serviceContext: ServiceContext): void {
        try {
            emitEvent(this.onContextDisposed, serviceContext);
        } catch (err) {
            emitEvent(this.onError, err);
        }
    }

    /**
     * Disposes service inc. all contexts
     */
    public dispose(): void {
        this.contextManager.getAll().forEach((context) => context.dispose());
        this.contextManager.dispose();

        removeAllEventListeners(this.onContextCreated);
        removeAllEventListeners(this.onContextDisposed);
        removeAllEventListeners(this.onError);
    }
}
