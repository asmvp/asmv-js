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
    readonly description: LanguageDescription<{
        readonly title: string;
        readonly humanDescription?: string;
        readonly developerDescription?: string;
        readonly aiDescription?: string;
    }>;
    readonly schema?: JSONSchemaType<OutputType>;
}

/**
 * Map of command input descriptors
 */
export type CommandInputTypeDescriptorMap = {
    readonly [K: string]: CommandInputTypeDescriptor<unknown>;
}

/**
 * Map of command output descriptors
 */
export type CommandOutputTypeDescriptorMap = {
    readonly [K: string]: CommandOutputTypeDescriptor<unknown>;
}

/**
 * Descriptor of a command
 */
export interface CommandDescriptor {
    readonly description: LanguageDescription<{
        readonly title: string;
        readonly humanDescription?: string;
        readonly developerDescription?: string;
        readonly aiDescription?: string;
    }>;
    readonly endpointUri: string;
    readonly requiredConfigProfiles?: string[];
    readonly requiresUserConfirmation?: boolean;
    readonly inputTypes: CommandInputTypeDescriptorMap;
    readonly outputTypes: CommandOutputTypeDescriptorMap;
}

/**
 * Descriptor of a configuration profile
 */
export interface ConfigProfileDescriptor<ConfigType> {
    readonly setupUri: string;
    readonly scope: DefinitionScope;
    readonly description: LanguageDescription<{
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
 * Map of configuration profile descriptors
 */
export type ConfigProfileDescriptorMap = {
    [K: string]: ConfigProfileDescriptor<unknown>;
}

/**
 * Descriptor of a service setup
 */
export interface SetupDescriptor {
    configProfiles?: ConfigProfileDescriptorMap;
    termsAndConditions?: TermsAndConditionsDescriptor[];
}

/**
 * Descriptor of an accepted payment schema
 */
export interface AcceptedPaymentSchemaDescriptor {
    schemaName: string;
    options?: Record<string, unknown>;
}

export interface CommandMap {
    [K: string]: CommandDescriptor;
}

/**
 * Service manifest
 */
export interface ServiceManifest {
    "@asmv": "1.0.0";
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
    setup?: SetupDescriptor;
    commands: CommandMap;
    acceptedPaymentSchemas?: AcceptedPaymentSchemaDescriptor[];
}
