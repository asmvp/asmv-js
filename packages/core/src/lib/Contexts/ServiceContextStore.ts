/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { SerializableData } from "@asmv/utils";
import { ServiceContextSerializedState } from "./ServiceContext";

export interface ServiceContextStoreEntry {
    channel: SerializableData;
    state: ServiceContextSerializedState;
}

/**
 * Service context store interface
 *
 * Context store is used to persist state of suspended contexts
 */
export interface ServiceContextStore {
    /**
     * Store context
     *
     * @param key Context key
     * @param contextState Context state
     */
    store: (key: string, channel: SerializableData, state: ServiceContextSerializedState) => Promise<void>;
    /**
     * Get context state from store
     * @param key Context key
     * @returns Context state or undefined if not found
     */
    get: (key: string) => Promise<ServiceContextStoreEntry | undefined>;
    /**
     * Delete context from store
     *
     * @param key Context key
     */
    delete: (key: string) => Promise<void>;
}

/**
 * Simple in-memory context store implementation
 */
export class MemoryServiceContextStore implements ServiceContextStore {
    private contexts: Map<string, ServiceContextStoreEntry> = new Map();

    public async store(key: string, channel: SerializableData, state: ServiceContextSerializedState): Promise<void> {
        this.contexts.set(key, {
            channel,
            state
        });
    }

    public async get(key: string): Promise<ServiceContextStoreEntry | undefined> {
        return this.contexts.get(key);
    }

    public async delete(key: string): Promise<void> {
        this.contexts.delete(key);
    }

    public dispose() {
        this.contexts.clear();
    }
}