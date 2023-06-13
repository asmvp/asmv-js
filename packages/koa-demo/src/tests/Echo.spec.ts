/**
 * @package @asmv/koa-demo
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { setupApp } from "./Helpers.speclib";

describe("Echo command", () => {
    const app = setupApp({
        logMessages: false,
        logDebug: false
    });

    let mock: AxiosMockAdapter;

    beforeAll(() => {
        mock = new AxiosMockAdapter(axios, { onNoMatch: "passthrough" });
    });

    afterAll(() => {
        mock.restore();
    });

    it("Should call command", async () => {
        const ctx = await app.agent.invoke(`${app.serviceUrl}/invoke/echo`, {
            name: {
                name: "Test"
            }
        }, [
            {
                inputType: "value",
                value: "Hello"
            }
        ]);

        const result = await ctx.getMessage();

        expect(result).toMatchSnapshot("Echo_Reply");
        await ctx.cancel();
    });

    it("Should retry if client channel is unreachable due to Bad Gateway", async () => {
        mock.onPost(new RegExp(`${app.serviceUrl}/agent/*`)).replyOnce(502, "Bad Gateway");

        const ctx = await app.agent.invoke(`${app.serviceUrl}/invoke/echo`, {
            name: {
                name: "Test"
            }
        }, [
            {
                inputType: "value",
                value: "Bad Gateway"
            }
        ]);

        const result = await ctx.getMessage();

        expect(result).toMatchSnapshot("Echo_Client_BadGatewayReply");
        await ctx.cancel();
    });

    it("Should retry if server channel is unreachable due to Bad Gateway", async () => {
        mock.onPost(new RegExp(`${app.serviceUrl}/channel/*`)).replyOnce(502, "Bad Gateway");

        const ctx = await app.agent.invoke(`${app.serviceUrl}/invoke/echo`, {
            name: {
                name: "Test"
            }
        }, []);

        await ctx.getMessage();
        await ctx.provideInputs([
            {
                inputType: "value",
                value: "Bad Gateway"
            }
        ]);

        const result = await ctx.getMessage();
        expect(result).toMatchSnapshot("Echo_Service_BadGatewayReply");

        await ctx.cancel();
    });
});
