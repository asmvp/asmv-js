/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";

/**
 * Compiles JSON schema if defined
 *
 * @param ajv Ajv instance
 * @param schema JSON schema
 * @param errorMessage Error message
 * @returns Validation function or null
 */
export function compileSchema<T>(ajv: Ajv, schema: JSONSchemaType<unknown>|null|undefined, errorMessage: string): ValidateFunction<T>|null {
    try {
        if (schema) {
            return ajv.compile<T>(schema);
        } else {
            return null;
        }
    } catch (err) {
        throw new Error(errorMessage + ": " + String(err));
    }
}
