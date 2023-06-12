/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import * as Message from "../Messages/MessageTypes";

/**
 * Function to send message
 */
export type SendMessageFunction<Channel> = (channel: Channel, message: Message.Message) => Promise<void>;
