/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

/**
 * Context manager
 *
 * Stores contexts in-memory
 */
export class ContextManager<Context> {
    private contexts: Map<string, Context> = new Map();

    public add(key: string, context: Context) {
        this.contexts.set(key, context);
    }

    public get(key: string): Context|undefined {
        return this.contexts.get(key);
    }

    public getAll(): Context[] {
        return Array.from(this.contexts.values());
    }

    public remove(key: string) {
        this.contexts.delete(key);
    }

    public clear() {
        this.contexts.clear();
    }

    public dispose() {
        this.contexts.clear();
    }
}
