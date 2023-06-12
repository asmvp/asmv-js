/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { emitEvent } from "@asmv/utils";
import { ServiceContextStatus } from "@asmv/core";

import { CommandHandler } from "./Command";
import { DefaultHttpServiceContext } from "./HttpServiceContext";
import { HttpService } from "./Service";

export function executeCommandHandler<ServiceContext extends DefaultHttpServiceContext>(
    service: HttpService<ServiceContext>,
    ctx: ServiceContext,
    handler: CommandHandler<ServiceContext>
) {
    const serviceChannelId = ctx.channel.serviceChannelId;

    handler(ctx).then(async () => {
        if (ctx.getStatus() === ServiceContextStatus.Suspended) {
            service.storeAndDisposeContext(ctx);
            return;
        }
        
        if (ctx.getStatus() !== ServiceContextStatus.Finished) {
            await ctx.finish();
        }

        service.deleteAndDisposeContext(serviceChannelId);
    }, (err) => {
        if (err instanceof Error) {
            ctx.returnError(err.name, err.message);
        } else {
            ctx.returnError("UnexpectedError", String(err));
        }

        if (ctx.getStatus() !== ServiceContextStatus.Finished) {
            ctx.finish();
        }

        service.deleteAndDisposeContext(serviceChannelId);
        emitEvent(service.onError, err);
    });
}