/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */
import { CommandDescriptor, CommandInputTypes, CommandOutputTypes } from "../Manifest/ManifestTypes";
import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";
import { compileSchema } from "./Helpers";

export type CommandInputValidators<
    InputTypes extends CommandInputTypes
> = {
    [K in keyof InputTypes]: ValidateFunction<InputTypes[K]>|null;
}

export type CommandOutputValidators<
    OutputTypes extends CommandOutputTypes
> = {
    [K in keyof OutputTypes]: ValidateFunction<OutputTypes[K]>|null;
}

export interface CommandDefinition<
    InputTypes extends CommandInputTypes,
    OutputTypes extends CommandOutputTypes,
    Descriptor extends CommandDescriptor<InputTypes, OutputTypes>
> {
    descriptor: Descriptor;
    inputValidators: CommandInputValidators<Required<InputTypes>>;
    outputValidators: CommandOutputValidators<Required<OutputTypes>>;
}

export function CommandDefinition<
    InputTypes extends CommandInputTypes = CommandInputTypes,
    OutputTypes extends CommandOutputTypes = CommandOutputTypes,
    Descriptor extends CommandDescriptor<InputTypes, OutputTypes> = CommandDescriptor<InputTypes, OutputTypes>
>(descriptor: Descriptor): CommandDefinition<InputTypes, OutputTypes, Descriptor> {
    const ajv = new Ajv();

    const inputValidators = {} as CommandInputValidators<Required<InputTypes>>;
    const outputValidators = {} as CommandOutputValidators<Required<OutputTypes>>;

    // Compile input types schemas
    if (descriptor.inputTypes) {
        for (const k in descriptor.inputTypes) {
            const validator = compileSchema<InputTypes[typeof k]>(
                ajv,
                descriptor.inputTypes[k].schema as JSONSchemaType<InputTypes[typeof k]>,
                `Failed to compile input schema for command '${descriptor.commandName}' and input '${k}'.`
            );

            inputValidators[k] = validator;
        }
    }

    // Compile output types schemas
    if (descriptor.inputTypes) {
        for (const k in descriptor.inputTypes) {
            const validator = compileSchema<InputTypes[typeof k]>(
                ajv,
                descriptor.inputTypes[k].schema as JSONSchemaType<InputTypes[typeof k]>,
                `Failed to compile input schema for command '${descriptor.commandName}' and input '${k}'.`
            );

            inputValidators[k] = validator;
        }
    }

    return {
        descriptor: descriptor,
        inputValidators,
        outputValidators,
    };
}

// export const testCommandDefinition = CommandDefinition<{
//     name: string,
//     age?: number
// }, {
//     result: string
// }>({
//     commandName: "test",
//     description: [],
//     endpointUri: "/test",
//     inputTypes: {
//         "name": {
//             description: [],
//             schema: {
//                 type: "string",
//                 required: true,
//                 nullable: false
//             },
//             required: true,
//             minCount: undefined,
//         },
//         "age": {
//             description: [],
//             schema: {
//                 type: "integer",
//                 required: false,
//                 nullable: true
//             },
//             required: false,
//             minCount: undefined
//         }
//     },
//     outputTypes: {
//         result: {}
//     },
//     requiredConfigProfiles: [ "test" ]
// });
