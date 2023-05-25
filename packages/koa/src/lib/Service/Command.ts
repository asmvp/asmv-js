/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { Manifest } from "@asmv/core";
import Ajv, { ValidateFunction } from "ajv";

import { DefaultHttpServiceContext } from "./HttpServiceContext";
import { compileSchema } from "../Shared/ProtocolHelpers";

/**
 * Command handler
 */
export type CommandHandler<ServiceContext extends DefaultHttpServiceContext> = (ctx: ServiceContext) => Promise<void>;

/**
 * Command options
 */
export type CommandOptions = Omit<Manifest.CommandDescriptor, "endpointUri">;

/**
 * Command definition
 */
export class CommandDefinition<ServiceContext extends DefaultHttpServiceContext> {
    private ajv: Ajv;

    public readonly descriptor: CommandOptions;
    public readonly handler: CommandHandler<ServiceContext>;

    public readonly inputValidators: Map<string, ValidateFunction|null> = new Map();
    public readonly outputValidator: ValidateFunction|null;

    public constructor(descriptor: CommandOptions, handler: CommandHandler<ServiceContext>) {
        this.ajv = new Ajv();

        this.descriptor = descriptor;
        this.handler = handler;

        // Compile input schema
        if (descriptor.inputs) {
            descriptor.inputs.forEach((input) => {
                if (this.inputValidators.has(input.name)) {
                    throw new Error(`Duplicate input name '${input.name}' for command '${descriptor.commandName}'.`);
                }

                const validator = compileSchema(
                    this.ajv,
                    input.schema,
                    `Failed to compile input schema for command '${descriptor.commandName}' and input '${input.name}'.`
                );

                this.inputValidators.set(input.name, validator);
            });
        }

        // Compile output schema
        this.outputValidator = compileSchema(
            this.ajv,
            descriptor.output?.schema,
            `Failed to compile output schema for command '${descriptor.commandName}'.`
        );
    }
}

export function Command<ServiceContext extends DefaultHttpServiceContext = DefaultHttpServiceContext>(
    descriptor: CommandOptions,
    handler: CommandHandler<ServiceContext>
) {
    return new CommandDefinition(descriptor, handler);
}
