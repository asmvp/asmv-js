/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { HttpErrors } from "@asmv/core";
import Router from "@koa/router";
import BodyParser from "koa-bodyparser";
import { checkProtocolVersion, getHttpHeaderOrThrow, parseChannelInfo, messageValidators, getValidBodyOrThrow, SUPPORTED_ASMV_VERSIONS, RouterKoaContext, handleProtocolErrors, getPathParameterOrThrow } from "../Shared/ProtocolHelpers";
import { Agent } from "./Agent";

export enum AgentRoutingSchema {
    HttpHeaders,
    UrlPath,
    Both
}

export function getAgentChannelUrl(routingSchema: AgentRoutingSchema, baseUrl: string, channelId: string) {
    if (routingSchema === AgentRoutingSchema.HttpHeaders) {
        return `${baseUrl}/channel`;
    } else {
        return `${baseUrl}/channel/${channelId}`;
    }
}

export function getAgentChannelUrlPattern(routingSchema: AgentRoutingSchema) {
    if (routingSchema === AgentRoutingSchema.HttpHeaders) {
        return `/channel`;
    } else {
        return `/channel/:clientChannelId`;
    }
}

export function createAgentRouter(agent: Agent): Router {
    const router = new Router({
        prefix: agent.pathPrefix,
    });

    // Add error handler
    router.use(handleProtocolErrors());

    // Add custom middlewares
    if (agent.middlewares.length > 0) {
        router.use(...agent.middlewares);
    }

    router.post(
        getAgentChannelUrlPattern(agent.routingSchema),
        checkProtocolVersion(SUPPORTED_ASMV_VERSIONS),
        parseChannelInfo(),
        BodyParser({
            enableTypes: ["json"],
        }),
        async (ctx: RouterKoaContext) => {
            let clientChannelId: string;

            if (agent.routingSchema === AgentRoutingSchema.HttpHeaders) {
                clientChannelId = getHttpHeaderOrThrow(ctx, "x-asmv-client-channel-id", true);
            } else {
                clientChannelId = getPathParameterOrThrow(ctx, "clientChannelId", true);
            }

            const authHeader = getHttpHeaderOrThrow(ctx, "authorization", true);
            const message = getValidBodyOrThrow(ctx, messageValidators.Message);

            // Try to get channel
            const clientContext = agent.getClientContext(clientChannelId);

            if (!clientContext) {
                throw new HttpErrors.SessionNotFoundError(ctx.channelInfo);
            }

            const channel = clientContext.channel;

            // Authorize
            if (authHeader !== `Bearer ${channel.clientChannelToken}`) {
                throw new HttpErrors.UnauthorizedError(ctx.channelInfo);
            }

            // Return from endpoint and call commmand handler asynchronously
            ctx.status = 204;
            await clientContext.handleIncomingMessage(message);
        }
    )

    return router;
}
