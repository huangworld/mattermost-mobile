// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getChatletRoom, setRoomFromSnapshot} from '@chatlet/store/chatlet_room';

import NetworkManager from '@managers/network_manager';
import {getFullErrorMessage} from '@utils/errors';
import {logDebug} from '@utils/log';

// Loads the room snapshot: receipts per post and the board's versions.
export async function fetchChatletRoom(serverUrl: string, channelId: string): Promise<{error?: unknown}> {
    try {
        const client = NetworkManager.getClient(serverUrl);
        const snapshot = await client.getChatletSnapshot(channelId);
        setRoomFromSnapshot(serverUrl, channelId, snapshot || {});
        return {};
    } catch (error) {
        logDebug('fetchChatletRoom', channelId, getFullErrorMessage(error));
        return {error};
    }
}

const RELOAD_DELAY = 1000;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

// Board versions change in bursts; one fetch a second is enough, and only for
// rooms someone has looked at.
export function reloadChatletRoomSoon(serverUrl: string, channelId: string) {
    if (!getChatletRoom(serverUrl, channelId).loadedAt) {
        return;
    }
    const key = `${serverUrl}|${channelId}`;
    const timer = pending.get(key);
    if (timer) {
        clearTimeout(timer);
    }
    pending.set(key, setTimeout(() => {
        pending.delete(key);
        fetchChatletRoom(serverUrl, channelId);
    }, RELOAD_DELAY));
}
