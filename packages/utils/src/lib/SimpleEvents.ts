/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

export type TSimpleEventListener<TEventData> = (eventData: TEventData) => void;
export type TSimpleEventEmitter<TEventData> = Array<
  TSimpleEventListener<TEventData>
>;

export type TGetSimpleEventEmitterDataType<TEmitter> =
  TEmitter extends TSimpleEventEmitter<infer R> ? R : undefined;

/**
 * Creates a simple event emitter
 */
export function createEventEmitter<
  TEventData = undefined
>(): TSimpleEventEmitter<TEventData> {
  return [];
}

/**
 * Adds an event listener to emitter
 *
 * @param eventEmitter Simple event emitter
 * @param listener Listener function
 */
export function onEvent<TEventData = undefined>(
  eventEmitter: TSimpleEventEmitter<TEventData>,
  listener: TSimpleEventListener<TEventData>
): void {
  eventEmitter.push(listener);
}

/**
 * Removes an event listener from emitter
 *
 * @param eventEmitter Simple event emitter
 * @param listener Listener function
 */
export function offEvent<TEventData = undefined>(
  eventEmitter: TSimpleEventEmitter<TEventData>,
  listener: TSimpleEventListener<TEventData>
): void {
  const i = eventEmitter.indexOf(listener);

  if (i >= 0) {
    eventEmitter.splice(i, 1);
  }
}

/**
 * Removes an event listener from emitter
 *
 * @param eventEmitter Simple event emitter
 * @param listener Listener function
 */
export function onceEvent<TEventData = undefined>(
  eventEmitter: TSimpleEventEmitter<TEventData>,
  listener: TSimpleEventListener<TEventData>
): void {
  const eventHandler = (eventData: TEventData) => {
    try {
      listener(eventData);
    } finally {
      const i = eventEmitter.indexOf(eventHandler);

      if (i >= 0) {
        eventEmitter.splice(i, 1);
      }
    }
  };

  eventEmitter.push(eventHandler);
}

/**
 * Removes all listeners from an emitter
 *
 * @param eventEmitter Simple event emitter
 */
export function removeAllEventListeners(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventEmitter: TSimpleEventEmitter<any>
): void {
  eventEmitter.splice(0, eventEmitter.length);
}

/**
 * Emits event on an event emitter
 *
 * @param eventEmitter Simple event emitter
 * @param eventData Event data
 */
export function emitEvent<TEventData = undefined>(
  eventEmitter: TSimpleEventEmitter<TEventData>,
  eventData: TEventData
): void {
  const _events = eventEmitter.slice();

  for (let i = 0; i < _events.length; i++) {
    _events[i](eventData);
  }
}
