/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { Http, HttpErrors, Message, ServiceContextStatus } from "@asmv/core";
import { emitEvent, TSerializableData } from "@asmv/utils";
import Router from "@koa/router";
import BodyParser from "koa-bodyparser";
import { v4 as uuid_v4 } from "uuid";
import { ServiceDefinition } from "./Service";
import { DefaultHttpServiceContext } from "./HttpServiceContext";
import { checkProtocolVersion, getHttpHeaderOrThrow, parseChannelInfo, messageValidators, getValidBodyOrThrow, SUPPORTED_ASMV_VERSIONS, sendMessageToClient, RouterKoaContext, handleProtocolErrors, getPathParameterOrThrow } from "../Shared/ProtocolHelpers";
import { CommandHandler } from "./Command";

/**
 * Service routing schema
 */
export enum ServiceRoutingSchema {
    HttpHeaders,
    UrlPath,
    Both
}

export function getServiceChannelUrl(routingSchema: ServiceRoutingSchema, baseUrl: string, channelId: string) {
    if (routingSchema === ServiceRoutingSchema.HttpHeaders) {
        return `${baseUrl}/channel`;
    } else {
        return `${baseUrl}/channel/${channelId}`;
    }
}

export function getServiceChannelUrlPattern(routingSchema: ServiceRoutingSchema) {
    if (routingSchema === ServiceRoutingSchema.HttpHeaders) {
        return `/channel`;
    } else {
        return `/channel/:serviceChannelId`;
    }
}

function executeCommandHandler<ServiceContext extends DefaultHttpServiceContext>(
    service: ServiceDefinition<ServiceContext>,
    ctx: ServiceContext,
    handler: CommandHandler<ServiceContext>
) {
    const key = ctx.getChannel().serviceChannelId;

    handler(ctx).then(async () => {
        if (ctx.getStatus() === ServiceContextStatus.Suspended) {
            const channel = ctx.getChannel();
            const state = ctx.serialize();

            service.serviceContextStore.store(key, channel as unknown as TSerializableData, state);
            service.contextManager.remove(key);

            ctx.dispose();
            return;
        }
        
        if (ctx.getStatus() !== ServiceContextStatus.Finished) {
            await ctx.finish();
        }

        service.serviceContextStore.delete(key);
        service.contextManager.remove(key);

        ctx.dispose();
    }, (err) => {
        if (err instanceof Error) {
            ctx.returnError(err.name, err.message);
        } else {
            ctx.returnError("UnexpectedError", String(err));
        }

        if (ctx.getStatus() !== ServiceContextStatus.Finished) {
            ctx.finish();
        }

        service.serviceContextStore.delete(key);
        service.contextManager.remove(key);

        ctx.dispose();
        emitEvent(service.onError, err);
    });
}

