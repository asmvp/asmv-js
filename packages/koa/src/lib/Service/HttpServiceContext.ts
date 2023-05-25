/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import * as koa from "koa";
import { ServiceContext, Http, SendMessageFunction, ServiceContextSerializedState } from "@asmv/core";

export type DefaultContextState = object;

export class HttpServiceContext<State extends DefaultContextState, KoaContext extends koa.DefaultContext> extends ServiceContext<Http.Channel, State> {
    public koaContext: KoaContext;

    public constructor(
        sendMessageFn: SendMessageFunction<Http.Channel>,
        koaContext: KoaContext,
        channel: Http.Channel,
        serializedState?: ServiceContextSerializedState
    ) {
        super(sendMessageFn, channel, serializedState);
        this.koaContext = koaContext;
    }
}

export type DefaultHttpServiceContext = HttpServiceContext<DefaultContextState, koa.DefaultContext>;

/**
 * Service context constructor type
 */
export type HttpServiceContextConstructor<ServiceContext extends DefaultHttpServiceContext> = new (
    sendMessageFn: SendMessageFunction<Http.Channel>,
    koaContext: ServiceContext["koaContext"],
    channel: Http.Channel,
    serializedState?: ServiceContextSerializedState
) => ServiceContext;

// --- test

export class MyHttpContext<State extends object, KoaContext extends koa.Context> extends HttpServiceContext<State, KoaContext> {
    public user?: {
        id: string;
    }
}

// export const test: HttpServiceContextConstructor<object, Context> = MyHttpContext;