/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import semver from "semver";
import { AcceptedPaymentSchemaDescriptor, CommandMap, LanguageDescription, ServiceManifest, SetupDescriptor, TermsAndConditionsDescriptor } from "../Manifest/ManifestTypes";
import { CommandDefinition } from "./CommandDefinition";
import { ConfigProfileDefinition } from "./ConfigProfileDefinition";

export interface ServiceUriResolver {
    getBaseUri(): string;
    getCommandEndpointUri(commandName: string): string;
}

export interface ServiceSetupOpts {
    configProfiles?: ConfigProfileDefinition<unknown>[];
    termsAndConditions?: TermsAndConditionsDescriptor[];
}

export interface ServiceDefinitionOptions {
    serviceName: string;
    version: string;
    defaultLanguage: string;
    description: LanguageDescription<{
        title: string;
        humanDescription: string;
        developerDescription?: string;
        aiDescription?: string;
    }>;
    termsAndConditions?: TermsAndConditionsDescriptor[];
    acceptedPaymentSchemas?: AcceptedPaymentSchemaDescriptor[];
}

export class ServiceDefinition {
    protected readonly serviceName: string;
    protected readonly version: string;
    protected readonly defaultLanguage: string;
    protected readonly description: LanguageDescription<{
        title: string;
        humanDescription: string;
        developerDescription?: string;
        aiDescription?: string;
    }>;

    protected configProfiles: Map<string, ConfigProfileDefinition<unknown>> = new Map();
    protected termsAndConditions: TermsAndConditionsDescriptor[];
    protected acceptedPaymentSchemas: AcceptedPaymentSchemaDescriptor[];

    protected commands: Map<string, CommandDefinition> = new Map();

    public constructor(opts: ServiceDefinitionOptions) {
        this.serviceName = opts.serviceName;
        this.version = opts.version;
        this.defaultLanguage = opts.defaultLanguage;
        this.description = opts.description;
        this.termsAndConditions = opts.termsAndConditions ?? [];
        this.acceptedPaymentSchemas = opts.acceptedPaymentSchemas ?? [];

        // Check version
        if (!semver.valid(this.version)) {
            throw new Error(`Service version '${this.version}' is not a valid semver string.`);
        }
    }

    public addConfigProfile(profile: ConfigProfileDefinition<unknown>) {
        // Check if there is a profile with the same name and different instance
        if (this.configProfiles.has(profile.getName()) && this.configProfiles.get(profile.getName()) !== profile) {
            throw new Error(`Config profile with name "${profile.getName()}" is already registered and instance is not the same.`);
        }

        this.configProfiles.set(profile.getName(), profile);
    }

    public addTermsAndConditions(terms: TermsAndConditionsDescriptor) {
        this.termsAndConditions.push(terms);
    }

    public addAcceptedPaymentSchema(schema: AcceptedPaymentSchemaDescriptor) {
        this.acceptedPaymentSchemas.push(schema);
    }

    public addCommand(command: CommandDefinition) {
        // Check if command is already registered
        if (this.commands.has(command.getName())) {
            throw new Error(`Command with name "${command.getName()}" is already registered.`);
        }

        // Add config profiles required by the command
        for (const profile of command.getRequiredConfigProfiles()) {
            this.addConfigProfile(profile);
        }

        // Add command
        this.commands.set(command.getName(), command);
    }

    public getManifest(uriResolver: ServiceUriResolver): ServiceManifest {
        const setup: SetupDescriptor = {
            configProfiles: {},
            termsAndConditions: this.termsAndConditions,
        }

        for (const profile of this.configProfiles.values()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            setup.configProfiles![profile.getName()] = profile.getDescriptor();
        }

        const commandMap: CommandMap = Object.fromEntries(Array.from(this.commands.entries()).map((entry) => {
            const [ key, command ] = entry;
            const endpointUri = uriResolver.getCommandEndpointUri(command.getName());
            return [ key, command.getDescriptor(endpointUri) ];
        }));

        return {
            "@asmv": "1.0.0",
            serviceName: this.serviceName,
            version: this.version,
            defaultLanguage: this.defaultLanguage,
            description: this.description,
            baseUri: uriResolver.getBaseUri(),
            setup: setup,
            acceptedPaymentSchemas: this.acceptedPaymentSchemas,
            commands: commandMap
        }
    }
}
