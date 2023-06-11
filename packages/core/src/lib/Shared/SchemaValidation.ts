/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import Ajv, { ErrorObject, JSONSchemaType, ValidateFunction } from "ajv";

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: null|ErrorObject[];
}

/**
 * Compiles JSON schema if defined
 *
 * @param ajv Ajv instance
 * @param schema JSON schema
 * @param errorMessage Error message
 * @returns Validation function or null
 */
export function compileSchema<T>(ajv: Ajv, schema: JSONSchemaType<unknown>|null|undefined, errorMessage: string): ValidateFunction<T>|undefined {
    try {
        if (schema) {
            return ajv.compile<T>(schema);
        } else {
            return undefined;
        }
    } catch (err) {
        throw new Error(errorMessage + ": " + String(err));
    }
}

/**
 * Validates data using validation function
 *
 * @param validateFunction Ajv validation function
 * @param data Data to validate
 * @returns Validation result
 */
export function validate<T = unknown>(validateFunction: ValidateFunction<T>|undefined, data: unknown): ValidationResult {
    if (!validateFunction) {
        return { valid: true, errors: null };
    }

    const valid = validateFunction(data);

    if (valid) {
        return { valid: true, errors: null };
    } else {
        return { valid: false, errors: validateFunction.errors ?? null };
    }
}

/**
 * Validation error
 */
export class ValidationError extends Error {
    public readonly errors: ErrorObject[];

    constructor(errors: null|ErrorObject[], message: string) {
        super(message);
        this.errors = errors ?? [];
    }
}
