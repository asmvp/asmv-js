/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

export interface RetryOptions {
    sendMessageRetries?: number;
    sendMessageRetryDelayMs?: number;
    sendMessageRetryDelayMultiplier?: number;
    sendMessageRetryMaxJitterMs?: number;
}

export const DefaultRetryOptions: RetryOptions = {
    sendMessageRetries: 3,
    sendMessageRetryDelayMs: 500,
    sendMessageRetryDelayMultiplier: 1.5,
    sendMessageRetryMaxJitterMs: 100
};

export function getRetryDelay(retry: number, opts: RetryOptions): number {
    const {
        sendMessageRetryDelayMs,
        sendMessageRetryDelayMultiplier,
        sendMessageRetryMaxJitterMs,
    } = { ...DefaultRetryOptions, ...opts } as Required<RetryOptions>;

    const jitter = Math.floor(Math.random() * sendMessageRetryMaxJitterMs);

    return Math.floor(sendMessageRetryDelayMs * (sendMessageRetryDelayMultiplier * retry)) + jitter;
}
