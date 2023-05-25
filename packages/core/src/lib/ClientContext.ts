/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { addToAsyncQueue, createAsyncQueue, createEventEmitter, emitEvent, flushAsyncQueue, removeAllEventListeners, waitForAsyncQueue } from "@asmv/utils";
import { SendMessageFunction } from "./ContextTypes";
import { MessageType } from "./Messages/MessageTypes";
import * as Message from "./Messages/MessageTypes";

export enum ClientContextStatus {
    Invoked = "invoked",
    Cancelled = "cancelled",
    Finished = "finished",
}


export class ClientContext<Channel> {
    /** Client status */
    protected status: ClientContextStatus;

    /** Instance ID */
    protected readonly channel: Channel;

    /** Function to send messages to the caller */
    protected readonly sendMessageFn: SendMessageFunction<Channel>;

    /* Events for incoming messages */
    public readonly onMessage = createEventEmitter<Message.Message>();
    public readonly onClose = createEventEmitter<void>();

    /** Incoming message queue */
    private messageQueue = createAsyncQueue<Message.Message|undefined>();

    /**
     * Client context constructor
     *
     * @param channel Instance ID
     * @param sendMessageFn Function to send message to the service
     */
    public constructor(sendMessageFn: SendMessageFunction<Channel>, channel: Channel, status: ClientContextStatus = ClientContextStatus.Invoked) {
        this.channel = channel;
        this.sendMessageFn = sendMessageFn;
        this.status = status;
    }

    /**
     * Disposes the context and cleans up all resources
     */
    public dispose() {
        flushAsyncQueue(this.messageQueue, new Error("Context was disposed"));
        removeAllEventListeners(this.onMessage);
        removeAllEventListeners(this.onClose);
    }

    /**
     * Close the context
     *
     * @param status New context status
     */
    protected close(status: ClientContextStatus) {
        this.status = status;
        emitEvent(this.onClose, undefined);
    }

    /**
     * Send message to the service
     *
     * @param message Message
     * @returns Reply
     */
    protected async sendMessage(message: Message.Message): Promise<void> {
        if (this.status !== ClientContextStatus.Invoked) {
            throw new Error("Command was not invoked or already finished.");
        }

        return this.sendMessageFn(this.channel, message);
    }

    /**
     * Handles incoming message from the service
     *
     * @param message Message
     */
    public async handleIncomingMessage(message: Message.Message): Promise<void> {
        if (this.status !== ClientContextStatus.Invoked) {
            throw new Error("Command was already finished.");
        }

        // Add message to the queue and emit event
        addToAsyncQueue(this.messageQueue, message);
        emitEvent(this.onMessage, message);

        if (message.messageType === MessageType.Return && message.close === true) {
            this.close(ClientContextStatus.Finished);
        }
    }

    /**
     * Returns an incoming message
     *
     * You can specify a timeout in milliseconds to wait for a message.
     * If the timeout is reached or the client is closed, the function returns null.
     *
     * @param waitForMs Timeout in milliseconds to wait for a message, zero = no timeout
     * @returns Incoming message
     */
    public async getMessage(waitForMs = 0): Promise<Message.Message|undefined> {
        return waitForAsyncQueue(this.messageQueue, () => true, waitForMs);
    }

    /**
     * Returns an iterator that yields messages from the service
     *
     * @returns Message iterator
     */
    public async *getMessages(): AsyncIterableIterator<Message.Message> {
        while(this.status === ClientContextStatus.Invoked) {
            const msg = await this.getMessage();

            if (msg === undefined) {
                return;
            } else {
                yield msg;
            }
        }
    }

    /**
     * Provides inputs to the command
     *
     * @param inputs Inputs
     */
    public async provideInputs(inputs: Message.CommandInputList): Promise<void> {
        await this.sendMessage({
            messageType: MessageType.ProvideInput,
            inputs: inputs
        });
    }

    /**
     * Provides user confirmation to the service
     *
     * @param req User confirmation request
     * @param confirmedBy ID of the user who confirmed the action
     */
    public async provideUserConfirmation(req: Message.RequestUserConfirmation, confirmedBy: string): Promise<void> {
        await this.sendMessage({
            messageType: MessageType.ProvideUserConfirmation,
            reqId: req.reqId,
            confirmedBy: confirmedBy
        });
    }

    /**
     * Sends payment authorization to the service
     *
     * @param req Payment request
     * @param paymentSchema Selected payment schema
     * @param paymentId Payment ID to be used for payment confirmation
     * @param token Authorization token
     */
    public async authorizePayment(req: Message.RequestPayment, paymentSchema: string, paymentId: string, token: string): Promise<void> {
        await this.sendMessage({
            messageType: MessageType.AuthorizePayment,
            reqId: req.reqId,
            paymentId: paymentId,
            paymentSchema: paymentSchema,
            amount: req.amount,
            currency: req.currency,
            token: token
        });
    }

    /**
     * Cancels the command
     */
    public async cancel(): Promise<void> {
        await this.sendMessage({
            messageType: MessageType.Cancel
        });

        this.close(ClientContextStatus.Cancelled);
    }
}
