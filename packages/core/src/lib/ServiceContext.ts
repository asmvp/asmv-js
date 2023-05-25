/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { MessageType } from "./Messages/MessageTypes";
import { CommandInputTypeDescriptor } from "./Manifest/ManifestTypes";
import * as Message from "./Messages/MessageTypes";
import { SendMessageFunction } from "./ContextTypes";
import { createEventEmitter, emitEvent, createAsyncQueue, addToAsyncQueue, waitForAsyncQueue, flushAsyncQueue, removeAllEventListeners } from "@asmv/utils";
import { v4 as uuid_v4 } from "uuid";

/**
 * Service context status
 */
export enum ServiceContextStatus {
    Initialized = "initialized",
    Active = "active",
    Suspended = "suspended",
    Cancelled = "cancelled",
    Finished = "finished"
}

/**
 * Service context serialized state
 */
export interface ServiceContextSerializedState {
    status: ServiceContextStatus;
    state: object;
    messageQueue?: Array<Message.Message>;
}

/**
 * Payment request options
 */
export interface TPaymentRequestOptions {
    /** Requested amount */
    amount: number;
    /** Payment currency */
    currency: string;
    /** Payment description */
    description: string;
    /** Accepted payment schemas - if undefined, context default schemas will be used */
    acceptedPaymentSchemas?: string[];
}

/**
 * User confirmation request object
 */
export interface UserConfirmationRequest {
    reqId: string;
}

/**
 * User confirmation confirmed object
 */
export interface UserConfirmationConfirmed {
    reqId: string;
    confirmedBy: string;
}

/**
 * Payment authorization request object
 */
export interface PaymentAuthorizationRequest {
    reqId: string;
    acceptedPaymentSchemas: string[];
    amount: number;
    currency: string;
    description: string;
}

/**
 * Payment authorization accepted object
 */
export interface PaymentAuthorizationAccepted {
    paymentId: string;
    paymentSchema: string;
    currency: string;
    maxAmount: number;
    token: string;
}

/**
 * Service context default state
 */
export type ServiceContextStateDefault = object;

/**
 * Functions that handles the service call
 */
export type ServiceCommandHandler<
    Channel,
    ConfigProfiles extends Message.ConfigProfiles,
    State extends ServiceContextStateDefault
> = (ctx: ServiceContext<Channel, ConfigProfiles, State>) => Promise<void>;

/**
 * Service context
 */
export class ServiceContext<
    Channel,
    ConfigProfiles extends Message.ConfigProfiles,
    State extends ServiceContextStateDefault
