/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

/**
 * Async queue consumer callback
 * If the callback returns true, the message is removed from the queue
 */
export type TAsyncQueueConsumer<T> = (err: unknown, item: T) => boolean;

/**
 * Interface representing an async queue object
 */
export interface TAsyncQueue<T> {
    items: T[];
    consumers: TAsyncQueueConsumer<T>[];
}

/**
 * Creates new async queue object
 *
 * @returns Async queue object
 */
export function createAsyncQueue<T>(): TAsyncQueue<T> {
    return {
        items: [],
        consumers: []
    };
}

/**
 * Adds item to async queue
 *
 * @param queue Queue object
 * @param item Item to add
 */
export function addToAsyncQueue<T>(queue: TAsyncQueue<T>, item: T): void {
    // If we have a consumers waiting, send the item directly to them,
    // otherwise push the item to the queue
    if (queue.consumers.length > 0) {
        for (let i = 0; i < queue.consumers.length; i++) {
            const consumer = queue.consumers[i];
            const accepted = consumer(undefined, item);

            if (accepted) {
                return;
            }
        }
    }

    queue.items.push(item);
}

/**
 * Calls callback with item from the queue when available
 * If the item is available immediately, the callback is called immediately.
 *
 * @param queue Queue object
 * @param callback Callback to call with the item
 */
export function getFromAsyncQueue<T>(queue: TAsyncQueue<T>, callback: TAsyncQueueConsumer<T>): void {
    queue.consumers.push(callback);

    // Try to call consumer immediatelly if there are items in the queue
    if (queue.items.length > 0) {
        queue.items = queue.items.filter((item) => {
            const accepted = callback(undefined, item);
            return !accepted;
        });
    }
}

/**
 * Removes consumer from the queue
 *
 * @param queue Queue object
 * @param callback Consumer callback to remove
 */
export function removeAsyncQueueConsumer<T>(queue: TAsyncQueue<T>, callback: TAsyncQueueConsumer<T>): void {
    const index = queue.consumers.indexOf(callback);

    if (index !== -1) {
        queue.consumers.splice(index, 1);
    }
}

/**
 * Removes all messages and consumers from the queue.
 * If the error argument is provided, all consumers are called with the error.
 * 
 * @param queue 
 * @param error 
 */
export function flushAsyncQueue<T>(queue: TAsyncQueue<T|undefined>, error?: unknown): void {
    const consumers = queue.consumers;

    queue.items = [];
    queue.consumers = [];

    if (error !== undefined) {
        for (let i = 0; i < consumers.length; i++) {
            consumers[i](error, undefined);
        }
    }
}

export async function waitForAsyncQueue<T>(queue: TAsyncQueue<T>, acceptFn: (item: T) => boolean, waitForMs = 0): Promise<T|undefined> {
    const item = queue.items.shift();

    if (item !== undefined) {
        return item;
    }

    if (waitForMs < 0) {
        return undefined;
    }

    return new Promise<T|undefined>((resolve, reject) => {
        let wasFinalized = false;
        let timer: NodeJS.Timeout | undefined = undefined;

        const consumer = (err: unknown, item: T) => {
            if (wasFinalized) {
                return false;
            }

            if (err !== undefined) {
                finalize();
                reject(err);
                return false;
            }

            const accepted = acceptFn(item);

            if (accepted) {
                finalize();
                resolve(item);
                return true;
            } else {
                return false;
            }
        };

        const finalize = () => {
            if (timer) {
                clearTimeout(timer);
            }
    
            removeAsyncQueueConsumer(queue, consumer);
            wasFinalized = true;
        };

        getFromAsyncQueue(queue, consumer);

        if (waitForMs) {
            timer = setTimeout(() => {
                finalize();
                resolve(undefined);
            }, waitForMs);
        }
    });
}