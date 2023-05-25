/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

export type TSerializableData =
  | null
  | string
  | number
  | boolean
  | Array<TSerializableData>
  | { [K: string]: TSerializableData };

export type TypeEquals<T, S> = [T] extends [S]
  ? [S] extends [T]
    ? true
    : false
  : false;

export type TCancellablePromise<T> = Promise<T> & {
  cancel: (rejectWith?: unknown) => void;
};