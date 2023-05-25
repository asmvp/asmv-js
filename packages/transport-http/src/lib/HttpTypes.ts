/**
 * @package @asmv/transport-http
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
    /** Client session ID */
    "x-asmv-client-session-id"?: string;
    /** Client callback URL */
    "x-asmv-client-callback-url": string;
    /** Client callback token */
    "x-asmv-client-callback-token"?: string;
}

export interface ResponseHeaders_InvokeCommand extends ResponseHeaders_Base {
    /** Service session ID */
    "x-asmv-service-session-id"?: string;
    /** Service callback URL */
    "x-asmv-service-callback-url": string;
    /** Service callback token */
    "x-asmv-service-callback-token"?: string;
}

export interface RequestHeaders_SendMessage extends RequestHeaders_Base {
    /** Client session ID */
    "x-asmv-client-session-id"?: string;
    /** Service session ID */
    "x-asmv-service-session-id"?: string;
}

export interface ResponseHeaders_SendMessage extends ResponseHeaders_Base {
    /** Client callback token - if client wants to change it */
    "x-asmv-client-callback-token"?: string;
    /** Service callback token - if service wants to change it */
    "x-asmv-service-callback-token"?: string;
}

export interface HttpSessionInfo {
    /** Service session ID */
    serviceSessionId?: string;
    /** Client session ID */
    clientSessionId?: string;
}

export interface HttpResponseBody_Error extends HttpSessionInfo {
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
