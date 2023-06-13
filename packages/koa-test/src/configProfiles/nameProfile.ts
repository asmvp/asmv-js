/**
 * @package @asmv/koa-demo
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { ConfigProfile, Manifest } from '@asmv/koa';

export default ConfigProfile<{
    name: string
}>({
    name: "name",
    description: [{
        lang: "en",
        label: "Name"
    }],
    scope: Manifest.DefinitionScope.User,
    setupUri: "/setup/name",
    schema: {
        type: "object",
        properties: {
            name: {
                type: "string"
            }
        },
        required: [ "name" ]
    }
});
