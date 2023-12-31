/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";
import { CommandInputDescriptor } from "../Manifest/ManifestSchemas";
import * as Messages from "./MessageTypes";

export const CommandInput: JSONSchemaType<Messages.CommandInput> = {
    type: "object",
    properties: {
        inputType: {
            type: "string"
        },
        value: {} as JSONSchemaType<unknown>
    },
    required: ["inputType", "value"]
}

export const CommandOutput: JSONSchemaType<Messages.CommandOutput> = {
    type: "object",
    properties: {
        returnType: {
            type: "string",
            enum: [Messages.CommandReturnType.Output]
        },
        outputType: {
            type: "string"
        },
        data: {} as JSONSchemaType<unknown>,
        summary: {
            type: "string",
            nullable: true
        }
    },
    required: ["returnType", "outputType"]
} as JSONSchemaType<Messages.CommandOutput>;

export const CommandError: JSONSchemaType<Messages.CommandError> = {
    type: "object",
    properties: {
        returnType: {
            type: "string",
            enum: [Messages.CommandReturnType.Error]
        },
        errorName: {
            type: "string"
        },
        description: {
            type: "string"
        },
        data: {} as JSONSchemaType<unknown>
    },
    required: ["returnType", "errorName", "description"]
} as JSONSchemaType<Messages.CommandError>;

export const CommandReturnItem: JSONSchemaType<Messages.CommandReturnItem> = {
    oneOf: [
        CommandOutput,
        CommandError
    ]
};

export const Invoke: JSONSchemaType<Messages.Invoke> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.Invoke]
        },
        configProfiles: {
            type: "object",
            additionalProperties: true
        },
        inputs: {
            type: "array",
            items: CommandInput
        },
        userConfirmation: {
            type: "object",
            properties: {
                confirmedBy: {
                    type: "string"
                }
            },
            required: ["confirmedBy"],
            nullable: true
        },
    },
    required: ["messageType", "configProfiles", "inputs"]
};

export const RequestInput: JSONSchemaType<Messages.RequestInput> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.RequestInput]
        },
        inputs: {
            type: "object",
            additionalProperties: CommandInputDescriptor,
            required: []
        }
    },
    required: ["messageType", "inputs"]
};

export const ProvideInput: JSONSchemaType<Messages.ProvideInput> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.ProvideInput]
        },
        inputs: {
            type: "array",
            items: CommandInput
        },
        seq: {
            type: "number",
            nullable: true
        }
    },
    required: ["messageType", "inputs"]
};

export const Return: JSONSchemaType<Messages.Return> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.Return]
        },
        items: {
            type: "array",
            items: CommandReturnItem,
        },
        close: {
            type: "boolean"
        },        
        seq: {
            type: "number",
            nullable: true
        }
    },
    required: ["messageType", "items", "close"]
};

export const Cancel: JSONSchemaType<Messages.Cancel> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.Cancel]
        }
    },
    required: ["messageType"]
};

export const RequestUserConfirmation: JSONSchemaType<Messages.RequestUserConfirmation> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.RequestUserConfirmation]
        },
        reqId: {
            type: "string"
        },
        reason: {
            type: "string",
            nullable: true
        }
    },
    required: ["messageType", "reqId"]
};

export const ProvideUserConfirmation: JSONSchemaType<Messages.ProvideUserConfirmation> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.ProvideUserConfirmation]
        },
        reqId: {
            type: "string"
        },
        confirmedBy: {
            type: "string"
        }
    },
    required: ["messageType", "reqId", "confirmedBy"]
};

export const RequestPayment: JSONSchemaType<Messages.RequestPayment> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.RequestPayment]
        },
        reqId: {
            type: "string"
        },
        acceptedPaymentSchemas: {
            type: "array",
            items: {
                type: "string"
            }
        },
        amount: {
            type: "number"
        },
        currency: {
            type: "string"
        },
        description: {
            type: "string"
        }
    },
    required: ["messageType", "reqId", "acceptedPaymentSchemas", "amount", "currency", "description"]
};

export const AuthorizePayment: JSONSchemaType<Messages.AuthorizePayment> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.AuthorizePayment]
        },
        reqId: {
            type: "string"
        },
        paymentId: {
            type: "string"
        },
        paymentSchema: {
            type: "string"
        },
        paymentData: {} as JSONSchemaType<unknown>,
        amount: {
            type: "number"
        },
        currency: {
            type: "string"
        },
        token: {
            type: "string"
        }
    },
    required: ["messageType", "reqId", "paymentId", "paymentSchema", "amount", "currency", "token"]
} as JSONSchemaType<Messages.AuthorizePayment>;

export const RejectPayment: JSONSchemaType<Messages.RejectPayment> = {
    type: "object",
    properties: {
        messageType: {
            type: "string",
            enum: [Messages.MessageType.RejectPayment]
        },
        reqId: {
            type: "string"
        },
        reason: {
            type: "string",
            nullable: true
        }
    },
    required: ["messageType", "reqId"]
};

export const Message: JSONSchemaType<Messages.Message> = {
    oneOf: [
        Invoke,
        RequestInput,
        ProvideInput,
        Return,
        Cancel,
        RequestUserConfirmation,
        ProvideUserConfirmation,
        RequestPayment,
        AuthorizePayment,
        RejectPayment
    ]
};

export function compileValidators(): {
    Invoke: ValidateFunction<Messages.Invoke>,
    RequestInput: ValidateFunction<Messages.RequestInput>,
    ProvideInput: ValidateFunction<Messages.ProvideInput>,
    ReturnOutput: ValidateFunction<Messages.Return>,
    Cancel: ValidateFunction<Messages.Cancel>,
    RequestUserConfirmation: ValidateFunction<Messages.RequestUserConfirmation>,
    ProvideUserConfirmation: ValidateFunction<Messages.ProvideUserConfirmation>,
    RequestPayment: ValidateFunction<Messages.RequestPayment>,
    AuthorizePayment: ValidateFunction<Messages.AuthorizePayment>,
    RejectPayment: ValidateFunction<Messages.RejectPayment>,
    Message: ValidateFunction<Messages.Message>
} {
    const ajv = new Ajv();
    return {
        Invoke: ajv.compile(Invoke),
        RequestInput: ajv.compile(RequestInput),
        ProvideInput: ajv.compile(ProvideInput),
        ReturnOutput: ajv.compile(Return),
        Cancel: ajv.compile(Cancel),
        RequestUserConfirmation: ajv.compile(RequestUserConfirmation),
        ProvideUserConfirmation: ajv.compile(ProvideUserConfirmation),
        RequestPayment: ajv.compile(RequestPayment),
        AuthorizePayment: ajv.compile(AuthorizePayment),
        RejectPayment: ajv.compile(RejectPayment),
        Message: ajv.compile(Message)
    }
}
