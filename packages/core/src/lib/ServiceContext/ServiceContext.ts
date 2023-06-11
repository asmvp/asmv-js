/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { MessageType } from "../Messages/MessageTypes";
import { CommandInputTypeDescriptor, CommandInputTypeDescriptorMap } from "../Manifest/ManifestTypes";
import * as Message from "../Messages/MessageTypes";
import { SendMessageFunction } from "../ContextTypes";
import { createEventEmitter, emitEvent, createAsyncQueue, addToAsyncQueue, waitForAsyncQueue, flushAsyncQueue, removeAllEventListeners } from "@asmv/utils";
import { v4 as uuid_v4 } from "uuid";
import { CommandDefinition } from "../Definitions/CommandDefinition";
import * as MessageErrors from "../Messages/MessageErrors";
import { ValidationError } from "../Shared/SchemaValidation";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServiceContextOptions {
    validateReturnTypes?: boolean;
}

const DefaultServiceContextOptions: ServiceContextOptions = {
    validateReturnTypes: true
};

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
    configProfiles: Message.ConfigProfiles;
    state: object;
    messageQueue?: Array<Message.Message>;
    inputQueue?: Array<Message.CommandInput>;
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
    State extends ServiceContextStateDefault
> = (ctx: ServiceContext<Channel, State>) => Promise<void>;

/**
 * Service context
 */
export class ServiceContext<
    Channel,
    State extends ServiceContextStateDefault
