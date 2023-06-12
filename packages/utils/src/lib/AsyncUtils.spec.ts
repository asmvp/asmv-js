/**
 * @package @asmv/utils
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import { createEventEmitter, emitEvent } from './SimpleEvents';
import { waitForEvent } from './AsyncUtils';

describe('Async Utils', () => {
  it('waitForEvent() should resolve when an event is emitted once', async () => {
    const event = createEventEmitter<string>();

    setTimeout(() => {
      emitEvent(event, 'hello');
    }, 10);

    setTimeout(() => {
      emitEvent(event, 'hello');
    }, 15);

    const res = await waitForEvent(event);
    expect(res).toBe('hello');
  });

  it('waitForEvent() should timeout when configured', async () => {
    const event = createEventEmitter<string>();

    // Also test if it behaves correctly when event really occurs but too late
    setTimeout(() => {
      emitEvent(event, 'hello');
    }, 20);

    await expect(waitForEvent(event, 10)).rejects.toThrow(
      'Waiting for event has timed out.'
    );
  });
});
