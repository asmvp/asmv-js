/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */
import { ConfigProfileDescriptor } from "../Manifest/ManifestTypes";
import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";
import { compileSchema } from "./Helpers";

export interface ConfigProfileDefinition<
    ConfigType,
    Descriptor extends ConfigProfileDescriptor<ConfigType> = ConfigProfileDescriptor<ConfigType>
> {
    descriptor: Descriptor;
    schemaValidator: ValidateFunction<ConfigType>|null;
}

export function ConfigProfileDefinition<
    ConfigType,
    Descriptor extends ConfigProfileDescriptor<ConfigType> = ConfigProfileDescriptor<ConfigType>
>(descriptor: Descriptor): ConfigProfileDefinition<ConfigType, Descriptor> {
    const ajv = new Ajv();

    let schemaValidator: ValidateFunction<ConfigType>|null = null;

    // Compile schema
    if (descriptor.schema) {
        schemaValidator = compileSchema<ConfigType>(
            ajv,
            descriptor.schema as JSONSchemaType<ConfigType>,
            `Failed to compile schema for config profile.`
        );
    }

    return {
        descriptor: descriptor,
        schemaValidator: schemaValidator
    };
}

// export const testConfigProfileDefinition = ConfigProfileDefinition<{
//     accountId: string;
//     token: string;
// }>({
//     description: [],
//     setupUri: "xxx",
//     scope: DefinitionScope.User,
//     schema: {
//         type: "object",
//         properties: {
//             accountId: {
//                 type: "string"
//             },
//             token: {
//                 type: "string"
//             }
//         },
//         required: [ "accountId", "token" ]
//     }
// });
