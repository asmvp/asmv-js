/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { DefaultContext } from "koa";
import { ServiceContext, Http, SendMessageFunction, ServiceContextSerializedState, ServiceContextOptions, CommandDefinition } from "@asmv/core";
import { ServiceChannel } from "./Channel";

export type DefaultContextState = object;

export class HttpServiceContext<State extends DefaultContextState, KoaContext extends DefaultContext> extends ServiceContext<ServiceChannel, State> {
    public koaContext?: KoaContext;

    public constructor(
        sendMessageFn: SendMessageFunction<Http.Channel>,
        opts: ServiceContextOptions,
        commandDefinition: CommandDefinition,
        koaContext: KoaContext|undefined,
        channel: ServiceChannel,
        serializedState?: ServiceContextSerializedState
    ) {
        super(sendMessageFn, opts, commandDefinition, channel, serializedState);
        this.koaContext = koaContext;
    }
}

export type DefaultHttpServiceContext = HttpServiceContext<DefaultContextState, DefaultContext>;

/**
 * Service context constructor type
 */
export type HttpServiceContextConstructor<ServiceContext extends DefaultHttpServiceContext> = new (
    sendMessageFn: SendMessageFunction<Http.Channel>,
    opts: ServiceContextOptions,
    commandDefinition: CommandDefinition,
    koaContext: ServiceContext["koaContext"],
    channel: Http.Channel,
    serializedState?: ServiceContextSerializedState
) => ServiceContext;
