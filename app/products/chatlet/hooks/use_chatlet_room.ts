// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fetchChatletRoom} from '@chatlet/actions/remote/room';
import {useChatletRoomState} from '@chatlet/store/chatlet_room';
import {useEffect} from 'react';

import {useAppState} from '@hooks/device';

// The room's receipts and versions: read when the channel opens and again
// when the app comes back to the front; websocket events keep it current in
// between.
export function useChatletRoom(serverUrl: string, channelId: string, enabled: boolean) {
    const room = useChatletRoomState(serverUrl, channelId);
    const appState = useAppState();
    const active = appState === 'active';

    useEffect(() => {
        if (enabled && channelId && active) {
            fetchChatletRoom(serverUrl, channelId);
        }
    }, [serverUrl, channelId, enabled, active]);

    return room;
}
