/**
 * @package @asmv/koa-demo
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { Command, useConfigProfile, useInput, useOutput, handleState, next, getStateData } from '@asmv/koa';
import NameConfigProfile from "../configProfiles/nameProfile";

export default Command({
    name: "echo",
    description: [{
        lang: "en",
        title: "Echo",
        humanDescription: "Echoes the input"
    }]
}, () => {
    type State = {
        initial: null,
        loop: {
            previousValue: string
        }
    };

    const getProfile = useConfigProfile(NameConfigProfile);

    const getValue = useInput<string>("value", {
        description: [],
        schema: { type: "string" }
    });

    const returnValue = useOutput<string>("value", {
        description: [],
        schema: { type: "string" }
    });

    handleState<State>("initial", async (ctx) => {
        const { name } = await getProfile(ctx);
        const value = await getValue(ctx);

        returnValue(ctx, `Hello, ${name}! You said: ${value}`);

        await next(ctx, "loop", {
            loop: {
                previousValue: value
            }
        });
    });

    handleState<State>("loop", async (ctx) => {
        const { name } = await getProfile(ctx);
        const value = await getValue(ctx);
        console.log("ctx state", ctx.state);
        const previous = getStateData(ctx).loop.previousValue;
        returnValue(ctx, `Hello, ${name}! Previous value was: ${previous}. You said: ${value}`);

        if (value != "exit") {            
            await next(ctx, "loop", {
                loop: {
                    previousValue: value
                }
            });
        }
    });
});
