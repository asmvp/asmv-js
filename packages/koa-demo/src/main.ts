import koa from 'koa';
import { Service, Command, ServiceRoutingSchema, HttpServiceContext } from '@asmv/koa';

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

    commands: [
        Command({
            commandName: "echo",
            description: [{
                lang: "en",
                title: "Echo",
                humanDescription: "Echoes the input"
            }],
            inputs: [
                {
                    name: "value",
                    description: [{
                        lang: "en",
                        title: "Value",
                    }]
                }
            ]
        }, async (ctx) => {
            //const value = await ctx.getInputs([{ name: "value" }]);
            ctx.returnData("Hello!");
            await ctx.finish();
        })
    ]
});

app.use(service.getRouter().routes());

app.use(async (ctx) => {
    ctx.body = { message: 'Hello API' };
});

app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
});
