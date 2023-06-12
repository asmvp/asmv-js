/**
 * @package @asmv/utils
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { addToAsyncQueue, createAsyncQueue, flushAsyncQueue, getFromAsyncQueue, removeAsyncQueueConsumer, waitForAsyncQueue } from "./AsyncQueue";

describe("Async Queue", () => {
    it("Should call callback immediatelly when item is available", (done) => {
        const queue = createAsyncQueue<string>();
        let firstConsumerCalled = false;

        addToAsyncQueue(queue, "one");

        getFromAsyncQueue(queue, () => {
            firstConsumerCalled = true;
            return false;
        });

        expect(queue.items.length).toBe(1);
        expect(queue.consumers.length).toBe(1);

        getFromAsyncQueue(queue, (err, item) => {
            expect(err).toBeUndefined();
            expect(item).toBe("one");
            expect(firstConsumerCalled).toBe(true);

            setTimeout(() => {
                expect(queue.items.length).toBe(0);
                expect(queue.consumers.length).toBe(2);
                done();
            }, 1);

            return true;
        });
    });

    it("Should add message to the queue when no consumer is avilable", () => {
        const queue = createAsyncQueue<string>();

        addToAsyncQueue(queue, "one");

        expect(queue.items.length).toBe(1);
        expect(queue.consumers.length).toBe(0);
    });

    it("Should call callback when an item is available", (done) => {
        const queue = createAsyncQueue<string>();

        getFromAsyncQueue(queue, (err, item) => {
            expect(err).toBeUndefined();
            expect(item).toBe("one");

            setTimeout(() => {
                expect(queue.items.length).toBe(0);
                expect(queue.consumers.length).toBe(1);
                done();
            }, 1);

            return true;
        });

        addToAsyncQueue(queue, "one");
    });

    it("Should remove a consumer", () => {
        const queue = createAsyncQueue<string>();
        let consumerCalled = false;

        const consumer = () => {
            consumerCalled = true;
            return true;
        };

        getFromAsyncQueue(queue, consumer);
        removeAsyncQueueConsumer(queue, consumer);

        addToAsyncQueue(queue, "one");
        expect(consumerCalled).toBe(false);
    });

    it("Should flush queue without passing error to the consumers", () => {
        const queue = createAsyncQueue<string|undefined>();
        let consumerCalled = false;

        const consumer = () => {
            consumerCalled = true;
            return true;
        };

        getFromAsyncQueue(queue, consumer);
        flushAsyncQueue(queue);

        expect(consumerCalled).toBe(false);
        expect(queue.items.length).toBe(0);
        expect(queue.consumers.length).toBe(0);
    });

    it("Should flush queue and pass error to the consumers", (done) => {
        const queue = createAsyncQueue<string|undefined>();


        const consumer = (err: unknown, item: string|undefined) => {
            expect(err).toBe("error");
            expect(item).toBeUndefined();

            setTimeout(() => {
                expect(queue.items.length).toBe(0);
                expect(queue.consumers.length).toBe(0);
                done();
            }, 1)

            return false;
        };

        getFromAsyncQueue(queue, consumer);
        flushAsyncQueue(queue, "error");
    });

    it("Should resolve promise immediatelly when item is available", async () => {
        const queue = createAsyncQueue<string>();

        addToAsyncQueue(queue, "one");

        const item = await waitForAsyncQueue(queue, () => true, 0);

        expect(item).toBe("one");
        expect(queue.items.length).toBe(0);
        expect(queue.consumers.length).toBe(0);
    });

    it("Should resolve promise when an item is available", async () => {
        const queue = createAsyncQueue<string>();

        const promise = waitForAsyncQueue(queue, () => true, 0);

        addToAsyncQueue(queue, "one");

        const item = await promise;

        expect(item).toBe("one");
        expect(queue.items.length).toBe(0);
        expect(queue.consumers.length).toBe(0);
    });

    it("Should resolve promise with undefined if timeout is negative and no item is available", async () => {
        const queue = createAsyncQueue<string>();

        const item = await waitForAsyncQueue(queue, () => true, -1);
        expect(item).toBeUndefined();
    });

    it("Should resolve promise with undefined after timeout", async () => {
        const queue = createAsyncQueue<string>();

        const item = await waitForAsyncQueue(queue, () => true, 10);
        expect(item).toBeUndefined();
    });

    it("Should reject promise when flushed with an error", async () => {
        const queue = createAsyncQueue<string|undefined>();

        const promise = waitForAsyncQueue(queue, () => true, 0);
        flushAsyncQueue(queue, "error");

        // Check if promise is rejected
        await expect(promise).rejects.toBe("error");
    });
});
