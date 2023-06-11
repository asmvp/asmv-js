/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { DefinitionScope } from "../Manifest/ManifestTypes";
import { ConfigProfile } from "./ConfigProfileDefinition";

describe("Config Profile Definition", () => {
    it("Should construct", () => {
        const myProfile = ConfigProfile<{
            myProp: string;
        }>({
            name: "myProfile",
            schema: {
                type: "object",
                properties: {
                    myProp: {
                        type: "string"
                    }
                },
                required: ["myProp"]
            },
            scope: DefinitionScope.User,
            setupUri: "https://example.com/setup",
            description: [
                {
                    lang: "en_US",
                    label: "My profile"
                }
            ]
        });

        expect(myProfile.getName()).toBe("myProfile");
        expect(myProfile.getDescriptor()).toEqual({
            schema: {
                type: "object",
                properties: {
                    myProp: {
                        type: "string"
                    }
                },
                required: ["myProp"]
            },
            scope: DefinitionScope.User,
            setupUri: "https://example.com/setup",
            description: [
                {
                    lang: "en_US",
                    label: "My profile"
                }
            ]
        });
    });

    it("Should validate data", () => {
        const myProfile = ConfigProfile<{
            myProp: string;
        }>({
            name: "myProfile",
            schema: {
                type: "object",
                properties: {
                    myProp: {
                        type: "string"
                    }
                },
                required: ["myProp"]
            },
            scope: DefinitionScope.User,
            setupUri: "https://example.com/setup",
            description: [
                {
                    lang: "en_US",
                    label: "My profile"
                }
            ]
        });

        // Valid example
        expect(myProfile.validateData({ myProp: "test" })).toMatchObject({
            valid: true,
            errors: null
        });

        // Invalid example
        const invalidResult = myProfile.validateData({ myProp: 123 });
        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.errors).not.toBeNull();
        expect(invalidResult.errors?.length).toBeGreaterThan(0);
    });
});