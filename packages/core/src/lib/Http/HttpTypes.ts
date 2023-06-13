/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

export enum ErrorName {
    /* Shared errors */
    InvalidRequest = "InvalidRequest",
    VersionNotSupported = "VersionNotSupported",
    Unauthorized = "Unauthorized",
    Forbidden = "Forbidden",
    MessageBufferFull = "MessageBufferFull",
    SessionNotFound = "SessionNotFound",
    UnexpectedError = "UnexpectedError",
    /* Service errors */
    CommandNotFound = "CommandNotFound"
}

export interface RequestHeaders_Base {
    /** Protocol version using semver */
    "x-asmv-version": string;
    /** Authorization header */
    "authorization"?: string;
}

export interface ResponseHeaders_Base {
    /** Protocol version using semver */
    "x-asmv-version": string;
}

export interface RequestHeaders_InvokeCommand extends RequestHeaders_Base {
    /** Client channel ID */
    "x-asmv-client-channel-id": string;
    /** Client channel URL */
    "x-asmv-client-channel-url": string;
    /** Client channel token */
    "x-asmv-client-channel-token": string;
}

export interface ResponseHeaders_InvokeCommand extends ResponseHeaders_Base {
    /** Service channel ID */
    "x-asmv-service-channel-id": string;
    /** Service channel URL */
    "x-asmv-service-channel-url": string;
    /** Service channel token */
    "x-asmv-service-channel-token": string;
}

export interface RequestHeaders_SendMessage extends RequestHeaders_Base {
    /** Client channel ID */
    "x-asmv-client-channel-id": string;
    /** Service channel ID */
    "x-asmv-service-channel-id": string;
}

export interface ResponseHeaders_SendMessage extends ResponseHeaders_Base {
    /** Client channel token - if client wants to change it */
    "x-asmv-client-channel-token"?: string;
    /** Service channel token - if service wants to change it */
    "x-asmv-service-channel-token"?: string;
}

export interface ChannelInfo {
    /** Service channel ID */
    serviceChannelId?: string;
    /** Client channel ID */
    clientChannelId?: string;
}

export interface ResponseBody_Error extends ChannelInfo {
    /** Http status code */
    httpStatus: number;
    /** Error message */
    errorName: ErrorName;
    /** Human & AI readable error message */
    message: string;
    /** Error details */
    details?: unknown;
    /** ISO 8601 date string */
    date: string;
    /** Optional nested error */
    nestedError?: {
        name: string;
        message: string;
        stack?: string;
    }
}

export type ClientChannel = {
    clientChannelUrl: string;
    clientChannelToken: string;
    clientChannelId: string;
}

export type ServiceChannel = {
    serviceChannelUrl: string;
    serviceChannelToken: string;
    serviceChannelId: string;
}

export type Channel = ClientChannel & ServiceChannel & {
    protocolVersion: string;
}

export function isResponseBodyError(body: unknown): body is ResponseBody_Error {
    return (
        typeof body === "object" && body !== null &&
        "httpStatus" in body && typeof body["httpStatus"] === "number" &&
        "errorName" in body && typeof body["errorName"] === "string" &&
        "message" in body && typeof body["message"] === "string" &&
        "date" in body && typeof body["date"] === "string"
    );
}
