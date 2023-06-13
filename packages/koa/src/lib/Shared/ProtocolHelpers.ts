/**
 * @package @asmv/koa
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { ValidateFunction } from "ajv";
import { ParameterizedContext, DefaultState, DefaultContext, Next, Context } from "koa";
import { satisfies, coerce } from "semver";
import Router from "@koa/router";
import { HttpErrors, Http, MessageSchema, Message, MessageErrors, MessageTransportError } from "@asmv/core";
import axios, { AxiosError, AxiosResponse } from "axios";

export const SUPPORTED_ASMV_VERSIONS = [ "1.x" ];
export const supportedSemverVersions = SUPPORTED_ASMV_VERSIONS.join(" || ");

export const messageValidators = MessageSchema.compileValidators();

export type RouterKoaContext = ParameterizedContext<
DefaultState, 
DefaultContext
    & Router.RouterParamContext<
    DefaultState, 
    DefaultContext>, unknown>
    & {
        asmvVersion: string;
        channelInfo: Http.ChannelInfo;
    };

// export type RouterKoaContextWithChannelInfo = RouterKoaContext & {
//     asmvVersion: string;
//     channelInfo: Http.ChannelInfo;
// };

export function getHttpHeaderOrThrow<IsRequired extends boolean>(ctx: RouterKoaContext, headerName: string, required: IsRequired): IsRequired extends true ? string : string | undefined {
        const headerValue = ctx.headers[headerName];
    
        if (required && !headerValue) {
            throw new HttpErrors.InvalidRequestError({}, {
                reason: `Missing HTTP header '${headerName}'.`
            });
        }

        if (!required && !headerValue) {
            return undefined as IsRequired extends true ? string : string | undefined;
        }

        if (Array.isArray(headerValue)) {
            throw new HttpErrors.InvalidRequestError({}, {
                reason: `HTTP header '${headerName}' can be specified only once.`
            });
        }
    
        return headerValue as IsRequired extends true ? string : string | undefined;
}

export function getPathParameterOrThrow<IsRequired extends boolean>(ctx: RouterKoaContext, paramName: string, required: IsRequired): IsRequired extends true ? string : string | undefined {
    const paramValue = ctx.params[paramName];

    if (required && !paramValue) {
        throw new HttpErrors.InvalidRequestError({}, {
            reason: `Missing URL path parameter '${paramName}'.`
        });
    }

    if (!required && !paramValue) {
        return undefined as IsRequired extends true ? string : string | undefined;
    }

    return paramValue as IsRequired extends true ? string : string | undefined;
}

export function getValidBodyOrThrow<Body>(ctx: RouterKoaContext, validator: ValidateFunction<Body>): Body {
    if (!ctx.request.body) {
        throw new HttpErrors.InvalidRequestError(ctx.channelInfo ?? {}, {
            reason: `Missing request body.`
        });
    }

    if (!validator(ctx.request.body)) {
        throw new HttpErrors.InvalidRequestError(ctx.channelInfo ?? {}, {
            reason: `Invalid request body.`,
            details: validator.errors
        });
    }

    return ctx.request.body;
}

export function checkProtocolVersion(supportedVersions: string[]) {
    return async (ctx: RouterKoaContext, next: Next): Promise<void> => {
        const protocolVersion = coerce(getHttpHeaderOrThrow(ctx, "x-asmv-protocol-version", true));

        if (!protocolVersion) {
            throw new HttpErrors.InvalidRequestError({}, {
                reason: `Protocol version is not a valid semver string.`
            });
        }

        if (!satisfies(protocolVersion, supportedSemverVersions)) {
            throw new HttpErrors.VersionNotSupportedError(ctx.channelInfo ?? {}, protocolVersion.format(), supportedVersions)
        }

        ctx.asmvVersion = protocolVersion.format();
        return next();
    }
}

export function parseChannelInfo() {
    return async (ctx: RouterKoaContext, next: Next): Promise<void> => {
        const clientChannelId = getHttpHeaderOrThrow(ctx, "x-asmv-client-channel-id", false) ?? ctx.params["clientChannelId"];
        const serviceChannelId = getHttpHeaderOrThrow(ctx, "x-asmv-service-channel-id", false) ?? ctx.params["serviceChannelId"];

        ctx.channelInfo = {
            clientChannelId: clientChannelId,
            serviceChannelId: serviceChannelId
        };

        return next();
    }
}

export function handleProtocolErrors() {
    return async (ctx: Context, next: Next): Promise<void> => {
        try {
            return await next();
        } catch (err) {
            let returnError: HttpErrors.HttpTransportError;

            const channelInfo = (ctx as RouterKoaContext).channelInfo;

            if (err instanceof HttpErrors.HttpTransportError) {
                returnError = err;
            } else if (err instanceof MessageErrors.MessageError) {
                returnError = new HttpErrors.InvalidRequestError(channelInfo ?? {}, err.toJSON());
            } else if (err instanceof Error) {
                returnError = new HttpErrors.UnexpectedError(channelInfo ?? {}, err);
            } else {
                returnError = new HttpErrors.UnexpectedError(channelInfo ?? {}, new Error(String(err)));
            }

            ctx.status = returnError.httpStatus;
            ctx.body = returnError.toBody(true);
        }
    }
}

function transformAxiosError(err: unknown): MessageTransportError|HttpErrors.HttpTransportError {
    if (err instanceof AxiosError) {
        let canRetry = true;

        if (err.response && err.response.status >= 400 && err.response.status < 500) {
            canRetry = false;
        }

        if (err.response?.data && Http.isResponseBodyError(err.response.data)) {
            return HttpErrors.HttpTransportError.fromBody(err.response.data);
        }

        return new MessageTransportError(`Request failed with status code ${err.response?.status ?? "unknown"}.`, canRetry, {
            request: {
                url: err.config?.url,
                method: err.config?.method,
                headers: err.config?.headers,
            },
            response: {
                status: err.response?.status,
                headers: err.response?.headers
            }
        });
    } else {
        return new MessageTransportError("Unexpected error. See nested error for more details.", false, err);
    }
}

export async function sendMessageToClient(channel: Http.Channel, message: Message.Message): Promise<void> {
    try {
        await axios.post(channel.clientChannelUrl, message, {
            headers: {
                "x-asmv-protocol-version": channel.protocolVersion,
                "x-asmv-client-channel-id": channel.clientChannelId,
                "authorization": channel.clientChannelToken ? `Bearer ${channel.clientChannelToken}` : undefined,
            }
        });
    } catch (err) {
        throw transformAxiosError(err);
    }
}

export async function sendInvokeMessageToService(channel: Http.ClientChannel, protocolVersion: string, endpointUrl: string, message: Message.Invoke): Promise<AxiosResponse> {
    try {
        return await axios.post(endpointUrl, message, {
            headers: {
                "x-asmv-protocol-version": protocolVersion,
                "x-asmv-client-channel-id": channel.clientChannelId,
                "x-asmv-client-channel-url": channel.clientChannelUrl,
                "x-asmv-client-channel-token": channel.clientChannelToken
            }
        });
    } catch (err) {
        throw transformAxiosError(err);
    }
}

export async function sendMessageToService(channel: Http.Channel, message: Message.Message): Promise<void> {
    try {
        await axios.post(channel.serviceChannelUrl, message, {
            headers: {
                "x-asmv-protocol-version": channel.protocolVersion,
                "x-asmv-service-channel-id": channel.serviceChannelId,
                "authorization": channel.serviceChannelToken ? `Bearer ${channel.serviceChannelToken}` : undefined,
            }
        });
    } catch (err) {
        throw transformAxiosError(err);
    }
}
