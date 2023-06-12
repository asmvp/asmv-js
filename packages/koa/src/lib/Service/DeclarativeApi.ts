/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import * as koa from "koa";
import { CommandOptions, ConfigProfileDefinition, Manifest, ServiceContextStatus } from "@asmv/core";

import { DefaultHttpServiceContext, HttpServiceContext } from "./HttpServiceContext";
import { HttpService, ServiceOptions } from "./Service";
import { HttpCommandDefinition } from "./Command";

let currentCommand: HttpCommandDefinition<StatefulHttpServiceContext>|undefined = undefined;
let stateHandlers: Map<string, StateHandlerFunction<StatefulHttpServiceContext>>|undefined = undefined;

export type StateData = {
    initial: unknown;
    [K: string]: unknown;
};

export type BaseContextState<Data extends StateData> = {
    stateName: string;
    stateData: Data;
}

export type StatefulHttpServiceContext = HttpServiceContext<BaseContextState<StateData>, koa.DefaultContext>;

export type ConfigProfileGetter<T> = (ctx: DefaultHttpServiceContext) => Promise<T>;
export type GetInputFunction<T> = {
    one: (ctx: DefaultHttpServiceContext, waitTimeoutMs?: number) => Promise<T>;
    tryOne: (ctx: DefaultHttpServiceContext) => Promise<T|undefined>;
    many: (ctx: DefaultHttpServiceContext, minCount: number, maxCount?: number, waitTimeoutMs?: number) => Promise<T[]>;
};
export type GetInputListFunction<T> = (ctx: DefaultHttpServiceContext, count?: number, waitTimeoutMs?: number) => Promise<T[]|undefined>;
export type ReturnOutputFunction<T> = (ctx: DefaultHttpServiceContext, output: T) => void;
export type StateHandlerFunction<Context extends StatefulHttpServiceContext> = (ctx: Context) => Promise<void>;

/*
 * Helper functions
 */

function assertCurrentCommand() {
    if (!currentCommand) throw new Error("Command definition functions must be called inside 'Command(opts, () => { <here> })' function.");
}

/**
 * Declares service
 *
 * @param options Service options
 * @returns HttpService instance
 */
export function Service<ServiceContext extends DefaultHttpServiceContext>(options: ServiceOptions<ServiceContext>): HttpService<ServiceContext> {
    return new HttpService(options);
}

/**
 * Declares service command
 *
 * @param opts Command options
 * @param body Declaration body
 * @returns HttpCommandDefinition instance
 */
export function Command<
    ServiceContext extends StatefulHttpServiceContext = StatefulHttpServiceContext
>(opts: CommandOptions, body: () => void): HttpCommandDefinition<ServiceContext> {
    if (currentCommand !== undefined) {
        throw new Error("Cannot call Command() function inside another Command() function.");
    }

    try {
        const commandStateHandlers: Map<string, StateHandlerFunction<StatefulHttpServiceContext>> = stateHandlers = new Map();

        const res = currentCommand = new HttpCommandDefinition<ServiceContext>(opts, async (ctx) => {
            const stateName = ctx.state.stateName = ctx.state.stateName ?? "initial";
            const handler = commandStateHandlers.get(stateName);

            if (handler) {
                await handler(ctx);
            } else {
                throw new Error(`Command handler for state '${stateName}' not exists.`);
            }

            if (ctx.getStatus() === ServiceContextStatus.Active) {
                await ctx.finish();
            }
        }) as HttpCommandDefinition<StatefulHttpServiceContext>;

        body();

        return res;
    } finally {
        currentCommand = undefined;
        stateHandlers = undefined;
    }
}

/**
 * Adds required config profile to command and returns a getter function
 *
 * @param configProfile Required config profile
 * @returns Config profile getter function
 */
export function useConfigProfile<T>(configProfile: ConfigProfileDefinition<T>): ConfigProfileGetter<T> {
    assertCurrentCommand();
    currentCommand?.requireConfigProfile(configProfile);

    const name = configProfile.getName();

    return async (ctx: DefaultHttpServiceContext) => {
        return ctx.getConfigProfile(name);
    }
}

/**
 * Registers input type to the command and returns a getter function
 * The input getter function can be used to read input from the context
 *
 * @param type Input type
 * @param descriptor Input type descriptor
 * @returns Input getter function
 */
