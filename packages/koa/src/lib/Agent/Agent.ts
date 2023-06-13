/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import {
    ClientContext,
    ContextManager,
    Http,
    HttpErrors,
    Message} from "@asmv/core";
import { createEventEmitter, emitEvent, onceEvent } from "@asmv/utils";
import { DefaultContext } from "koa";
import Router from "@koa/router";
import { v4 as uuid_v4 } from "uuid";

import { sendInvokeMessageToService, sendMessageToService } from "../Shared/ProtocolHelpers";
import { AgentRoutingSchema, createAgentRouter, getAgentChannelUrl } from "./AgentRouter";

export interface AgentOptions {
    baseUrl: string;
    pathPrefix?: string;
    routingSchema: AgentRoutingSchema;
    asmvVersion?: "1.0.0";
}

export class Agent {
    public readonly baseUrl: string;
    public readonly pathPrefix: string;
    public readonly routingSchema: AgentRoutingSchema;
    public readonly asmvVersion: string;
    
    public readonly middlewares: Router.Middleware<DefaultContext>[] = [];

    private contextManager: ContextManager<ClientContext<Http.Channel>> = new ContextManager<ClientContext<Http.Channel>>();

    public readonly onContextCreated = createEventEmitter<ClientContext<Http.Channel>>();
    public readonly onContextDisposed = createEventEmitter<ClientContext<Http.Channel>>();
    public readonly onError = createEventEmitter<unknown>();

    public constructor(options: AgentOptions) {
        this.baseUrl = options.baseUrl;
        this.pathPrefix = options.pathPrefix || "";
        this.routingSchema = options.routingSchema;
        this.asmvVersion = options.asmvVersion || "1.0.0";
    }

    /**
     * Adds router middleware
     * Middleware will be executed before any agent routes
     *
     * @param middlewares Middleware functions
     */
    public use(...middlewares: Router.Middleware<DefaultContext>[]): void {
        this.middlewares.push(...middlewares);
    }

    /**
     * Returns koa router for the service
     *
     * @returns Koa router
     */
    public getRouter(): Router {
        return createAgentRouter(this);
    }

    /**
     * Invokes service command and returns client context
     * NOTICE: Don't forget to dispose the context after use! (context.dispose())
     *
     * @param endpointUrl Command endpoint URL
     * @param configProfiles Config profiles
     * @param inputs Inputs
     * @param userConfirmation Optional user confirmation
     * @returns Client context
     */
    public async invoke(
        endpointUrl: string,
        configProfiles: Message.ConfigProfiles,
        inputs: Message.CommandInputList,
        userConfirmation?: Message.UserConfirmation
    ) {
        // Prepare client channel
        const clientChannelId = uuid_v4();
        const clientChannelToken = uuid_v4();
        const clientChannelUrl = getAgentChannelUrl(this.routingSchema, this.baseUrl, clientChannelId);

        const channel: Http.Channel = {
            protocolVersion: this.asmvVersion,
            clientChannelUrl: clientChannelUrl,
            clientChannelToken: clientChannelToken,
            clientChannelId: clientChannelId,
            serviceChannelUrl: "",
            serviceChannelToken: "",
            serviceChannelId: ""
        }

        // Create context
        const clientContext = new ClientContext(
            sendMessageToService,
            {},
            channel
        );

        this.handleContextCreated(clientContext);

        try {
            // Invoke command
            const res = await sendInvokeMessageToService(channel, this.asmvVersion, endpointUrl, {
                messageType: Message.MessageType.Invoke,
                configProfiles: configProfiles,
                inputs: inputs,
                userConfirmation: userConfirmation
            });

            // Check response
            if (res.status !== 204) {
                const error = HttpErrors.HttpTransportError.fromBody(res.data);
                throw error;
            }

            // Update channel
            channel.serviceChannelUrl = res.headers["x-asmv-service-channel-url"];
            channel.serviceChannelId = res.headers["x-asmv-service-channel-id"];
            channel.serviceChannelToken = res.headers["x-asmv-service-channel-token"];

            return clientContext;
        } catch (err) {
            clientContext.dispose();
            throw err;
        }
    }

    /**
     * Returns client context by channel ID
     *
     * @param clientChannelId Client channel ID
     * @returns Client context or undefined if not found
     */
    public getClientContext(clientChannelId: string): ClientContext<Http.Channel> | undefined {
        return this.contextManager.get(clientChannelId);
    }

    /**
     * Called when new context is created
     *
     * @param clientContext Client context
     */
    public handleContextCreated(clientContext: ClientContext<Http.Channel>) {
        const clientChannelId = clientContext.channel.clientChannelId;

        onceEvent(clientContext.onDispose, () => {
            this.contextManager.remove(clientChannelId);
        });

        onceEvent(clientContext.onDispose, () => {
            this.handleContextDisposed(clientContext);
        });

        this.contextManager.add(clientChannelId, clientContext);

        try {
            emitEvent(this.onContextCreated, clientContext);
        } catch (err) {
            emitEvent(this.onError, err);
        }
    }

    /**
     * Called when context is disposed
     *
     * @param clientContext Client context
     */
    public handleContextDisposed(clientContext: ClientContext<Http.Channel>) {
        try {
            emitEvent(this.onContextDisposed, clientContext);
        } catch (err) {
            emitEvent(this.onError, err);
        }
    }

    /**
     * Disposes all contexts
     */
    public dispose() {
        this.contextManager.getAll().forEach((ctx) => ctx.dispose());
        this.contextManager.dispose();
    }
}
