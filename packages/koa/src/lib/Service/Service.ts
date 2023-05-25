/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { Manifest, ServiceContextStore, MemoryServiceContextStore, Http } from "@asmv/core";
import { createEventEmitter } from "@asmv/utils";
import Ajv, { ValidateFunction } from "ajv";
import * as koa from "koa";
import Router from "@koa/router";
import semver from "semver";
import { v4 as uuid_v4 } from "uuid";

import { CommandDefinition } from "./Command";
import { DefaultHttpServiceContext, HttpServiceContext, HttpServiceContextConstructor } from "./HttpServiceContext";
import { compileSchema, RouterKoaContext, sendMessageToClient } from "../Shared/ProtocolHelpers";
import { createServiceRouter, getServiceChannelUrl, ServiceRoutingSchema } from "./ServiceRouter";

/**
 * Service options
 */
export interface ServiceOptions<ServiceContext extends DefaultHttpServiceContext> {
    serviceName: string;
    version: string;
    description: Manifest.ServiceManifest["description"];
    baseUrl: string;
    defaultLanguage: string;
    configProfiles?: Manifest.ConfigProfileDescriptor[];
    termsAndConditions?: Manifest.TermsAndConditionsDescriptor[];
    acceptedPaymentSchemas?: Manifest.AcceptedPaymentSchemaDescriptor[];
    commands?: CommandDefinition<ServiceContext>[];

    contextConstructor: HttpServiceContextConstructor<ServiceContext>;
    routingSchema: ServiceRoutingSchema;
    userActionTimeout?: number;
    serviceContextStore?: ServiceContextStore;
}

export interface ConfigProfileDefinition {
    descriptor: Manifest.ConfigProfileDescriptor;
    validator: ValidateFunction|null;
}

export interface ServiceChannel<ServiceContext extends DefaultHttpServiceContext> extends Http.Channel {
    commandName: string;
    ctx: ServiceContext;
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
export class ServiceDefinition<ServiceContext extends DefaultHttpServiceContext> {
    private ajv: Ajv;

    public readonly serviceName: string;
    public readonly version: string;
    public readonly description: Manifest.ServiceManifest["description"];
    public readonly baseUrl: string;
    public readonly defaultLanguage: string;

    public readonly contextConstructor: HttpServiceContextConstructor<ServiceContext>;
    public readonly userActionTimeout: number;
    public readonly routingSchema: ServiceRoutingSchema;
    public readonly serviceContextStore: ServiceContextStore;
    // public readonly contextManager: ContextManager<ServiceContext>;

    public readonly configProfiles: Map<string, ConfigProfileDefinition> = new Map();
    public readonly termsAndConditions: Map<string, Manifest.TermsAndConditionsDescriptor> = new Map();
    public readonly acceptedPaymentSchemas: Map<string, Manifest.AcceptedPaymentSchemaDescriptor> = new Map();
    public readonly commands: Map<string, CommandDefinition<ServiceContext>> = new Map();

    public readonly middlewares: RouterMiddlewareFromContext<ServiceContext>[] = [];

    private channels: Map<string, ServiceChannel<ServiceContext>> = new Map();
    public readonly onError = createEventEmitter<unknown>();

    public constructor(options: ServiceOptions<ServiceContext>) {
        this.ajv = new Ajv();

        this.serviceName = options.serviceName;
        this.version = options.version;
        this.description = options.description;
        this.baseUrl = options.baseUrl;
        this.defaultLanguage = options.defaultLanguage;

        this.contextConstructor = options.contextConstructor;
        this.userActionTimeout = options.userActionTimeout || 300;
        this.routingSchema = options.routingSchema;
        this.serviceContextStore = options.serviceContextStore ?? new MemoryServiceContextStore();

        // Check version
        if (!semver.valid(this.version)) {
            throw new Error(`Service version '${this.version}' is not a valid semver string.`);
        }

        // Add config profiles
        if (options.configProfiles) {
            options.configProfiles.forEach((cp) => this.configProfile(cp));
        }

        // Add terms and conditions
        if (options.termsAndConditions) {
            options.termsAndConditions.forEach((tc) => this.addTermsAndConditions(tc));
        }

        // Add commands
        if (options.commands) {
            options.commands.forEach((cmd) => this.command(cmd));
        }    
    }

    /**
     * Adds configuration profile to the service
     *
     * @param descriptor Profile descriptor
     * @throws Error if configuration profile is already defined
     */
    public configProfile(descriptor: Manifest.ConfigProfileDescriptor): void {
        if (this.configProfiles.has(descriptor.name)) {
            throw new Error(`Config profile '${descriptor.name}' is already defined.`);
        }

        const validator = compileSchema(
            this.ajv,
            descriptor.schema,
            `Failed to compile schema for config profile '${descriptor.name}'.`
        );

        // Add profile
        this.configProfiles.set(descriptor.name, {
            descriptor,
            validator
        });
    }