export function createServiceRouter<ServiceContext extends DefaultHttpServiceContext>(service: ServiceDefinition<ServiceContext>): Router {
    const router = new Router();

    // Add error handler
    router.use(handleProtocolErrors());

    // Add custom middlewares
    if (service.middlewares.length > 0) {
        router.use(...service.middlewares);
    }

    // Get service manifest
    router.get("/manifest.json", async (ctx: RouterKoaContext) => {
        ctx.body = service.getManifest();
    });

    // Add service routes
    router.post(
        "/invoke/:commandName",
        checkProtocolVersion(SUPPORTED_ASMV_VERSIONS),
        parseChannelInfo(),
        BodyParser({
            enableTypes: ["json"],
        }),
        async (ctx: RouterKoaContext) => {
            const clientChannelUrl = getHttpHeaderOrThrow(ctx, "x-asmv-client-channel-url", true);
            const clientChannelToken = getHttpHeaderOrThrow(ctx, "x-asmv-client-channel-token", true);
            const clientChannelId = getHttpHeaderOrThrow(ctx, "x-asmv-client-channel-id", true);
        
            // Get command
            const commandName = ctx.params["commandName"];
            const commandDef = service.getCommand(commandName);
        
            if (!commandDef) {
                throw new HttpErrors.CommandNotFoundError(ctx.channelInfo, commandName);
            }
        
            // Validate message
            const message = getValidBodyOrThrow(ctx, messageValidators.Invoke);
            
            // Verify config profiles
            const requiredConfigProfiles = commandDef.descriptor.requiredConfigProfiles;

            if (requiredConfigProfiles) {
                requiredConfigProfiles.forEach((profileName) => {
                    const profileDef = service.configProfiles.get(profileName);

                    if (!profileDef) {
                        throw new HttpErrors.UnexpectedError(ctx.channelInfo, new Error(`Configuration profile '${profileName}' is required but not defined in the service.`));
                    }

                    // Check if profile is provided
                    if (!message.configProfiles[profileName]) {
                        throw new HttpErrors.InvalidRequestError(ctx.channelInfo, {
                            reason: `Configuration profile '${profileName}' is required but was not provided.`
                        });
                    }

                    // Validate profile data
                    if (profileDef.validator) {
                        if (!profileDef.validator(message.configProfiles[profileName])) {
                            throw new HttpErrors.InvalidRequestError(ctx.channelInfo, {
                                reason: `Configuration profile '${profileName}' is invalid.`,
                                details: profileDef.validator.errors
                            });
                        }
                    }
                });
            }
        
            // Create channel
            const serviceChannelId = uuid_v4();

            const channel: Http.Channel = {
                clientChannelUrl: clientChannelUrl,
                clientChannelToken: clientChannelToken,
                clientChannelId: clientChannelId,
                serviceChannelUrl: getServiceChannelUrl(service.routingSchema, service.baseUrl, serviceChannelId),
                serviceChannelId: serviceChannelId,
                serviceChannelToken: "xxx",
                protocolVersion: ctx.asmvVersion
            };

            const serviceContext = new service.contextConstructor(
                sendMessageToClient,
                ctx,
                channel
            );

            service.contextManager.add(serviceChannelId, serviceContext);

            // Return from endpoint and call commmand handler asynchronously
            ctx.status = 204;
            ctx.append("x-asmv-service-channel-id", serviceChannelId);
            ctx.append("x-asmv-service-channel-url", channel.serviceChannelUrl);
            ctx.append("x-asmv-service-channel-token", channel.serviceChannelToken);

            executeCommandHandler(service, serviceContext, async (ctx) => {
                // Check for user confirmation
                if (commandDef.descriptor.requiresUserConfirmation) {
                    if (!message.userConfirmation) {
                        await serviceContext.requestUserConfirmation(undefined, service.userActionTimeout * 1000);
                    }
                }

                // Provide inputs
                serviceContext.handleIncomingMessage({
                    messageType: Message.MessageType.ProvideInput,
                    inputs: message.inputs
                });
            
                // Invoke handler
                await commandDef.handler(ctx);
            });
        }
    );

    router.post(
        getServiceChannelUrlPattern(service.routingSchema),
        checkProtocolVersion(SUPPORTED_ASMV_VERSIONS),
        parseChannelInfo(),
        BodyParser({
            enableTypes: ["json"],
        }),
        async (ctx: RouterKoaContext) => {
            let serviceChannelId: string;

            if (service.routingSchema === ServiceRoutingSchema.HttpHeaders) {
                serviceChannelId = getHttpHeaderOrThrow(ctx, "x-asmv-service-channel-id", true);
            } else {
                serviceChannelId = getPathParameterOrThrow(ctx, "serviceChannelId", true);
            }

            const authHeader = getHttpHeaderOrThrow(ctx, "authorization", true);
            const message = getValidBodyOrThrow(ctx, messageValidators.Message);

            // Try to get service context
            let serviceContext: ServiceContext|undefined = service.contextManager.get(serviceChannelId);
            let wasRestored = false;

            // if it's not locally, check the store
            if (!serviceContext) {
                const serializedData = await service.serviceContextStore.get(serviceChannelId);

                if (!serializedData) {
                    throw new HttpErrors.SessionNotFoundError(ctx.channelInfo);
                }

                serviceContext = new service.contextConstructor(
                    sendMessageToClient,
                    ctx,
                    serializedData.channel as unknown as Http.Channel,
                    serializedData.state
                );

                wasRestored = true;
            }

            const channel = serviceContext.getChannel();

            // Authorize
            if (authHeader !== `Bearer ${channel.serviceChannelToken}`) {
                throw new HttpErrors.UnauthorizedError(ctx.channelInfo);
            }

            // Handle message
            serviceContext.handleIncomingMessage(message);

            // Execute handler if context were restored
            if (wasRestored) {
                executeCommandHandler(service, serviceContext, );
            }
        }
    )

    return router;
}
