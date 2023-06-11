/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { ErrorObject } from "ajv";
import { ValidationError } from "../Shared/SchemaValidation";

export enum ErrorName {
    InvalidMessage = "InvalidMessage",
    MissingConfigProfile = "MissingConfigProfile",
    UnknownConfigProfile = "UnknownConfigProfile",
    UnknownInputType = "UnknownInputType",
    UnknownOutputType = "UnknownOutputType",
    InvalidConfigProfile = "InvalidConfigProfile",
    InvalidInput = "InvalidInput",
    InvalidOutput = "InvalidOutput",
}

export interface MessageError {
    /** Error message */
    name: ErrorName;
    /** Human & AI readable error message */
    message: string;
    /** Detailed error description */
    details?: unknown;
    /** Child errros */
    childErrors?: MessageError[];
}

export class InvalidMessage extends Error implements MessageError {
    override readonly name = ErrorName.InvalidMessage;
    public readonly childErrors: MessageError[];

    constructor(childErrors: MessageError[]) {
        super("Message is not valid. See child errors for more information.");
        this.childErrors = childErrors;
    }
}

export class MissingConfigProfile extends Error implements MessageError {
    override readonly name = ErrorName.MissingConfigProfile;
    public readonly details: {
        profileName: string;
    };

    constructor(profileName: string) {
        super(`Configuration profile '${profileName}' is required by the command but was not provided.`);
        this.details = { profileName };
    }
}

export class UnknownConfigProfile extends Error implements MessageError {
    override readonly name = ErrorName.UnknownConfigProfile;
    public readonly details: {
        profileName: string;
    };

    constructor(profileName: string) {
        super(`Configuration profile '${profileName}' is not defined in the command.`);
        this.details = { profileName };   
    }
}

export class UnknownInputTypeError extends Error implements MessageError {
    override readonly name = ErrorName.UnknownInputType;
    public readonly details: {
        inputIndex: number;
        inputType: string;
    };

    constructor(inputIndex: number, inputType: string) {
        super(`Unknown input type '${inputType}' at element #${inputIndex}.`);
        this.details = { inputIndex, inputType };
    }
}

export class UnknownOutputTypeError extends Error implements MessageError {
    override readonly name = ErrorName.UnknownOutputType;
    public readonly details: {
        outputType: string;
    };

    constructor(outputType: string) {
        super(`Unknown output type '${outputType}'.`);
        this.details = { outputType };
    }
}

export class InvalidConfigProfile extends Error implements MessageError {
    override readonly name = ErrorName.InvalidConfigProfile;
    public readonly details: {
        profileName: string;
        errors: ErrorObject[];
    };

    constructor(profileName: string, errors: null|ErrorObject[]) {
        super(`Configuration profile '${profileName}' is not valid. See details for more information.`);
        this.details = { profileName, errors: errors ?? [] };
    }
}

export class InvalidInput extends ValidationError implements MessageError {
    override readonly name = ErrorName.InvalidInput;
    public readonly details: {
        inputIndex: number;
        inputType: string;
        errors: ErrorObject[];
    };

    constructor(inputIndex: number, inputType: string, errors: null|ErrorObject[]) {
        super(errors, `Failed to validate input #${inputIndex} of type '${inputType}'. See details for more information.`);
        this.details = { inputIndex, inputType, errors: errors ?? [] };
    }
}

export class InvalidOutput extends ValidationError implements MessageError {
    override readonly name = ErrorName.InvalidOutput;
    public readonly details: {
        outputType: string;
        errors: ErrorObject[];
    };

    constructor(outputType: string, errors: null|ErrorObject[]) {
        super(errors, `Data of output type '${outputType}' is not valid. See details for more information.`);
        this.details = { outputType, errors: errors ?? [] };
    }
}