> {
    /** Context status */
    private status: ServiceContextStatus;

    /** Configuration profiles */
    public configProfiles: ConfigProfiles = {} as ConfigProfiles;

    /** Context state */
    public state: State;

    /** List of default accepted payment schemas */
    public acceptedPaymentSchemas: string[] = [];

    /** Message queues */
    private incomingMessageQueue = createAsyncQueue<Message.Message|undefined>();

    /** Buffer of messages to send in the next cycle */
    private returnBuffer: Message.CommandOutput[] = [];

    /** Channel data */
    protected readonly channel: Channel;

    /** Function to send messages to the caller */
    protected readonly sendMessageFn: SendMessageFunction<Channel>;

    /* Events for incoming messages */
    public readonly onMessage = createEventEmitter<Message.Message>();
    public readonly onCancel = createEventEmitter<void>();
    public readonly onSuspend = createEventEmitter<void>();
    public readonly onFinish = createEventEmitter<void>();

    /**
     * Context constructor
     *
     * @param sendMessageFn Function to send message back to the client
     * @param channel Instance ID
     * @param serializedState Optional serialized state of the previous context run
     */
    public constructor(
        sendMessageFn: SendMessageFunction<Channel>,
        channel: Channel,
        serializedState?: ServiceContextSerializedState
    ) {
        this.sendMessageFn = sendMessageFn;
        this.channel = channel;

        if (serializedState) {
            this.status = serializedState.status;
            this.state = serializedState.state as State;

            if (serializedState.messageQueue) {
                this.incomingMessageQueue.items = serializedState.messageQueue;
            }
        } else {
            this.status = ServiceContextStatus.Initialized;
            this.state = {} as State;
        }
    }

    /**
     * Disposes the context and cleans up all resources
     */
    public dispose() {
        flushAsyncQueue(this.incomingMessageQueue, new Error("Context was disposed"));
        removeAllEventListeners(this.onMessage);
        removeAllEventListeners(this.onCancel);
        removeAllEventListeners(this.onSuspend);
        removeAllEventListeners(this.onFinish);
    }

    /**
     * Cancels the context
     */
    public cancel() {
        flushAsyncQueue(this.incomingMessageQueue, new Error("Context was cancelled"));
        emitEvent(this.onCancel, undefined);
        this.status = ServiceContextStatus.Cancelled;

    }

    /**
     * Send message to the caller
     *
     * @param message Message
     * @returns Reply
     */
    protected async sendMessage(message: Message.Message): Promise<void> {
        if (this.status !== ServiceContextStatus.Active) {
            throw new Error("Context is not active anymore. It was either suspended, cancelled or finished.");
        }

        return this.sendMessageFn(this.channel, message);
    }

    /**
     * Handles incoming message from the workspace
     *
     * @param message Message
     */
    public handleIncomingMessage(message: Message.Message): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                switch (message.messageType) {
                    case MessageType.Invoke: {
                        if (this.status !== ServiceContextStatus.Initialized) {
                            reject(new Error("Cannot handle invoke message because the command was already invoked."));
                            return;
                        }

                        this.configProfiles = message.configProfiles as ConfigProfiles;
                        this.status = ServiceContextStatus.Active;
                        resolve();

                        addToAsyncQueue(this.incomingMessageQueue, {
                            messageType: MessageType.ProvideInput,
                            inputs: message.inputs
                        });

                        if (message.userConfirmation) {
                            addToAsyncQueue(this.incomingMessageQueue, {
                                messageType: MessageType.ProvideUserConfirmation,
                                confirmedBy: message.userConfirmation.confirmedBy,
                                reqId: null
                            });
                        }

                        break;
                    }

                    case MessageType.ProvideInput:
                    case MessageType.ProvideUserConfirmation:
                    case MessageType.AuthorizePayment:
                    case MessageType.RejectPayment: {
                        if (this.status !== ServiceContextStatus.Active) {
                            reject(new Error("Cannot handle message because the context is not active anymore. It was either suspended, cancelled or finished."));
                            return;
                        }

                        resolve();
                        addToAsyncQueue(this.incomingMessageQueue, message);
                        emitEvent(this.onMessage, message);
                        break;
                    }
    
                    case MessageType.Cancel: {
                        if (this.status !== ServiceContextStatus.Active) {
                            reject(new Error("Cannot handle message because the context is not active anymore. It was either suspended, cancelled or finished."));
                            return;
                        }

                        resolve();
                        this.cancel();
                        break;
                    }
    
                    default: {
                        reject(new Error("Invalid message type"));
                    }
                }
            } finally {
                // Flush the return buffer if not finished yet
                if (this.status === ServiceContextStatus.Active && this.returnBuffer.length > 0) {
                    this.sendReturnBuffer(false);
                }
            }
        });
    }

    /**
     * Returns serialized state of the command handler
     *
     * @returns Serialized state
     */
    public serialize(serializeMessageQueue = true): ServiceContextSerializedState {
        return {
            status: this.status,
            state: this.state,
            messageQueue: serializeMessageQueue
                ? this.incomingMessageQueue.items.filter((item) => item !== undefined) as Message.Message[]
                : undefined
        };
    }

    /**
     * Sends return buffer to the caller
     *
     * @param close If to close the channel
     */
    protected async sendReturnBuffer(close = false): Promise<void> {
        // Use double-buffering
        const returnBuffer = this.returnBuffer.slice();
        this.returnBuffer = [];

        try {
            this.sendMessage({
                messageType: MessageType.Return,
                outputs: returnBuffer,
                close: close
            } as Message.Return);
        } catch (err) {
            this.returnBuffer = this.returnBuffer.concat(returnBuffer);
            throw err;
        }
    }

    /**
     * Request additional input from the agent
     *
     * @param inputs Input specification
     */
    public async sendInputRequest<InputType>(inputs: CommandInputTypeDescriptor<InputType>[]): Promise<void> {
        await this.sendMessage({
            messageType: MessageType.RequestInput,
            inputs: inputs
        } as Message.RequestInput);
    }

    public async getInputs(inputs: CommandInputDescriptor[], waitTimeoutMs = 300000): Promise<Message.CommandInputList> {
        const result: Message.CommandInputList = [];
        let isFirstRun = true;
        let remainingInputs = inputs.slice();

        while(remainingInputs.length > 0) {
            const reply = await waitForAsyncQueue(
                this.incomingMessageQueue,
                (item) => item?.messageType === MessageType.ProvideInput,
                isFirstRun ? -1 : waitTimeoutMs
            ) as Message.ProvideInput|undefined;

            if (!isFirstRun && reply === undefined) {
                throw new Error("Timeout waiting for arguments");
            }

            if (reply !== undefined) {
                result.push(...reply.inputs);
            }

            remainingInputs = inputs.slice(result.length);
            isFirstRun = false;

            if (remainingInputs.length > 0) {
                await this.sendInputRequest(remainingInputs);
            }
        }

        return result;
    }

    /**
     * Request user confirmation from the workspace toc continue
     *
     * @param reason Optional reason
     */
    public async sendUserConfirmationRequest(reason?: string): Promise<UserConfirmationRequest> {
        const reqId = uuid_v4();

        await this.sendMessage({
            messageType: MessageType.RequestUserConfirmation,
            reqId: reqId,
            reason: reason
        } as Message.RequestUserConfirmation);

        return {
            reqId: reqId
        }
    }

    /**
     * Request user confirmation wait for the response from the caller
     *
     * @param reason Optional reason
     * @param waitTimeoutMs Wait timeout in milliseconds
     * @returns Confirmation message
     */
    public async requestUserConfirmation(reason?: string, waitTimeoutMs = 300000): Promise<UserConfirmationConfirmed> {
        const req = await this.sendUserConfirmationRequest(reason);
        const res = await waitForAsyncQueue(
            this.incomingMessageQueue,
            (item: Message.Message|undefined) => item?.messageType === MessageType.ProvideUserConfirmation && item.reqId === req.reqId,
            waitTimeoutMs
        ) as Message.ProvideUserConfirmation|undefined;

        if (res === undefined) {
            throw new Error("Timeout while waiting for user confirmation.");
        }

        return {
            reqId: res.reqId,
            confirmedBy: res.confirmedBy
        }
    }

    /**
     * Request payment authorization from the workspace
     *
     * @param options Payment request options
     * @reutrn Payment authorization request object
     */
    public async sendPaymentRequest(options: TPaymentRequestOptions): Promise<PaymentAuthorizationRequest> {
        const reqId = uuid_v4();

        await this.sendMessage({
            messageType: MessageType.RequestPayment,
            reqId: reqId,
            description: options.description,
            amount: options.amount,
            currency: options.currency,
            acceptedPaymentSchemas: options.acceptedPaymentSchemas ?? this.acceptedPaymentSchemas
        } as Message.RequestPayment);

        return {
            reqId: reqId,
            amount: options.amount,
            currency: options.currency,
            description: options.description,
            acceptedPaymentSchemas: options.acceptedPaymentSchemas ?? this.acceptedPaymentSchemas
        };
    }

    /**
     * Request payment authorization from the workspace and wait for the response from the caller
     *
     * @param options Payment request options
     * @param waitTimeoutMs Wait timeout in milliseconds
     * @returns Payment authorization object
     * @throws Error if payment is rejected
     */
    public async requestPayment(options: TPaymentRequestOptions, waitTimeoutMs = 300000): Promise<PaymentAuthorizationAccepted> {
        const req = await this.sendPaymentRequest(options);
        const res = await waitForAsyncQueue(
            this.incomingMessageQueue,
            (item: Message.Message|undefined) => (
                item?.messageType === MessageType.AuthorizePayment ||
                item?.messageType === MessageType.RejectPayment
            ) && item.reqId === req.reqId,
            waitTimeoutMs
        ) as Message.AuthorizePayment|Message.RejectPayment|undefined;

        if (res === undefined) {
            throw new Error("Timeout while waiting for payment authorization.");
        }

        if (res.messageType === MessageType.AuthorizePayment) {
            return {
                paymentId: res.paymentId,
                paymentSchema: res.paymentSchema,
                maxAmount: req.amount,
                currency: res.currency,
                token: res.token,
            };
        } else {
            throw new PaymentRejectedError(req, res.reason);
        }
    }

    /**
     * Return data from the command
     *
     * @param data Data
     * @param summary Human & AI readable summary of the data
     */
    public returnData(data: unknown, summary?: string) {
        this.returnBuffer.push({
            type: Message.CommandOutputType.Data,
            data: data,
            summary: summary
        });
    }

    /**
     * Returns error from the command
     *
     * @param errorName Error name
     * @param description Human & AI readable description
     * @param data Additional data
     */
    public returnError(errorName: string, description: string, data?: unknown) {
        this.returnBuffer.push({
            type: Message.CommandOutputType.Error,
            errorName: errorName,
            description: description,
            data: data
        });
    }

    /**
     * Finishes the command execution
     */
    public async finish() {
        await this.sendReturnBuffer(true);
        this.status = ServiceContextStatus.Finished;
        emitEvent(this.onFinish, undefined);
    }

    /**
     * Suspends the command execution - it's up to the handler owner to resume it
     */
    public async suspend() {
        if (this.returnBuffer.length > 0) {
            this.sendReturnBuffer(false);
        }

        this.status = ServiceContextStatus.Suspended;
        emitEvent(this.onSuspend, undefined);
    }

    /**
     * Returns current context state
     *
     * @returns Context state
     */
    public getState(): State {
        return this.state;
    }

    /**
     * Sets context state
     *
     * @param state Context state
     */
    public setState(state: State): void {
        this.state = state;
    }

    /**
     * Returns current context status
     *
     * @returns Context status
     */
    public getStatus(): ServiceContextStatus {
        return this.status;
    }

    /**
     * Returns current context channel
     *
     * @returns Context channel
     */
    public getChannel(): Channel {
        return this.channel;
    }
}

/**
 * Error thrown when payment is rejected
 */
export class PaymentRejectedError extends Error {
    constructor(public authRequest: PaymentAuthorizationRequest, public reason?: string) {
        super(`Payment rejected: ${reason || "Reason not provided"}`);
        this.name = "PaymentRejectedError";
    }
}