> {
    /** Function to send messages to the caller */
    protected readonly sendMessageFn: SendMessageFunction<Channel>;

    /** Command definition instance */
    protected readonly commandDefinition: CommandDefinition;

    /** Context options */
    protected readonly opts: ServiceContextOptions;

    /** Channel data */
    public readonly channel: Channel;

    /** Context status */
    private status: ServiceContextStatus;

    /** Context state */
    public state: State;

    /** List of default accepted payment schemas */
    public acceptedPaymentSchemas: string[] = [];

    /** Configuration profiles */
    private configProfiles = {} as Message.ConfigProfiles;

    /** Message queue */
    private incomingMessageQueue = createAsyncQueue<Message.Message|undefined>();

    /** Input buffer - stores received inputs */
    private inputQueue = createAsyncQueue<Message.CommandInput>();

    /** Buffer of messages to send in the next cycle */
    private returnBuffer: Array<Message.CommandReturnItem> = [];

    /* Events for incoming messages */
    public readonly onMessage = createEventEmitter<Message.Message>();
    public readonly onCancel = createEventEmitter<void>();
    public readonly onSuspend = createEventEmitter<void>();
    public readonly onFinish = createEventEmitter<void>();

    /**
     * Context constructor
     *
     * @param sendMessageFn Function to send message back to the client
     * @param opts Context options
     * @param commandDefinition Command definition instance
     * @param channel Channel ID
     * @param serializedState Optional serialized state of the previous context run
     */
    public constructor(
        sendMessageFn: SendMessageFunction<Channel>,
        opts: ServiceContextOptions,
        commandDefinition: CommandDefinition,
        channel: Channel,
        serializedState?: ServiceContextSerializedState
    ) {
        this.sendMessageFn = sendMessageFn;
        this.opts = { ...DefaultServiceContextOptions, ...opts };
        this.commandDefinition = commandDefinition;
        this.channel = channel;

        if (serializedState) {
            this.status = serializedState.status;
            this.state = serializedState.state as State;

            if (serializedState.messageQueue) {
                this.incomingMessageQueue.items = serializedState.messageQueue;
            }

            if (serializedState.inputQueue) {
                this.inputQueue.items = serializedState.inputQueue;
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

                        const errors: MessageErrors.MessageError[] = [];

                        // Validate config profiles
                        const requiredConfigProfiles = this.commandDefinition.getRequiredConfigProfiles();

                        for (let i = 0; i < requiredConfigProfiles.length; i++) {
                            const configProfileDef = requiredConfigProfiles[i];
                            const configProfileName = configProfileDef.getName();

                            if (!message.configProfiles[configProfileName]) {
                                errors[errors.length] = new MessageErrors.MissingConfigProfile(configProfileName);
                                continue;
                            }

                            const configProfileData = message.configProfiles[configProfileName];
                            const { valid, errors: validationErrors } = configProfileDef.validateData(configProfileData);

                            if (!valid) {
                                errors[errors.length] = new MessageErrors.InvalidConfigProfile(configProfileName, validationErrors);
                                continue;
                            }

                            this.configProfiles[configProfileName] = configProfileData;
                        }

                        // Validate inputs
                        this.validateInputsAndAddErrors(errors, message.inputs);

                        // Check if there are any errors
                        if (errors.length > 0) {
                            reject(new MessageErrors.InvalidMessage(errors));
                            return;
                        }

                        // Set status to active
                        this.status = ServiceContextStatus.Active;

                        // IMPORTANT: Resolve now to avoid outer loop of client->service waiting for the promise
                        resolve();

                        // Provide inputs
                        this.addInputListToBuffer(message.inputs);

                        if (message.userConfirmation) {
                            addToAsyncQueue(this.incomingMessageQueue, {
                                messageType: MessageType.ProvideUserConfirmation,
                                confirmedBy: message.userConfirmation.confirmedBy,
                                reqId: ""
                            });
                        }

                        break;
                    }

                    case MessageType.ProvideInput: {
                        if (this.status !== ServiceContextStatus.Active) {
                            reject(new Error("Cannot handle message because the context is not active anymore. It was either suspended, cancelled or finished."));
                            return;
                        }

                        const errors: MessageErrors.MessageError[] = [];

                        // Validate inputs
                        this.validateInputsAndAddErrors(errors, message.inputs);

                        // Check if there are any errors
                        if (errors.length > 0) {
                            reject(new MessageErrors.InvalidMessage(errors));
                            return;
                        }

                        resolve();
                        this.addInputListToBuffer(message.inputs);
                        emitEvent(this.onMessage, message);
                        break;
                    }

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
     * Validates inputs and throws if invalid
     * WARNING: This method adds errors in-place to the provided array
     *
     * @param inputs Input list
     */
    public validateInputsAndAddErrors(errors: MessageErrors.MessageError[], inputs: Message.CommandInputList): void {
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];

            if (!this.commandDefinition.hasInputType(input.inputType)) {
                errors[errors.length] = new MessageErrors.UnknownInputTypeError(i, input.inputType);
                continue;
            }

            const { valid, errors: validationErrors } = this.commandDefinition.validateInput(input.inputType, input.value);

            if (!valid) {
                errors[errors?.length] = new MessageErrors.InvalidInput(i, input.inputType, validationErrors);
            }
        }
    }

    /**
     * Adds inputs from a messenge to the input buffer
     *
     * @param inputs 
     */
    public addInputListToBuffer(inputs: Message.CommandInputList): void {
        for (let i = 0; i < inputs.length; i++) {
            addToAsyncQueue(this.inputQueue, inputs[i]);
        }
    }

    /**
     * Returns serialized state of the command handler
     *
     * @param serializeInputQueue If to serialize input queue
     * @param serializeMessageQueue If to serialize message queue
     * @returns Serialized state
     */
    public serialize(serializeInputQueue = true, serializeMessageQueue = true): ServiceContextSerializedState {
        return {
            status: this.status,
            configProfiles: {
                ...this.configProfiles
            },
            state: this.state,
            messageQueue: serializeMessageQueue
                ? this.incomingMessageQueue.items.filter((item) => item !== undefined) as Message.Message[]
                : undefined,
            inputQueue: serializeInputQueue
                ? this.inputQueue.items.filter((item) => item !== undefined) as Message.CommandInput[]
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
            await this.sendMessage({
                messageType: MessageType.Return,
                items: returnBuffer,
                close: close
            } as Message.Return);
        } catch (err) {
            this.returnBuffer = this.returnBuffer.concat(returnBuffer);
            throw err;
        }
    }

    /**
     * Returns config profile by name
     *
     * @param name Config profile name
     * @returns Config profile
     */
    public getConfigProfile<T>(name: string): T {
        if (!this.commandDefinition.doesRequireConfigProfile(name)) {
            throw new Error(`Config profile '${name}' is not required by the command.`);
        }

        return this.configProfiles[name] as T;
    }

    /**
     * Request additional input from the agent
     *
     * @param inputs Input specification
     */
    public async sendInputRequest(inputs: CommandInputTypeDescriptorMap): Promise<void> {
        await this.sendMessage({
            messageType: MessageType.RequestInput,
            inputs: inputs
        } as Message.RequestInput);
    }

    /**
     * Pulls input from queue or requests it from the agent
     *
     * @param type Input type
     * @param descriptor Input descriptor
     * @param waitTimeoutMs Timeout in milliseconds to wait for the input
     * @returns List of inputs
     */
    public async getInputs<T>(type: string, count = 1, waitTimeoutMs = 300000): Promise<T[]> {
        const inputType = this.commandDefinition.getInputType(type);

        if (inputType === undefined) {
            throw new Error(`Input type '${type}' is not defined in the command definition.`);
        }

        const result: T[] = [];
        let isWaiting = false;

        while(result.length < count) {
            // Try to get input from the queue
            const reply = await waitForAsyncQueue(
                this.inputQueue,
                (item) => item?.inputType === type,
                isWaiting ? waitTimeoutMs : -1
            ) as Message.CommandInput|undefined;

            if (isWaiting && reply === undefined) {
                throw new Error(`Timeout waiting for input type ${type}.`);
            }

            // Process input
            if (reply !== undefined) {
                result[result.length] = reply.value as T;
                isWaiting = false;
                continue;
            }

            // Else try to request input from the agent
            await this.sendInputRequest({
                [type]: {
                    ...inputType.descriptor,
                    minCount: count - result.length
                } as CommandInputTypeDescriptor<unknown>
            });

            isWaiting = true;
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
     * @param outputType Output type
     * @param data Data
     * @param summary Human & AI readable summary of the data
     */
    public returnData(outputType: string, data: unknown, summary?: string) {
        // Validate data
        if (this.opts.validateReturnTypes) {
            if (!this.commandDefinition.hasOutputType(outputType)) {
                throw new Error(`Output type '${outputType}' is not defined in the command definition.`);
            }

            const { valid, errors } = this.commandDefinition.validateOutput(outputType, data);

            if (!valid) {
                throw new ValidationError(errors, `Output data of type '${outputType}' are not valid.`);
            }
        }

        this.returnBuffer.push({
            returnType: Message.CommandReturnType.Output,
            outputType: outputType,
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
            returnType: Message.CommandReturnType.Error,
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
     * Returns current context status
     *
     * @returns Context status
     */
    public getStatus(): ServiceContextStatus {
        return this.status;
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