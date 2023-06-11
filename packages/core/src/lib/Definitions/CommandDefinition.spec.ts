/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { DefinitionScope } from "../Manifest/ManifestTypes";
import { CommandDefinition } from "./CommandDefinition";
import { ConfigProfile } from "./ConfigProfileDefinition";

describe("Command Definition", () => {
    it("Should create command definition", () => {
        const myConfigProfile = ConfigProfile<{
            myProp: string;
        }>({
            name: "myProfile",
            scope: DefinitionScope.User,
            setupUri: "https://example.com/setup",
            description: []
        });

        const command = new CommandDefinition({
            name: "myCommand",
            description: [
                {
                    lang: "en_US",
                    title: "My command",
                    humanDescription: "My command description",
                    aiDescription: "My command AI description",
                    developerDescription: "My command developer description"
                }
            ]
        });

        command.requireConfigProfile(myConfigProfile);
        command.requireUserConfirmation();

        command.addInputType<string>("name", {
            schema: {
                type: "string"
            },
            description: [
                {
                    lang: "en_US",
                    title: "Name"
                }
            ],
            minCount: 1,
            required: true
        });

        command.addOutputType<string>("result", {
            schema: {
                type: "string"
            },
            description: [
                {
                    lang: "en_US",
                    title: "Result"
                }
            ]
        });

        expect(command.getName()).toBe("myCommand");

        expect(command.getDescriptor("test://test")).toEqual({
            description: [
                {
                    lang: "en_US",
                    title: "My command",
                    humanDescription: "My command description",
                    aiDescription: "My command AI description",
                    developerDescription: "My command developer description"
                }
            ],
            inputTypes: {
                name: {
                    schema: {
                        type: "string"
                    },
                    description: [
                        {
                            lang: "en_US",
                            title: "Name"
                        }
                    ],
                    minCount: 1,
                    required: true
                }
            },
            outputTypes: {
                result: {
                    schema: {
                        type: "string"
                    },
                    description: [
                        {
                            lang: "en_US",
                            title: "Result"
                        }
                    ]
                }
            },
            requiredConfigProfiles: ["myProfile"],
            requiresUserConfirmation: true,
            endpointUri: "test://test"
        });
    });
});