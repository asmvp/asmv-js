/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { JSONSchemaType } from "ajv";

/*
 * Helper types
 */
export type LanguageDescriptionItem<Props extends Record<string, unknown>> = {
    readonly lang: string;
} & Props;

export type LanguageDescription<Props extends Record<string, unknown>> = readonly LanguageDescriptionItem<Props>[];

/**
 * Element definition scope
 */
export enum DefinitionScope {
    User = "user",
    Organization = "organization"
}

/**
 * Descriptor of a command input
 */
export interface CommandInputTypeDescriptor<InputType>  {
    readonly description: LanguageDescription<{
        readonly title: string;
        readonly humanDescription?: string;
        readonly developerDescription?: string;
        readonly aiDescription?: string;
    }>;
    readonly schema?: JSONSchemaType<InputType>;
    readonly required?: boolean;
    readonly minCount?: number;
}

/**
 * Descriptor of a command output
 */
export interface CommandOutputTypeDescriptor<OutputType> {
    readonly description?: LanguageDescription<{
        readonly title?: string;
        readonly humanDescription?: string;
        readonly developerDescription?: string;
        readonly aiDescription?: string;
    }>;
    readonly schema?: JSONSchemaType<OutputType>;
}

/**
 * Command input types (base type)
 */
export type CommandInputTypes = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly [key: string]: any;
}

/**
 * Command output types (base type)
 */
export type CommandOutputTypes = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly [key: string]: any;
}

/**
 * Map of command input descriptors
 */
export type CommandInputTypeDescriptorMap<InputTypes extends CommandInputTypes> = {
    readonly [K in keyof InputTypes]: CommandInputTypeDescriptor<InputTypes[K]>;
}

/**
 * Map of command output descriptors
 */
export type CommandOutputTypeDescriptorMap<OutputTypes extends CommandOutputTypes> = {
    readonly [K in keyof OutputTypes]: CommandOutputTypeDescriptor<OutputTypes[K]>;
}

/**
 * Descriptor of a command
 */
export interface CommandDescriptor<
    InputTypes extends CommandInputTypes,
    OutputTypes extends CommandOutputTypes
> {
    readonly commandName: string;
    readonly description: LanguageDescription<{
        readonly title: string;
        readonly humanDescription?: string;
        readonly developerDescription?: string;
        readonly aiDescription?: string;
    }>;
    readonly endpointUri: string;
    readonly requiredConfigProfiles?: string[];
    readonly requiresUserConfirmation?: boolean;
    readonly inputTypes: CommandInputTypeDescriptorMap<Required<InputTypes>>;
    readonly outputTypes: CommandOutputTypeDescriptorMap<Required<OutputTypes>>;
}

/**
 * Descriptor of a configuration profile
 */
export interface ConfigProfileDescriptor<ConfigType> {
    readonly setupUri: string;
    readonly scope: DefinitionScope;
    readonly description?: LanguageDescription<{
        readonly label: string;
    }>;
    readonly schema?: JSONSchemaType<ConfigType>;
}

/**
 * Descriptor of a terms and conditions
 */
export interface TermsAndConditionsDescriptor {
    name: string;
    description: LanguageDescription<{
        label: string;
        url: string;
    }>;
    scope: DefinitionScope;
    acceptanceRequired: boolean;
    lastModified: string;
}

/**
 * Configuration profile types (base type)
 */
export type ConfigProfileTypes = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K: string]: any;
}

/**
 * Map of configuration profile descriptors
 */
export type ConfigProfileDescriptorMap<ConfigTypes> = {
    [K in keyof ConfigTypes]: ConfigProfileDescriptor<ConfigTypes[K]>;
}

/**
 * Descriptor of a service setup
 */
export interface SetupDescriptor<
    ConfigTypes extends ConfigProfileTypes
> {
    configProfiles?: ConfigProfileDescriptorMap<ConfigTypes>;
    termsAndConditions?: TermsAndConditionsDescriptor[];
}

/**
 * Descriptor of an accepted payment schema
 */
export interface AcceptedPaymentSchemaDescriptor {
    schemaName: string;
    options?: Record<string, unknown>;
}

/**
 * Service manifest
 */
export interface ServiceManifest {
    serviceName: string;
    version: string;
    baseUri: string;
    defaultLanguage: string;
    description: LanguageDescription<{
        title: string;
        humanDescription: string;
        developerDescription?: string;
        aiDescription?: string;
    }>;
    setup?: SetupDescriptor<Record<string, unknown>>;
    commands: CommandDescriptor<Record<string, unknown>, Record<string, unknown>>[];
    acceptedPaymentSchemas?: AcceptedPaymentSchemaDescriptor[];
}
