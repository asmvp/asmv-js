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
        const ctx = await app.agent.invoke(`${app.serviceUrl}/invoke/add`, {}, [
            {
                inputType: "leftValue",
                value: 1
            },
            {
                inputType: "rightValue",
                value: 2
            }
        ]);

        const result = await ctx.getMessage();

        expect(result).toMatchSnapshot("Add_Reply_1p3");
    });
});
