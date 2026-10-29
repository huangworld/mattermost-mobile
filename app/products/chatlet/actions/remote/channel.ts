// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {setChatletChannel} from '@chatlet/store/chatlet_channel';

import NetworkManager from '@managers/network_manager';
import {logDebug} from '@utils/log';

// Asks the plugin whether this channel has Chatlet on. A missing plugin (404)
// or any error means "no board here".
export async function fetchChatletChannel(serverUrl: string, channelId: string): Promise<{enabled: boolean; error?: unknown}> {
    try {
        const client = NetworkManager.getClient(serverUrl);
        const response = await client.getChatletChannel(channelId);
        const enabled = Boolean(response?.enabled);
        setChatletChannel(serverUrl, channelId, {enabled, boardMsgId: response?.boardMsgId, botUserId: response?.botUserId});
        return {enabled};
    } catch (error) {
        logDebug('fetchChatletChannel', 'no chatlet for channel', channelId, error);
        setChatletChannel(serverUrl, channelId, {enabled: false});
        return {enabled: false, error};
    }
}