    /**
     * Adds terms and conditions to the service
     *
     * @param descriptor Terms and conditions descriptor
     * @throws Error if terms and conditions are already defined
     */
    public addTermsAndConditions(descriptor: Manifest.TermsAndConditionsDescriptor): void {
        if (this.termsAndConditions.has(descriptor.name)) {
            throw new Error(`Terms and conditions '${descriptor.name}' are already defined.`);
        }

        this.termsAndConditions.set(descriptor.name, descriptor);
    }

    /**
     * Adds accepted payment schema to the service
     *
     * @param descriptor Accepted payment schema descriptor
     * @throws Error if payment schema is already defined
     */
    public acceptPaymentSchema(descriptor: Manifest.AcceptedPaymentSchemaDescriptor): void {
        if (this.acceptedPaymentSchemas.has(descriptor.schemaName)) {
            throw new Error(`Accepted payment schema '${descriptor.schemaName}' is already defined.`);
        }
        
        this.acceptedPaymentSchemas.set(descriptor.schemaName, descriptor);
    }

    /**
     * Adds command to the service
     *
     * @param command Command definition
     */
    public command(command: CommandDefinition<ServiceContext>): void {
        if (this.commands.has(command.descriptor.commandName)) {
            throw new Error(`Command '${command.descriptor.commandName}' is already defined.`);
        }

        // Validate configuration profiles
        if (command.descriptor.requiredConfigProfiles) {
            command.descriptor.requiredConfigProfiles.forEach((cp) => {
                if (!this.configProfiles.has(cp)) {
                    throw new Error(`Command '${command.descriptor.commandName}' requires config profile '${cp}' which is not defined in the service.`);
                }
            });
        }

        // Add command
        this.commands.set(command.descriptor.commandName, command);
    }

    /**
     * Returns command definition
     *
     * @param commandName Command name
     * @returns Command definition or undefined if command is not defined
     */
    public getCommand(commandName: string): CommandDefinition<ServiceContext>|undefined {
        return this.commands.get(commandName);
    }

    /**
     * Returns asmv service manifest
     *
     * @returns Service manifest
     */
    public getManifest(): Manifest.ServiceManifest {
        return {
            serviceName: this.serviceName,
            version: this.version,
            description: this.description,
            baseUri: this.baseUrl,
            defaultLanguage: this.defaultLanguage,
            setup: {
                configProfiles: Array.from(this.configProfiles.values()).map((cp) => cp.descriptor),
                termsAndConditions: Array.from(this.termsAndConditions.values()),
            },
            acceptedPaymentSchemas: Array.from(this.acceptedPaymentSchemas.values()),
            commands: Array.from(this.commands.values()).map((cmd) => {
                return {
                    ...cmd.descriptor,
                    endpointUri: `${this.baseUrl}/invoke/${cmd.descriptor.commandName}`
                }
            })
        };
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
     * Adds channel to the service state
     *
     * @param channel Channel
     * @param ctx Service context
     */
    public createChannel(clientChannel: Http.ClientChannel, koaContext: RouterKoaContext): ServiceChannel<ServiceContext> {
        const serviceChannelId = uuid_v4();
        const serviceChannelToken = uuid_v4();

        const httpChannel: Http.Channel = {
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
            koaContext,
            httpChannel
        );

        const serviceChannel: ServiceChannel<ServiceContext> = {
            ...httpChannel,
            ctx: serviceContext
        };

        this.channels.set(serviceChannelId, serviceChannel);

        return serviceChannel;
    }

    /**
     * Returns channel by id
     *
     * @param serviceChannelId Service channel ID
     * @returns Service channel or undefined if channel is not found
     */
    public getChannel(serviceChannelId: string): ServiceChannel<ServiceContext>|undefined {
        return this.channels.get(serviceChannelId);
    }

    /**
     * Removes channel from the service state
     *
     * @param serviceChannelId Service channel ID
     */
    public removeChannel(serviceChannelId: string): void {
        this.channels.delete(serviceChannelId);
    }

    /**
     * Suspends channel
     *
     * @param serviceChannelId Service channel ID
     */
    public async suspendChannel(serviceChannelId: string): Promise<void> {
        const channel = this.channels.get(serviceChannelId);

        if (!channel) {
            throw new Error(`Service channel '${serviceChannelId}' not found.`);
        }

        //@todo Store it to the store
    }

    public async restoreChannel(serviceChannelId: string): Promise<void> {
        const channel = this.channels.get(serviceChannelId);

        if (!channel) {
            throw new Error(`Service channel '${serviceChannelId}' not found.`);
        }

        //@todo Restore it from the store
    }
}

export function Service<ServiceContext extends DefaultHttpServiceContext>(options: ServiceOptions<ServiceContext>): ServiceDefinition<ServiceContext> {
    return new ServiceDefinition(options);
}
