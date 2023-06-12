/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { Http } from "@asmv/core";

export type ServiceChannel = Http.Channel & {
    commandName: string;
}
