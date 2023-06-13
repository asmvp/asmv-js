/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { HttpErrors } from "@asmv/core";
import Router from "@koa/router";
import BodyParser from "koa-bodyparser";
import { HttpService } from "./Service";
import { DefaultHttpServiceContext } from "./HttpServiceContext";
import { checkProtocolVersion, getHttpHeaderOrThrow, parseChannelInfo, messageValidators, getValidBodyOrThrow, SUPPORTED_ASMV_VERSIONS, RouterKoaContext, handleProtocolErrors, getPathParameterOrThrow } from "../Shared/ProtocolHelpers";
import { executeCommandHandler } from "./ExecutionHandler";

/**
 * Service routing schema
 */
export enum ServiceRoutingSchema {
    HttpHeaders,
    UrlPath,
    Both
}

export function getCommandInvokeUrl(_routingSchema: ServiceRoutingSchema, baseUrl: string, commandName: string) {
    return `${baseUrl}/invoke/${commandName}`;
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

export function createServiceRouter<ServiceContext extends DefaultHttpServiceContext>(service: HttpService<ServiceContext>): Router {
    const router = new Router({
        prefix: service.pathPrefix,
    });

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
        
            // Create context
            const serviceContext = service.createContext({
                clientChannelUrl: clientChannelUrl,
                clientChannelToken: clientChannelToken,
                clientChannelId: clientChannelId
            }, ctx, commandName);

            const channel = serviceContext.channel;

            // Return from endpoint and call commmand handler asynchronously
            ctx.status = 204;
            ctx.append("x-asmv-service-channel-id", channel.serviceChannelId);
            ctx.append("x-asmv-service-channel-url", channel.serviceChannelUrl);
            ctx.append("x-asmv-service-channel-token", channel.serviceChannelToken);

            await serviceContext.handleIncomingMessage(message);
            executeCommandHandler(service, serviceContext, commandDef.handler);
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
            let serviceContext: ServiceContext|undefined = service.getLocalContext(serviceChannelId);
            let wasRestored = false;

            // if it's not locally, check the store
            if (!serviceContext) {
                serviceContext = await service.restoreContext(serviceChannelId);
                wasRestored = true;
            }

            if (!serviceContext) {
                throw new HttpErrors.SessionNotFoundError(ctx.channelInfo);
            }

            const channel = serviceContext.channel;
            const commandName = channel.commandName;
            const commandDef = service.getCommand(commandName);
        
            if (!commandDef) {
                throw new HttpErrors.CommandNotFoundError(ctx.channelInfo, commandName);
            }

            // Authorize
            if (authHeader !== `Bearer ${channel.serviceChannelToken}`) {
                throw new HttpErrors.UnauthorizedError(ctx.channelInfo);
            }

            // Return from endpoint and call commmand handler asynchronously
            ctx.status = 204;
            await serviceContext.handleIncomingMessage(message);

            // Execute handler if context were restored
            if (wasRestored) {
                executeCommandHandler(service, serviceContext, commandDef.handler);
            }
        }
    )

    return router;
}
