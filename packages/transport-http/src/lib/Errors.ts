/**
 * @package @asmv/transport-http
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { ErrorName, HttpResponseBody_Error, HttpSessionInfo } from "./HttpTypes";

export interface HttpErrorOptions {
    /** Http status code */
    httpStatus: number;
    /** Error message */
    errorName: ErrorName;
    /** Human & AI readable error message */
    message: string;
    /** Error details */
    details?: unknown;
    /** Optional service session ID */
    serviceSessionId?: string;
    /** Optional client session ID */
    clientSessionId?: string;
    /** Optional date object - defult value is current date */
    date?: Date;
}

class HttpTransportError extends Error {
    public readonly httpStatus: number;
    public override name: ErrorName;
    public readonly date: Date;
    public readonly details?: unknown;
    public readonly serviceSessionId?: string;
    public readonly clientSessionId?: string;
    public readonly nestedError?: Error;

    public constructor(options: HttpErrorOptions, nestedError?: Error) {
        super(options.message);
        this.httpStatus = options.httpStatus;
        this.name = options.errorName;
        this.details = options.details;
        this.serviceSessionId = options.serviceSessionId;
        this.clientSessionId = options.clientSessionId;
        this.date = options.date ?? new Date();
        this.nestedError = nestedError;
    }

    public toBody(verbose = false): HttpResponseBody_Error {
        return {
            httpStatus: this.httpStatus,
            errorName: this.name,
            message: this.message,
            details: this.details,
            serviceSessionId: this.serviceSessionId,
            clientSessionId: this.clientSessionId,
            date: this.date.toISOString(),
            nestedError: verbose && this.nestedError ? {
                name: this.nestedError.name,
                message: this.nestedError.message,
                stack: this.nestedError.stack
            } : undefined
        }
    }

    public static fromBody(body: HttpResponseBody_Error) {
        switch (body.errorName) {
            case ErrorName.InvalidRequest: {
                return new InvalidRequestError(body, body.details);
            }
            case ErrorName.VersionNotSupported: {
                const details = body.details as { requestedVersion: string, supportedVersions: string[] };
                return new VersionNotSupportedError(body, details.requestedVersion, details.supportedVersions);
            }
            case ErrorName.Unauthorized: {
                return new UnauthorizedError(body, body.details);
            }
            case ErrorName.Forbidden: {
                return new ForbiddenError(body, body.details);
            }
            case ErrorName.MessageBufferFull: {
                return new MessageBufferFullError(body);
            }
            case ErrorName.SessionNotFound: {
                return new SessionNotFoundError(body);
            }
            case ErrorName.CommandNotFound: {
                return new CommandNotFoundError(body);
            }
            case ErrorName.UnexpectedError: {
                let nestedError: Error|undefined;

                if (body.nestedError) {
                    const nestedError = new Error(body.nestedError?.message);
                    nestedError.name = body.nestedError.name;
                    nestedError.stack = body.nestedError.stack;
                }

                return new UnexpectedError(body, nestedError);
            }
        }
    }
}

export class InvalidRequestError extends HttpTransportError {
    public constructor(sessionInfo: HttpSessionInfo, details?: unknown) {
        super({
            ...sessionInfo,
            httpStatus: 400,
            errorName: ErrorName.InvalidRequest,
            message: "Invalid request",
            details
        });
    }
}

export class VersionNotSupportedError extends HttpTransportError {
    public constructor(sessionInfo: HttpSessionInfo, requestedVersion: string, supportedVersions: string[]) {
        super({
            ...sessionInfo,
            httpStatus: 400,
            errorName: ErrorName.VersionNotSupported,
            message: "Requested ASMV version is not supported",
            details: {
                requestedVersion,
                supportedVersions
            }
        });
    }
}

export class UnauthorizedError extends HttpTransportError {
    public constructor(sessionInfo: HttpSessionInfo, details?: unknown) {
        super({
            ...sessionInfo,
            httpStatus: 401,
            errorName: ErrorName.Unauthorized,
            message: "Unauthorized",
            details
        });
    }
}

export class ForbiddenError extends HttpTransportError {
    public constructor(sessionInfo: HttpSessionInfo, details?: unknown) {
        super({
            ...sessionInfo,
            httpStatus: 403,
            errorName: ErrorName.Forbidden,
            message: "Forbidden",
            details
        });
    }
}

export class MessageBufferFullError extends HttpTransportError {
    public constructor(sessionInfo: HttpSessionInfo) {
        super({
            ...sessionInfo,
            httpStatus: 403,
            errorName: ErrorName.MessageBufferFull,
            message: "Recipient message buffer is full. Try again later."
        });
    }
}

export class SessionNotFoundError extends HttpTransportError {
    public constructor(sessionInfo: HttpSessionInfo) {
        super({
            ...sessionInfo,
            httpStatus: 404,
            errorName: ErrorName.SessionNotFound,
            message: "Session not found"
        });
    }
}

export class CommandNotFoundError extends HttpTransportError {
    public constructor(sessionInfo: HttpSessionInfo) {
        super({
            ...sessionInfo,
            httpStatus: 404,
            errorName: ErrorName.CommandNotFound,
            message: "Command not found"
        });
    }
}

export class UnexpectedError extends HttpTransportError {
    public constructor(sessionInfo: HttpSessionInfo, nestedError?: Error) {
        super({
            ...sessionInfo,
            httpStatus: 500,
            errorName: ErrorName.UnexpectedError,
            message: "Unexpected error"
        }, nestedError);
    }
}
