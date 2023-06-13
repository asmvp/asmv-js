/**
 * @package @asmv/koa-demo
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { Command, useInput, useOutput, finish, handleInvoke } from '@asmv/koa';

export default Command({
    name: "add",
    description: [{
        lang: "en",
        title: "Add",
        humanDescription: "Adds two numbers"
    }]
}, () => {
    const getLeftValue = useInput<number>("leftValue", {
        description: [],
        schema: { type: "number" }
    });

    const getRightValue = useInput<number>("rightValue", {
        description: [],
        schema: { type: "number" }
    });

    const returnValue = useOutput<number>("value", {
        description: [],
        schema: { type: "number" }
    });

    handleInvoke(async (ctx) => {
        const left = await getLeftValue.one(ctx);
        const right = await getRightValue.one(ctx);

        returnValue(ctx, left + right);
        await finish(ctx);
    });
});
