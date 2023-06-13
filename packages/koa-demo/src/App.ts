/**
 * @package @asmv/koa-demo
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import koa from 'koa';
import { Service, ServiceRoutingSchema, HttpServiceContext, HttpService, StatefulHttpServiceContext, Agent, AgentRoutingSchema } from '@asmv/koa';
import { onEvent } from "@asmv/utils";
import commands from "./commands";
import { IncomingMessage, Server, ServerResponse } from 'http';

export interface AppOptions {
    host: string;
    port: number;
    logMessages?: boolean;
    logDebug?: boolean;
}

export type AppInstance = {
    app: koa,
    service: HttpService<StatefulHttpServiceContext>,
    agent: Agent,
    server: Server<typeof IncomingMessage, typeof ServerResponse>
}

export function createApp(opts: AppOptions, onReady?: (appInstance: AppInstance) => void) {
    const { host, port } = opts;
    const app = new koa();

    const service = Service({
        serviceName: "dev.asmv.demo",
        version: "1.0.0",
        description: [
            {
                lang: "en",
                title: "Demo service",
                humanDescription: "Demo service for testing purposes",
            }
        ],
        baseUrl: `http://${host}:${port}`,
        defaultLanguage: "en",
        routingSchema: ServiceRoutingSchema.Both,
        contextConstructor: HttpServiceContext,
        commands: commands
    });

    const agent = new Agent({
        baseUrl: `http://${host}:${port}/agent`,
        pathPrefix: "/agent",
        routingSchema: AgentRoutingSchema.Both
    })
    
    app.use(service.getRouter().routes());
    app.use(agent.getRouter().routes());
    
    app.use(async (ctx) => {
        ctx.body = { message: 'Hello API' };
    });

    // Logging
    onEvent(service.onError, (err) => console.error("Service error:", err));
    onEvent(agent.onError, (err) => console.error("Agent error:", err));

    onEvent(service.onContextCreated, (ctx) => {
        if (opts.logDebug) {
            console.debug(
                "[Service] Service context created:\n  serviceChannelId=%s, serviceChannelUrl=%s\n  clientChanelId=%s, clientChannelUrl=%s",
                ctx.channel.serviceChannelId, ctx.channel.serviceChannelUrl,
                ctx.channel.clientChannelId, ctx.channel.clientChannelUrl
            );
        }

        if (opts.logMessages) {
            onEvent(ctx.onIncomingMessage, (msg) => console.log("[Service] Client (%s) -> Service (%s):\n", ctx.channel.clientChannelId, ctx.channel.serviceChannelId, msg));
            onEvent(ctx.onOutgoingMessage, (msg) => console.log("[Service] Service (%s -> Client (%s)):\n", ctx.channel.serviceChannelId, ctx.channel.clientChannelId, msg));
        }
    });

    onEvent(agent.onContextCreated, (ctx) => {
        if (opts.logDebug) {
            console.debug(
                "[Agent] Client context created:\n  clientChanelId=%s, clientChannelUrl=%s\n  serviceChannelId=%s, serviceChannelUrl=%s",
                ctx.channel.clientChannelId, ctx.channel.clientChannelUrl,
                ctx.channel.serviceChannelId, ctx.channel.serviceChannelUrl
            );
        }

        if (opts.logMessages) {
            onEvent(ctx.onIncomingMessage, (msg) => console.log("[Agent] Service (%s) -> Client (%s):\n", ctx.channel.serviceChannelId, ctx.channel.clientChannelId, msg));
            onEvent(ctx.onOutgoingMessage, (msg) => console.log("[Agent] Client (%s -> Service (%s)):\n", ctx.channel.clientChannelId, ctx.channel.serviceChannelId, msg));
        }
    });

    if (opts.logDebug) {
        onEvent(service.onContextDisposed, (ctx) => {
            console.debug("[Service] Service context disposed: serviceChannelId=%s, clientChanelId=%s", ctx.channel.serviceChannelId, ctx.channel.clientChannelId);
        });

        onEvent(agent.onContextDisposed, (ctx) => {
            console.debug("[Agent] Client context disposed: clientChanelId=%s, serviceChannelId=%s", ctx.channel.clientChannelId, ctx.channel.serviceChannelId);
        });
    }

    // Start server
    const server = app.listen(port, host, () => {
        if (onReady) {
            onReady({ app, service, agent, server });
        }
    });
}
