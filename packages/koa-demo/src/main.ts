/**
 * @package @asmv/koa-demo
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import koa from 'koa';
import { Service, ServiceRoutingSchema, HttpServiceContext } from '@asmv/koa';
import commands from "./commands";

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

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

app.use(service.getRouter().routes());

app.use(async (ctx) => {
    ctx.body = { message: 'Hello API' };
});

app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
});
