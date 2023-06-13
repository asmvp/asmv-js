/**
 * @package @asmv/koa-demo
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import koa from 'koa';
import { HttpService, StatefulHttpServiceContext, Agent } from '@asmv/koa';
import { AppOptions, createApp } from "../App";
import { IncomingMessage, Server, ServerResponse } from 'http';

export function setupApp(opts?: Partial<AppOptions>) {
    const host = "127.0.0.1";
    const port = 3001 + Math.floor(Math.random() * 1000);

    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const ref: {
        app: koa,
        service: HttpService<StatefulHttpServiceContext>,
        agent: Agent,
        server: Server<typeof IncomingMessage, typeof ServerResponse>,
        serviceUrl: string
    } = {
        app: undefined!,
        service: undefined!,
        agent: undefined!,
        server: undefined!,
        serviceUrl: `http://${host}:${port}`
    }
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    beforeAll((cb) => {
        createApp({
            host: host,
            port: port,
            ...opts ?? {}
        }, (appInstance) => {
            ref.app = appInstance.app;
            ref.service = appInstance.service;
            ref.agent = appInstance.agent;
            ref.server = appInstance.server;
            cb();
        });
    });

    afterAll(() => {
        ref.server.close();
        ref.service.dispose();
        ref.agent.dispose();
    });

    return ref;
}
