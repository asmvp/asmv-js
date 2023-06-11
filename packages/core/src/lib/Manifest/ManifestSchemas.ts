/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { JSONSchemaType } from "ajv";
import * as Manifest from "./ManifestTypes";
import { DefinitionScope } from "./ManifestTypes";

function LanguageDescription<Props extends Record<string, unknown>>(props: JSONSchemaType<Props>): JSONSchemaType<Manifest.LanguageDescription<Props>> {
    return {
        type: "array",
        items: {
            type: "object",
            properties: {
                lang: {
                    type: "string",
                    description: "Language of description fields specified as RFC5646 language tag (the same as HTTP is using).",
                    examples: ["en", "en-US", "cs-CZ"]
                },
                ...props.properties
            },
            required: ["lang", ...props.required ?? []]
        } as unknown as JSONSchemaType<Manifest.LanguageDescriptionItem<Props>>
    }
}

export const CommandInputDescriptor: JSONSchemaType<Manifest.CommandInputTypeDescriptor<unknown>> = {
    type: "object",
    properties: {
        description: LanguageDescription({
            type: "object",
            properties: {
                title: {
                    type: "string",
                    title: "Input Title",
                    examples: ["First Name", "Last Name"]
                },
                humanDescription: {
                    type: "string",
                    title: "Human Description",
                    description: "Short description of the input that is understandable by non-technical humans.",
                    nullable: true,
                    examples: ["Your current location", "Name of the document you want to open"]
                },
                developerDescription: {
                    type: "string",
                    title: "Developer Description",
                    description: "Technical and more detailed description written for developers.",
                    nullable: true,
                    examples: ["UUID of the required document", "Call the `/documents` endpoint to get the list of available documents"]
                },
                aiDescription: {
                    type: "string",
                    title: "AI Description",
                    description: "Short description of input that can be injected into an AI agent prompt.",
                    nullable: true,
                    examples: ["Ask user what's his first name", "Current physical location of the user, ask him if not provided."]
                }
            },
            required: ["title"]
        }),
        schema: {
            type: "object",
            title: "Validation Schema",
            description: "JSON Schema that is used to validate the input.",
            nullable: true,
            additionalProperties: true
        },
        required: {
            type: "boolean",
            title: "Required",
            description: "Indicates whether the input is required or not at the time of command invocation.",
            nullable: true
        },
        minCount: {
            type: "integer",
            title: "Minimum Count",
            description: "Minimum number of input values that must be provided.",
            nullable: true
        }
    },
    required: ["description"]
}

export const CommandOutputDescriptor: JSONSchemaType<Manifest.CommandOutputTypeDescriptor<unknown>> = {
    type: "object",
    properties: {
        description: LanguageDescription({
            type: "object",
            properties: {
                title: {
                    type: "string",
                    title: "Output Title",
                    examples: ["Documents", "Weather"],
                },
                humanDescription: {
                    type: "string",
                    title: "Human Description",
                    description: "Short description of the command output that is understandable by non-technical humans.",
                    nullable: true,
                    examples: ["List of all available documents", "Current weather in specified location"]
                },
                developerDescription: {
                    type: "string",
                    title: "Developer Description",
                    description: "Technical and more detailed description written for developers.",
                    nullable: true,
                    examples: ["Different object types based on the `type` property. See [docs](#some-docs) for more info."]
                },
                aiDescription: {
                    type: "string",
                    title: "AI Description",
                    description: "Short description of the command output that can be injected into an AI agent prompt.",
                    nullable: true,
                    examples: ["Current weather in a JSON. Format it for the user."]
                }
            },
            required: [ "title" ]
        }),
        schema: {
            type: "object",
            title: "Output JSON Schema",
            description: "JSON Schema that describes possible command output(s).",
            nullable: true,
            additionalProperties: true
        }
    },
    required: [ "description" ]
};

