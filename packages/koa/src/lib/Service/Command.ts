/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { CommandDefinition, CommandOptions } from "@asmv/core";
import { DefaultHttpServiceContext } from "./HttpServiceContext";

/**
 * Command handler
 */
export type CommandHandler<ServiceContext extends DefaultHttpServiceContext> = (ctx: ServiceContext) => Promise<void>;

/**
 * Command definition
 */
export class HttpCommandDefinition<ServiceContext extends DefaultHttpServiceContext> extends CommandDefinition {
    public readonly handler: CommandHandler<ServiceContext>;

    public constructor(opts: CommandOptions, handler: CommandHandler<ServiceContext>) {
        super(opts);
        this.handler = handler;
    }
}
