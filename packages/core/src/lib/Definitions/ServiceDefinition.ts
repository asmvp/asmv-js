/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { AcceptedPaymentSchemaDescriptor, CommandDescriptor, ConfigProfileTypes, LanguageDescription, TermsAndConditionsDescriptor } from "../Manifest/ManifestTypes";
import { CommandDefinition } from "./CommandDefinition";
import { ConfigProfileDefinition } from "./ConfigProfileDefinition";

export type TConfigProfileDefinitionMap<
    ConfigProfiles extends ConfigProfileTypes
> = {
    [K in keyof ConfigProfiles]: ConfigProfileDefinition<ConfigProfiles[K]>;
}

export interface TServiceSetupDefinition<
    ConfigProfiles extends ConfigProfileTypes
> {
    configProfiles?: TConfigProfileDefinitionMap<ConfigProfiles>;
    termsAndConditions?: TermsAndConditionsDescriptor[];
}

export type TServiceCommandDefinitions = Array<CommandDefinition<
    Record<string, unknown>,
    Record<string, unknown>,
    CommandDescriptor<Record<string, unknown>, Record<string, unknown>>
>>;

export interface TServiceDefinitionOpts<
    ConfigProfiles extends ConfigProfileTypes,
    Commands extends TServiceCommandDefinitions
> {
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
    setup?: TServiceSetupDefinition<ConfigProfiles>;
    commands: Commands;
    acceptedPaymentSchemas?: AcceptedPaymentSchemaDescriptor[];
}

export class ServiceDefinition<
    ConfigProfiles extends ConfigProfileTypes,
    Commands extends TServiceCommandDefinitions
> {
    public readonly serviceName: string;
    public readonly version: string;
    public readonly baseUri: string;
    public readonly defaultLanguage: string;
    public readonly description: LanguageDescription<{
        title: string;
        humanDescription: string;
        developerDescription?: string;
        aiDescription?: string;
    }>;

    public configProfiles: TConfigProfileDefinitionMap<ConfigProfiles>;
    public termsAndConditions: TermsAndConditionsDescriptor[];
    public acceptedPaymentSchemas: AcceptedPaymentSchemaDescriptor[];

    public commandDefinitions: TServiceCommandDefinitions;

    public constructor(opts: TServiceDefinitionOpts<ConfigProfiles, Commands>) {
        this.serviceName = opts.serviceName;
        this.version = opts.version;
        this.baseUri = opts.baseUri;
        this.defaultLanguage = opts.defaultLanguage;
        this.description = opts.description;
        this.configProfiles = opts.setup?.configProfiles ?? [] as TConfigProfileDefinitionMap<ConfigProfiles>;
        this.termsAndConditions = opts.setup?.termsAndConditions ?? [];
        this.acceptedPaymentSchemas = opts.acceptedPaymentSchemas ?? [];
        this.commandDefinitions = opts.commands;
    }
}

// const testServiceDef = new ServiceDefinition({
//     serviceName: "Test",
//     baseUri: "/",
//     version: "1.0",
//     defaultLanguage: "en",
//     description: [],
//     setup: {
//         configProfiles: {
//             test: ConfigProfileDefinition<string>({
//                 scope: DefinitionScope.User,
//                 setupUri: "/setup/test",
//                 schema: {
//                     type: "string"
//                 }
//             })
//         }
//     },
//     commands: [
//         CommandDefinition({
//             commandName: "Test",
//             description: [],
//             endpointUri: "/test",
//             inputTypes: {},
//             outputTypes: {}
//         })
//     ]
// });
