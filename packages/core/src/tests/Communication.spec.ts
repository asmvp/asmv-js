/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { ClientContext } from "../lib/ClientContext";
import { ServiceContext, } from "../lib/ServiceContext";
import { MessageType, Message, RequestPayment, RequestUserConfirmation } from "../lib/Messages/MessageTypes";
import { onEvent, waitMsAsync } from "@asmv/utils";

type Channel = string;
type ConfigProfiles = Record<string, never>;

function setupDialogue<State extends object>(
    channel: Channel,
    serviceFn: (ctx: ServiceContext<Channel, ConfigProfiles, State>) => Promise<void>,
    clientFn: (ctx: ClientContext<Channel>) => Promise<void>,
    options?: {
        logMessages: boolean
    }
) {
    const clientCtx: ClientContext<Channel> = new ClientContext(async (_, message) => {
        return serviceCtx.handleIncomingMessage(message);
    }, channel);

    const serviceCtx: ServiceContext<Channel, ConfigProfiles, State> = new ServiceContext(async (_: string, message: Message) => {
        return clientCtx.handleIncomingMessage(message);
    }, channel, {});

    const runWithClientFirst = () => {
        const clientPromise = clientFn(clientCtx);
        const servicePromise = serviceFn(serviceCtx);
        return Promise.all([clientPromise, servicePromise]);
    };

    const runWithServiceFirst = () => {
        const servicePromise = serviceFn(serviceCtx);
        const clientPromise = clientFn(clientCtx);
        return Promise.all([servicePromise, clientPromise]);
    };

    if (options?.logMessages) {
        onEvent(clientCtx.onMessage, (msg) => console.log("Service -> Client:", msg));
        onEvent(serviceCtx.onMessage, (msg) => console.log("Client -> Service:", msg));
    }

    return {
        client: clientCtx,
        service: serviceCtx,
        runWithClientFirst,
        runWithServiceFirst
    }
}

describe("Action Handler / Client", () => {
    it("Should invoke a simple service call with client going first", async () => {
        const { service, runWithClientFirst } = setupDialogue<{ name: string }>(
            "test",
            async (ctx) => {
                const [ name ] = await ctx.getInputs([{
                    name: "name",
                    description: []
                }]);

                ctx.state.name = name.value as string;

                ctx.returnData(`Hello, ${ctx.state.name}!`, "Greetings");
                await ctx.finish();   
            },
            async (ctx) => {
                await ctx.provideInputs([{
                    name: "name",
                    value: "John"
                }]);

                const msg = await ctx.getMessage();
                expect(msg?.messageType).toBe(MessageType.Return);
            }
        );

        await runWithClientFirst();

        expect(service.serialize()).toMatchObject({
            state: {
                name: "John"
            }
        });
    });

    it("Should invoke a simple service call with server going first and requesting missing args", async () => {
        const { service, runWithServiceFirst } = setupDialogue<{ name: string }>(
            "test",
            async (ctx) => {
                const [ name ] = await ctx.getInputs([{
                    name: "name",
                    description: []
                }]);

                ctx.state.name = name.value as string;

                ctx.returnData(`Hello, ${ctx.state.name}!`, "Greetings");
                await ctx.finish();   
            },
            async (ctx) => {
                for await (const msg of ctx.getMessages()) {
                    if (msg.messageType === MessageType.RequestInput) {
                        await ctx.provideInputs([{
                            name: "name",
                            value: "John"
                        }]);
                    }

                    if (msg.messageType === MessageType.Return) {
                        expect(msg?.messageType).toBe(MessageType.Return);
                        console.log("Return:", msg);
                    }
                }
            }
        );

        await runWithServiceFirst();

        expect(service.serialize()).toMatchObject({
            state: {
                name: "John"
            }
        });
    });

    it("Client should cancel running process", async () => {
        const { runWithServiceFirst } = setupDialogue<{ name: string }>(
            "test",
            async (ctx) => {
                await waitMsAsync(100);
                await expect(ctx.requestUserConfirmation("test")).rejects.toThrow();
            },
            async (ctx) => {
                await ctx.cancel();
            }
        );

        await runWithServiceFirst();
    });

    it("Should request and provide user confirmation", async () => {
        const { runWithServiceFirst } = setupDialogue<{ name: string }>(
            "test",
            async (ctx) => {
                await ctx.requestUserConfirmation("Test");
                ctx.returnData("Hello, world!", "Greetings");
                await ctx.finish();
            },
            async (ctx) => {
                const msg = await ctx.getMessage() as RequestUserConfirmation;

                expect(msg?.messageType).toBe(MessageType.RequestUserConfirmation);
                expect(msg.reason).toBe("Test");

                ctx.provideUserConfirmation(msg, "test");
            },
            { logMessages: true }
        );

        await runWithServiceFirst();
    });

    it.only("Should request and authorize payment", async () => {
        const { runWithServiceFirst } = setupDialogue<{ name: string }>(
            "test",
            async (ctx) => {
                ctx.acceptedPaymentSchemas = [ "test+jwt", "test+ledger" ];

                const paymentAuth = await ctx.requestPayment({
                    amount: 1000,
                    currency: "TST",
                    description: "Test payment"
                }, 1000);

                expect(paymentAuth.currency).toBe("TST");
                expect(paymentAuth.maxAmount).toBe(1000);
                expect(paymentAuth.paymentSchema).toBe("test+jwt");
                expect(paymentAuth.paymentId).toBe("abc123");
                expect(paymentAuth.token).toBe("token");

                ctx.returnData("type/text", "Ok");
                await ctx.finish();
            },
            async (ctx) => {
                const reqPaymentMsg = await ctx.getMessage() as RequestPayment;

                expect(reqPaymentMsg?.messageType).toBe(MessageType.RequestPayment);
                expect(reqPaymentMsg.acceptedPaymentSchemas).toMatchObject([ "test+jwt", "test+ledger" ]);
                expect(reqPaymentMsg.amount).toBe(1000);
                expect(reqPaymentMsg.currency).toBe("TST");
                expect(reqPaymentMsg.description).toBe("Test payment");
                
                ctx.authorizePayment(reqPaymentMsg, "test+jwt", "abc123", "token");
            },
            { logMessages: true }
        );

        await runWithServiceFirst();
    });
});