export function useInput<InputType>(type: string, descriptor: Manifest.CommandInputTypeDescriptor<InputType>): GetInputFunction<InputType> {
    assertCurrentCommand();
    currentCommand?.addInputType(type, descriptor);

    return async (ctx: DefaultHttpServiceContext, waitTimeoutMs?: number) => {
        const res = await ctx.getInputs(type, 1, waitTimeoutMs);
        return res?.[0] as InputType;
    }
}

/**
 * Registers input type to the command and returns a list getter function
 * The input getter function can be used to read input from the context
 *
 * @param type Input type
 * @param descriptor Input type descriptor
 * @returns Input list getter function
 */
export function useInputList<InputType>(type: string, descriptor: Manifest.CommandInputTypeDescriptor<InputType>): GetInputListFunction<InputType> {
    assertCurrentCommand();
    currentCommand?.addInputType(type, descriptor);

    return async (ctx: DefaultHttpServiceContext, count?: number, waitTimeoutMs?: number) => {
        return ctx.getInputs(type, count, waitTimeoutMs);
    }
}

/**
 * Registers output type to the command and returns a return function
 * The return function can be used to return output to the client.
 *
 * @param type Output type
 * @param descriptor Output type descriptor
 * @returns Return function
 */
export function useOutput<OutputType>(type: string, descriptor: Manifest.CommandOutputTypeDescriptor<OutputType>): ReturnOutputFunction<OutputType> {
    assertCurrentCommand();
    currentCommand?.addOutputType(type, descriptor);

    return (ctx: DefaultHttpServiceContext, data: OutputType) => {
        return ctx.returnData(type, data);
    }
}

/**
 * Finishes the command execution.
 * After this function is called, no other command handlers are executed and context is not usable anymore.
 *
 * @param ctx Service context
 */
export async function finish(ctx: DefaultHttpServiceContext): Promise<void> {
    return ctx.finish();
}

/**
 * Declares state handler. State handler is executed when the state is set and the context is activated.
 *
 * @param name State name
 * @param handler State handler function
 */
export function handleState<
    State extends StateData = StateData,
    ServiceContext extends HttpServiceContext<BaseContextState<State>, koa.DefaultContext> = HttpServiceContext<BaseContextState<State>, koa.DefaultContext>
>(name: keyof State, handler: StateHandlerFunction<ServiceContext>): void {
    assertCurrentCommand();

    if (stateHandlers?.has(name as string)) {
        throw new Error(`State handler for state '${name as string}' is already defined.`);
    }

    stateHandlers?.set(name as string, handler as StateHandlerFunction<StatefulHttpServiceContext>);
}

/**
 * Declares initial state handler. Initial state handler is executed when the command is invoked.
 *
 * @param handler State handler function
 */
export function handleInvoke<
    State extends StateData = StateData,
    ServiceContext extends HttpServiceContext<BaseContextState<State>, koa.DefaultContext> = HttpServiceContext<BaseContextState<State>, koa.DefaultContext>
>(handler: StateHandlerFunction<ServiceContext>): void {
    assertCurrentCommand();

    if (stateHandlers?.has("initial")) {
        throw new Error(`State handler for initial state (invoke) is already defined.`);
    }

    stateHandlers?.set("initial", handler as StateHandlerFunction<StatefulHttpServiceContext>);
}

/**
 * Sets next state and state data and suspends the context.
 * After this function is called, no other state handlers are executed and context is not usable anymore.
 *
 * @param ctx Service context
 * @param nextState Next state name
 * @param stateData Next state data
 */
export async function next<
    ServiceContext extends StatefulHttpServiceContext
>(ctx: ServiceContext, nextState?: keyof ServiceContext["state"]["stateData"], stateData?: Partial<ServiceContext["state"]["stateData"]>): Promise<void> {
    if (nextState !== undefined) {
        ctx.state.stateName = nextState as string;
    }

    if (stateData !== undefined) {
        ctx.state.stateData = {
            ...ctx.state.stateData,
            ...stateData
        };
    }

    await ctx.suspend();
}

export function getStateData<
    ServiceContext extends StatefulHttpServiceContext,
>(ctx: ServiceContext): ServiceContext["state"]["stateData"] {
    return ctx.state.stateData;
}
