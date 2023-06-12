/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { SerializableData } from "@asmv/utils";
import { CommandInputTypeDescriptorMap } from "../Manifest/ManifestTypes";

/**
 * Message type
 */
export enum MessageType {
    Invoke = "Invoke" ,
    RequestInput = "RequestInput",
    ProvideInput = "ProvideInput",
    Return = "Return",
    Cancel = "Cancel",
    RequestUserConfirmation = "ReqUserConfirmation",
    ProvideUserConfirmation = "ProvideUserConfirmation",
    RequestPayment = "RequestPayment",
    AuthorizePayment = "AuthorizePayment",
    RejectPayment = "RejectPayment"
}

/**
 * Command argument object
 */
export interface CommandInput {
    inputType: string;
    value: SerializableData;
}

/** List of command inputs */
export type CommandInputList = CommandInput[];

export enum CommandReturnType {
    Output = "Output",
    Error = "Error"
}

/**
 * Command return value for output
 */
export interface CommandOutput {
    returnType: CommandReturnType.Output;
    outputType: string;
    data?: unknown;
    summary?: string;
}

/**
 * Command return value for error
 */
export interface CommandError {
    returnType: CommandReturnType.Error;
    errorName: string;
    description: string;
    data?: unknown;
}

/*
 * Command return value union
 */
export type CommandReturnItem = CommandOutput | CommandError;

/** Command configuration profiles */
export type ConfigProfiles = Record<string, unknown>;

/*
 * Message: Invoke
 */
export interface Invoke {
    messageType: MessageType.Invoke;
    /** Configuration profiles */
    configProfiles: ConfigProfiles;
    /** Initial inputs */
    inputs: CommandInputList;
    /** User confirmation */
    userConfirmation?: {
        confirmedBy: string;
    }
}

/*
 * Message: Request arguments
 */
export interface RequestInput {
    messageType: MessageType.RequestInput;
    inputs: CommandInputTypeDescriptorMap;
}

/*
 * Message: Provider arguments
 */
export interface ProvideInput {
    messageType: MessageType.ProvideInput;
    /** Provided inputs */
    inputs: CommandInputList;
    /** Sequence number to preserve ordering */
    seq?: number;
}

/*
 * Message: Return Data
 */
export interface Return {
    messageType: MessageType.Return;
    /** Returned outputs */
    items: CommandReturnItem[];
    /** If this was a final message and command execution is now terminated */
    close: boolean;
    /** Sequence number to preserve ordering */
    seq?: number;
}

/*
 * Message: Cancel
 */
export interface Cancel {
    messageType: MessageType.Cancel;
}

/*
 * Message: Request user confirmation
 */
export interface RequestUserConfirmation {
    messageType: MessageType.RequestUserConfirmation;
    reqId: string;
    reason?: string;
}

/*
 * Message: Provide user confirmation
 */
export interface ProvideUserConfirmation {
    messageType: MessageType.ProvideUserConfirmation;
    reqId: string;
    confirmedBy: string;
}

/*
 * Message: Request payment
 */
export interface RequestPayment {
    messageType: MessageType.RequestPayment;
    /** Request ID unique to the service - used for correlation */
    reqId: string;
    /** Accepted payment schemas. Schemas are describing the transaction mechanism. */
    acceptedPaymentSchemas: string[];
    /** Requested amount */
    amount: number;
    /** Currency code */
    currency: string;
    /** Payment description */
    description: string;
}

/*
 * Message: Authorize payment
 */
export interface AuthorizePayment {
    messageType: MessageType.AuthorizePayment;
    /** Request ID unique to the service - used for correlation */
    reqId: string;
    /** Unique payment ID - used together with token in a process payment request */
    paymentId: string;
    /** The payment schema selected by the client */
    paymentSchema: string;
    /** Payment schema dependend data */
    paymentData?: SerializableData;
    /** Requested amount */
    amount: number;
    /** Currency code */
    currency: string;
    /** Payment authorization token */
    token: string;
}

/*
 * Message: Reject payment
 */
export interface RejectPayment {
    messageType: MessageType.RejectPayment;
    /** Request ID unique to the service - used for correlation */
    reqId: string;
    /** Optional reason my be provided by the caller */
    reason?: string;
}

/**
 * Union interface for the protocol messages
 */
export type Message =
    Invoke |
    RequestInput |
    ProvideInput |
    Return |
    Cancel |
    RequestUserConfirmation |
    ProvideUserConfirmation |
    RequestPayment |
    AuthorizePayment |
    RejectPayment;
