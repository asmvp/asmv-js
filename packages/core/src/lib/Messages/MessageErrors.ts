/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { ErrorObject } from "ajv";
import { MessageType } from "./MessageTypes";

export enum ErrorName {
    InvalidMessage = "InvalidMessage",
    MissingConfigProfile = "MissingConfigProfile",
    UnknownConfigProfile = "UnknownConfigProfile",
    UnknownInputType = "UnknownInputType",
    UnknownOutputType = "UnknownOutputType",
    InvalidConfigProfile = "InvalidConfigProfile",
    InvalidInput = "InvalidInput",
    InvalidOutput = "InvalidOutput",
    UnexpectedMessage = "UnexpectedMessage"
}

export class MessageError extends Error {
    public override message: string;
    public details?: unknown;
    public childErrors?: MessageError[];

    constructor(message: string) {
        super(message);
        this.message = message;
    }

    public toJSON(): object {
        return {
            name: this.name,
            message: this.message,
            details: this.details,
            childErrors: this.childErrors?.map((e) => e.toJSON())
        };
    }
}

export class InvalidMessage extends MessageError {
    override readonly name = ErrorName.InvalidMessage;

    constructor(childErrors: MessageError[]) {
        super("Message is not valid. See child errors for more information.");
        this.childErrors = childErrors;
    }
}

export class MissingConfigProfile extends MessageError {
    override readonly name = ErrorName.MissingConfigProfile;
    override readonly details: {
        profileName: string;
    };

    constructor(profileName: string) {
        super(`Configuration profile '${profileName}' is required by the command but was not provided.`);
        this.details = { profileName };
    }
}

export class UnknownConfigProfile extends MessageError {
    override readonly name = ErrorName.UnknownConfigProfile;
    override readonly details: {
        profileName: string;
    };

    constructor(profileName: string) {
        super(`Configuration profile '${profileName}' is not defined in the command.`);
        this.details = { profileName };   
    }
}

export class UnknownInputTypeError extends MessageError {
    override readonly name = ErrorName.UnknownInputType;
    override readonly details: {
        inputIndex: number;
        inputType: string;
    };

    constructor(inputIndex: number, inputType: string) {
        super(`Unknown input type '${inputType}' at element #${inputIndex}.`);
        this.details = { inputIndex, inputType };
    }
}

export class UnknownOutputTypeError extends MessageError {
    override readonly name = ErrorName.UnknownOutputType;
    override readonly details: {
        outputType: string;
    };

    constructor(outputType: string) {
        super(`Unknown output type '${outputType}'.`);
        this.details = { outputType };
    }
}

export class InvalidConfigProfile extends MessageError {
    override readonly name = ErrorName.InvalidConfigProfile;
    override readonly details: {
        profileName: string;
        errors: ErrorObject[];
    };

    constructor(profileName: string, errors: null|ErrorObject[]) {
        super(`Configuration profile '${profileName}' is not valid. See details for more information.`);
        this.details = { profileName, errors: errors ?? [] };
    }
}

export class InvalidInput extends MessageError {
    override readonly name = ErrorName.InvalidInput;
    override readonly details: {
        inputIndex: number;
        inputType: string;
        errors: ErrorObject[];
    };

    constructor(inputIndex: number, inputType: string, errors: null|ErrorObject[]) {
        super(`Failed to validate input #${inputIndex} of type '${inputType}'. See details for more information.`);
        this.details = { inputIndex, inputType, errors: errors ?? [] };
    }
}

export class InvalidOutput extends MessageError {
    override readonly name = ErrorName.InvalidOutput;
    override readonly details: {
        outputType: string;
        errors: ErrorObject[];
    };

    constructor(outputType: string, errors: null|ErrorObject[]) {
        super(`Data of output type '${outputType}' is not valid. See details for more information.`);
        this.details = { outputType, errors: errors ?? [] };
    }
}

export class UnexpectedMessage extends MessageError {
    override readonly name = ErrorName.UnexpectedMessage;

    constructor(messageType: MessageType) {
        super(`Received unexpected message of type '${messageType}'.`);
    }
}
