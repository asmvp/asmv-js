/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { offEvent, onEvent, TSimpleEventEmitter } from './SimpleEvents';

/**
 * Returns a promise that resolves after specified timeout
 *
 * @param timeoutMs Timeout in milliseconds
 */
export async function waitMsAsync(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

/**
 * Returns a promise that rejects if callback is called with a first argument which represents an error
 *
 * @param fn Initial function - you will recieve a callback in an argument that you can pass to an "async" function.
 */
export async function wrapCallback(
  fn: (cb: (err: unknown) => void) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cb = (err: unknown) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    fn(cb);
  });
}

export function waitForEvent<Data>(
  emitter: TSimpleEventEmitter<Data>,
  timeoutMs = 0
): Promise<Data> {
  return new Promise((resolve, reject) => {
    let wasFinalized = false;
    let timer: NodeJS.Timeout | undefined = undefined;

    const handleEvent = (data: Data) => {
      if (wasFinalized) {
        return;
      }

      finalize();
      resolve(data);
    };

    const finalize = () => {
      if (timer) {
        clearTimeout(timer);
      }

      offEvent(emitter, handleEvent);
      wasFinalized = true;
    };

    onEvent(emitter, handleEvent);

    if (timeoutMs) {
      timer = setTimeout(() => {
        finalize();
        reject(new Error('Waiting for event has timed out.'));
      }, timeoutMs);
    }
  });
}
