/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */
import { ConfigProfileDescriptor, DefinitionScope, LanguageDescription } from "../Manifest/ManifestTypes";
import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";
import { ValidationResult, compileSchema, validate } from "../Shared/SchemaValidation";

export interface ConfigProfileOpts<ConfigType> {
    readonly name: string;
    readonly setupUri: string;
    readonly scope: DefinitionScope;
    readonly description: LanguageDescription<{
        readonly label: string;
    }>;
    readonly schema?: JSONSchemaType<ConfigType>;
}

/**
 * Config profile definition class
 */
export class ConfigProfileDefinition<ConfigType> {
    private name: string;
    private setupUri: string;
    private scope: DefinitionScope;
    private description: LanguageDescription<{
        readonly label: string;
    }>;
    private schema?: JSONSchemaType<ConfigType>;

    private ajv = new Ajv();
    private schemaValidator: ValidateFunction<ConfigType>|undefined;

    /**
     * Constructor
     * @param descriptor Config profile descriptor
     */
    public constructor(opts: ConfigProfileOpts<ConfigType>) {
        this.name = opts.name;
        this.setupUri = opts.setupUri;
        this.scope = opts.scope;
        this.description = opts.description;
        this.schema = opts.schema;

        // Compile schema
        if (this.schema) {
            this.schemaValidator = compileSchema<ConfigType>(
                this.ajv,
                this.schema as JSONSchemaType<unknown>,
                `Failed to compile schema for config profile.`
            );
        }
    }

    /**
     * Returns config profile name
     */
    public getName(): string {
        return this.name;
    }

    /**
     * Returns config profile descriptor
     */
    public getDescriptor(): ConfigProfileDescriptor<ConfigType> {
        return {
            setupUri: this.setupUri,
            scope: this.scope,
            description: this.description,
            schema: this.schema
        }
    }

    /**
     * Validates data agains profile schema
     *
     * @param data Data to validate
     * @returns Validation result
     */
    public validateData(data: unknown): ValidationResult {
        return validate<ConfigType>(this.schemaValidator, data);
    }
}

/**
 * Defines config profile
 *
 * @param name Config profile name
 * @param descriptor Config profile descriptor
 * @returns Config profile definition instance
 */
export function ConfigProfile<ConfigType>(opts: ConfigProfileOpts<ConfigType>): ConfigProfileDefinition<ConfigType> {
    return new ConfigProfileDefinition<ConfigType>(opts);
}
