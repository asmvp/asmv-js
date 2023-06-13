/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

export class MessageTransportError extends Error {
    public readonly canRetry: boolean;
    public readonly nestedError: unknown;

    public constructor(message: string, canRetry: boolean, nestedError: unknown) {
        super(message);
        
        this.canRetry = canRetry;
        this.nestedError = nestedError;
    }
}

export class SendMessageError extends Error {
    public readonly channel: unknown;
    public readonly retries: number;
    public readonly nestedError: unknown;

    public constructor(message: string, channel: unknown, retries: number, nestedError: unknown) {
        super(message);

        this.channel = channel;
        this.retries = retries;
        this.nestedError = nestedError;
    }
}