export const CommandDescriptor: JSONSchemaType<Manifest.CommandDescriptor> = {
    type: "object",
    properties: {
        description: LanguageDescription({
            type: "object",
            properties: {
                title: {
                    type: "string",
                    title: "Command Title",
                    examples: ["Open Customer", "Get Weather", "Crop Image", "Search Web"]
                },
                humanDescription: {
                    type: "string",
                    title: "Human Description",
                    description: "Short description of what this command do. Must be understandable by non-technical humans.",
                    nullable: true,
                    examples: ["Opens a customer card from the CRM system", "Gets the current weather in specified location", "Crops an image to specified dimensions", "Searches the web for specified query"]
                },
                developerDescription: {
                    type: "string",
                    title: "Developer Description",
                    description: "Technical and more detailed description written for developers.",
                    nullable: true,
                    examples: ["Calls the `GET /crm/customer/:id` endpoint.", "Gets the current weather using Accuweather API."]
                },
                aiDescription: {
                    type: "string",
                    title: "AI Description",
                    description: "Short description of the command that can be injected into an AI agent prompt. It can also contain usage examples.",
                    nullable: true,
                    examples: ["Open customer card from CRM system. Provide customer ID as the first input. If you don't have it, search for it using the `customers.find` command."]
                }
            },
            required: ["title"]
        }),
        endpointUri: {
            type: "string",
            title: "Endpoint URI",
            description: "URI of the command endpoint. Depends on the transport protocol. Eg. HTTP transport will use URL, AMQP transport will use queue name, etc..",
            examples: ["/customers/open", "/weather$get", "image/get", "https://some.service/api/search"]
        },
        requiredConfigProfiles: {
            type: "array",
            title: "Required Config Profiles",
            description: "List of config profiles that are required to be present in the command invocation request.",
            items: {
                type: "string"
            },
            nullable: true,
            examples: [ "oauth", "openid", "sso", "github", "user" ]
        },
        requiresUserConfirmation: {
            type: "boolean",
            title: "Requires User Confirmation",
            description: "Indicates whether the command requires user confirmation before it can be executed. Other confirmations can be still required during the command execution.",
            nullable: true
        },
        inputTypes: {
            type: "object",
            title: "Input Types",
            description: "Map of input types that are expected by the command. The key is the input name and the value is the input type descriptor.",
            additionalProperties: CommandInputDescriptor,
            required: []
        },
        outputTypes: {
            type: "object",
            title: "Output Types",
            description: "Map of output types that are returned by the command. The key is the output name and the value is the output type descriptor.",
            additionalProperties: CommandOutputDescriptor,
            required: []
        }
    },
    required: ["description", "endpointUri", "inputTypes", "outputTypes"]
};

export const ConfigProfileDescriptor: JSONSchemaType<Manifest.ConfigProfileDescriptor<unknown>> = {
    type: "object",
    properties: {
        setupUri: {
            type: "string",
            title: "Setup URI",
            description: "URI of the config profile setup endpoint where the user should be taken in order to configure the service. Depends on the transport protocol.",
            examples: ["/setup/oauth", "view:myService.configProfile", "https://some.service/user/setup"]
        },
        scope: {
            type: "string",
            title: "Scope",
            description: "Scope of the config profile. Defines in which context the profile should be stored.",
            enum: Object.values(DefinitionScope),
            examples: [DefinitionScope.Organization, DefinitionScope.User]
        },
        description: LanguageDescription({
            type: "object",
            properties: {
                label: {
                    type: "string",
                    title: "Profile Label",
                    description: "Human readable label of the config profile.",
                    examples: ["Login via GitHub", "Configure your account", "OpenID Connect", "Connect your CRM"]
                }
            },
            required: ["label"],
        }),
        schema: {
            type: "object",
            title: "Config Profile JSON Schema",
            description: "JSON Schema that describes the config profile.",
            nullable: true,
            additionalProperties: true
        }
    },
    required: ["setupUri", "scope", "description"]
};

export const TermsAndConditionsDescriptor: JSONSchemaType<Manifest.TermsAndConditionsDescriptor> = {
    type: "object",
    properties: {
        name: {
            type: "string",
            title: "Terms and Conditions Name",
            description: "Name of the terms and conditions. Must be unique within the service.",
            examples: ["terms-and-conditions", "gdpr"]
        },
        description: LanguageDescription({
            type: "object",
            properties: {
                label: {
                    type: "string",
                    title: "Terms and Conditions Label",
                    description: "Human readable label of the terms and conditions.",
                    examples: ["Terms and Conditions", "GDPR"]
                },
                url: {
                    type: "string",
                    title: "Terms and Conditions URL",
                    description: "URL of the terms and conditions document.",
                    examples: ["https://example.com/terms-and-conditions", "https://example.com/gdpr"]
                }
            },
            required: ["label", "url"]
        }),
        scope: {
            type: "string",
            title: "Scope",
            description: "Scope of the terms and conditions. Defines in which context the terms and conditions must be accepted. Eg. on the organization level by CEO, on the user level, etc..",
            enum: Object.values(DefinitionScope),
            examples: [DefinitionScope.Organization, DefinitionScope.User]
        },
        acceptanceRequired: {
            type: "boolean",
            title: "Acceptance Required",
            description: "Indicates whether the user must accept the terms and conditions before using the service."
        },
        lastModified: {
            type: "string",
            title: "Last Modified",
            description: "Date and time when the terms and conditions were last modified."
        }
    },
    required: ["name", "description", "scope", "acceptanceRequired", "lastModified"]
} as JSONSchemaType<Manifest.TermsAndConditionsDescriptor>;

