/**
 * @package @asmv/utils
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

export type SerializableData =
  | null
  | string
  | number
  | boolean
  | Array<SerializableData>
  | { [K: string]: SerializableData };

export type TypeEquals<T, S> = [T] extends [S]
  ? [S] extends [T]
    ? true
    : false
  : false;

export type CancellablePromise<T> = Promise<T> & {
  cancel: (rejectWith?: unknown) => void;
};
