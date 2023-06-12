/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */
import { CommandDescriptor, CommandInputTypeDescriptor, CommandOutputTypeDescriptor, LanguageDescription } from "../Manifest/ManifestTypes";
import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";
import { ValidationResult, compileSchema, validate } from "../Shared/SchemaValidation";
import { ConfigProfileDefinition } from "./ConfigProfileDefinition";

export interface CommandOptions {
    readonly name: string;
    readonly description: LanguageDescription<{
        readonly title: string;
        readonly humanDescription?: string;
        readonly developerDescription?: string;
        readonly aiDescription?: string;
    }>;
    readonly requiresUserConfirmation?: boolean;
    readonly requiredConfigProfiles?: ConfigProfileDefinition<unknown>[];
}

export interface InputDefinition<InputType> {
    descriptor: CommandInputTypeDescriptor<InputType>;
    validator: ValidateFunction<InputType>|undefined;
}

export interface OutputDefinition<OutputType> {
    descriptor: CommandOutputTypeDescriptor<OutputType>;
    validator: ValidateFunction<OutputType>|undefined;
}

export class CommandDefinition {
    private readonly name: string;
    private readonly description: LanguageDescription<{
        readonly title: string;
        readonly humanDescription?: string;
        readonly developerDescription?: string;
        readonly aiDescription?: string;
    }>;

    private ajv = new Ajv();
    
    private requiresUserConfirmation: boolean;

    private configProfiles: Set<ConfigProfileDefinition<unknown>> = new Set();
    private inputTypes: Map<string, InputDefinition<unknown>> = new Map();
    private outputTypes: Map<string, OutputDefinition<unknown>> = new Map();

    public constructor(opts: CommandOptions) {
        this.name = opts.name;
        this.description = opts.description;
        this.requiresUserConfirmation = opts.requiresUserConfirmation ?? false;

        if (opts.requiredConfigProfiles) {
            for (const profile of opts.requiredConfigProfiles) {
                this.configProfiles.add(profile);
            }
        }
    }

    public getName(): string {
        return this.name;
    }

    /**
     * Requires config profile
     *
     * @param profile Config profile definition
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public requireConfigProfile<T>(profile: ConfigProfileDefinition<T>): void {
        this.configProfiles.add(profile as ConfigProfileDefinition<unknown>);
    }

    /**
     * Adds input type
     *
     * @param name Input type name
     * @param descriptor Input type descriptor
     */
    public addInputType<InputType>(name: string, descriptor: CommandInputTypeDescriptor<InputType>): void {
        // Throw if already defined
        if (this.inputTypes.has(name)) {
            throw new Error(`Input type '${name}' is already defined.`);
        }

        const validator = compileSchema<InputType>(
            this.ajv,
            descriptor.schema as JSONSchemaType<unknown>,
            `Failed to compile schema for command input '${name}'.`
        );

        this.inputTypes.set(name, {
            descriptor: descriptor as CommandInputTypeDescriptor<unknown>,
            validator
        });
    }

    /**
     * Adds output type
     *
     * @param name Output type name
     * @param descriptor Output type descriptor
     */
    public addOutputType<OutputType>(name: string, descriptor: CommandOutputTypeDescriptor<OutputType>): void {
        // Throw if already defined
        if (this.outputTypes.has(name)) {
            throw new Error(`Output type '${name}' is already defined.`);
        }

        const validator = compileSchema<OutputType>(
            this.ajv,
            descriptor.schema as JSONSchemaType<unknown>,
            `Failed to compile schema for command output '${name}'.`
        );

        this.outputTypes.set(name, {
            descriptor: descriptor as CommandInputTypeDescriptor<unknown>,
            validator
        });
    }

    /**
     * Sets if command requires user confirmation
     *
     * @param value True if command requires user confirmation
     */
    public requireUserConfirmation(value = true): void {
        this.requiresUserConfirmation = value;
    }

    /**
     * Returs list of required config profiles
     */
    public getRequiredConfigProfiles(): ConfigProfileDefinition<unknown>[] {
        return Array.from(this.configProfiles);
    }

    /**
     * Returns if command requires config profile with given name
     *
     * @param name Config profile name
     */
    public doesRequireConfigProfile(name: string): boolean {
        return Array.from(this.configProfiles).some((profile) => profile.getName() === name);
    }

    /**
     * Returns map of input type definitions
     */
    public getInputTypeMap(): Map<string, InputDefinition<unknown>> {
        return this.inputTypes;
    }

    /**
     * Return input type definition by name
     *
     * @param name Input type name
     * @returns Input type definition
     */
    public getInputType(name: string): InputDefinition<unknown>|undefined {
        return this.inputTypes.get(name);
    }

    /**
     * Returns if input type is defined
     *
     * @param name Input type name
     */
    public hasInputType(name: string): boolean {
        return this.inputTypes.has(name);
    }

    /**
     * Returns map of output type definitions
     */
    public getOutputTypeMap(): Map<string, OutputDefinition<unknown>> {
        return this.outputTypes;
    }

    /**
     * Return output type definition by name
     *
     * @param name Output type name
     * @returns Output type definition
     */
    public getOutputType(name: string): OutputDefinition<unknown>|undefined {
        return this.outputTypes.get(name);
    }

    /**
     * Returns if output type is defined
     *
     * @param name Output type name
     */
    public hasOutputType(name: string): boolean {
        return this.outputTypes.has(name);
    }

    /**
     * Validates data agains input type schema
     *
     * @param inputType Input type name
     * @param data Data to validate
     * @returns Validation result
     */
    public validateInput(inputType: string, data: unknown): ValidationResult {
        const inputDef = this.inputTypes.get(inputType);

        if (!inputDef) {
            throw new Error(`Input type '${inputType}' is not defined.`);
        }

        return validate<unknown>(inputDef.validator, data);
    }

    /**
     * Validates data agains output type schema
     *
     * @param outputType Output type name
     * @param data Data to validate
     * @returns Validation result
     */
    public validateOutput(outputType: string, data: unknown): ValidationResult {
        const outputDef = this.outputTypes.get(outputType);

        if (!outputDef) {
            throw new Error(`Output type '${outputType}' is not defined.`);
        }

        return validate<unknown>(outputDef.validator, data);
    }

    /**
     * Returns command descriptor
     *
     * @param endpointUri Command endpoint URI
     * @returns Command descriptor
     */
    public getDescriptor(endpointUri: string): CommandDescriptor {
        return {
            description: this.description,
            requiresUserConfirmation: this.requiresUserConfirmation,
            requiredConfigProfiles: Array.from(this.configProfiles).map((profile) => profile.getName()),
            inputTypes: Object.fromEntries(Array.from(this.inputTypes.entries()).map(([name, input]) => {
                return [name, input.descriptor];
            })),
            outputTypes: Object.fromEntries(Array.from(this.outputTypes.entries()).map(([name, output]) => {
                return [name, output.descriptor];
            })),
            endpointUri: endpointUri
        };
    }
}
