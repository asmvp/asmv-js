/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { DefinitionScope } from "../Manifest/ManifestTypes";
import { CommandDefinition } from "./CommandDefinition";
import { ConfigProfile, ConfigProfileDefinition } from "./ConfigProfileDefinition";
import { ServiceDefinition, ServiceUriResolver } from "./ServiceDefinition";

describe("Service Definition", () => {
    const uriResolver: ServiceUriResolver = {
        getBaseUri: () => "https://my.service.tld",
        getCommandEndpointUri: (commandName: string) => `https://my.service.tld/invoke/${commandName}`
    }

    const testConfigProfile = ConfigProfile<string>({
        name: "testProfile",
        schema: {
            type: "string"
        },
        scope: DefinitionScope.User,
        setupUri: "https://example.com/setup",
        description: []
    });

    it("Should create service definition", () => {
        const svc = new ServiceDefinition({
            serviceName: "myService",
            version: "1.0.0",
            defaultLanguage: "en_US",
            description: [],
            commands: [
                new CommandDefinition({
                    name: "myCommand",
                    description: []
                })
            ]
        });

        expect(svc.getManifest(uriResolver)).toMatchObject({
            serviceName: "myService",
            version: "1.0.0",
            defaultLanguage: "en_US",
            description: [],
            baseUri: "https://my.service.tld",
            acceptedPaymentSchemas: [],
            commands: {
                "myCommand": {
                    description: [],
                    endpointUri: "https://my.service.tld/invoke/myCommand",
                    requiredConfigProfiles: [],
                    requiresUserConfirmation: false,
                    inputTypes: {},
                    outputTypes: {}
                }
            }
        });
    });

    it("Should add command inc. required config profiles", () => {
        const svc = new ServiceDefinition({
            serviceName: "myService",
            version: "1.0.0",
            defaultLanguage: "en_US",
            description: [],
            commands: []
        });
        
        svc.addCommand(new CommandDefinition({
            name: "myCommand",
            description: [],
            requiredConfigProfiles: [ testConfigProfile as ConfigProfileDefinition<unknown> ]
        }));

        expect(svc.getManifest(uriResolver)).toMatchObject({
            serviceName: "myService",
            version: "1.0.0",
            defaultLanguage: "en_US",
            description: [],
            baseUri: "https://my.service.tld",
            setup: {
                configProfiles: {
                    testProfile: {
                        schema: {
                            type: "string"
                        },
                        scope: DefinitionScope.User,
                        setupUri: "https://example.com/setup",
                        description: []
                    }
                }
            },
            acceptedPaymentSchemas: [],
            commands: {
                "myCommand": {
                    description: [],
                    endpointUri: "https://my.service.tld/invoke/myCommand",
                    requiredConfigProfiles: [ "testProfile" ],
                    requiresUserConfirmation: false,
                    inputTypes: {},
                    outputTypes: {}
                }
            }
        });
    });
});