export const SetupDescriptor: JSONSchemaType<Manifest.SetupDescriptor> = {
    type: "object",
    properties: {
        configProfiles: {
            type: "object",
            title: "Configuration Profiles",
            description: "List of configuration profile definitions that can be required by commands.",
            additionalProperties: ConfigProfileDescriptor,
            nullable: true,
            required: []
        },
        termsAndConditions: {
            type: "array",
            title: "Terms and Conditions",
            description: "List of terms and conditions that must be accepted by the user before using the service.",
            items: TermsAndConditionsDescriptor,
            nullable: true
        }
    },
    nullable: true
};

export const AcceptedPaymentSchemaDescriptor: JSONSchemaType<Manifest.AcceptedPaymentSchemaDescriptor> = {
    type: "object",
    properties: {
        schemaName: {
            type: "string",
            title: "Schema Name",
            description: "Name of the payment schema. See the protocol specification extension for the list of supported schemas.",
            examples: ["card", "paypal", "paypal+jwt", "lightning+lnurl", "lightning+invoice"]
        },
        options: {
            type: "object",
            title: "Schema Options",
            description: "Options of the payment schema. See the protocol specification extension for the list of supported schemas.",
            aditionalProperties: true,
            nullable: true
        }
    },
    required: ["schemaName"]
} as JSONSchemaType<Manifest.AcceptedPaymentSchemaDescriptor>;

export const ServiceManifest: JSONSchemaType<Manifest.ServiceManifest> = {
    type: "object",
    properties: {
        "@asmv": {
            type: "string",
            title: "Manifest Version",
            description: "Version of the manifest specification.",
            examples: ["1.0.0"]
        },
        serviceName: {
            type: "string",
            title: "Service Name",
            description: "Name of the service. Should be your domain name in reverse (eg. com.example.my-service).",
            examples: ["com.example.my-service", "com.example.my-service.v2"]
        },
        version: {
            type: "string",
            title: "Version",
            description: "Version of the service using the semver format.",
            examples: ["1.0.0", "2.0.0-alpha.1"]
        },
        baseUri: {
            type: "string",
            title: "Base URI",
            description: "Base URI of the service. It's prepended before command endpoints and config profile setup endpoints. Depends on the transport protocol.",
            examples: ["/services/my-service", "https://my-service.example.com"]
        },
        defaultLanguage: {
            type: "string",
            title: "Default Language",
            description: "Default language of the service specified as RFC5646 language tag (the same as HTTP is using).",
            examples: ["en", "en-US", "cs-CZ"]
        },
        description: LanguageDescription({
            type: "object",
            properties: {
                title: {
                    type: "string",
                    title: "Service Title",
                    examples: ["CRM", "Weather", "Image", "Web Search"]
                },
                humanDescription: {
                    type: "string",
                    title: "Human Description",
                    description: "Description of the service and it's capabilities. Must be understandable by non-technical humans.",
                    examples: ["This service provides access to the CRM system.", "This service provides access to the weather data."]
                },
                developerDescription: {
                    type: "string",
                    title: "Developer Description",
                    description: "Technical and more detailed description written for developers. Can reference API documentation and other technical resource.",
                    nullable: true,
                    examples: ["See the API documentation at https://example.com/api-docs"]
                },
                aiDescription: {
                    type: "string",
                    title: "AI Description",
                    description: "Short description of the service that can be injected into an AI agent prompt. It can also contain usage examples.",
                    nullable: true,
                    examples: ["Search for images of cats.", "Provides access to the CRM system. Can search for contacts, read and write activities, etc.."]
                }
            },
            required: ["title"]
        }),
        setup: {
            ...SetupDescriptor,
            nullable: true
        },
        commands: {
            type: "object",
            title: "Commands",
            description: "List of commands that the service provides.",
            additionalProperties: CommandDescriptor,
            required: []
        },
        acceptedPaymentSchemas: {
            type: "array",
            title: "Accepted Payment Schemas",
            description: "List of payment schemas that the service accepts.",
            items: AcceptedPaymentSchemaDescriptor,
            nullable: true
        }
    },
    required: [ "@asmv", "serviceName", "version", "baseUri", "defaultLanguage", "commands"]
}
