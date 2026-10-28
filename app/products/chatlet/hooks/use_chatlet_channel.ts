// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fetchChatletChannel} from '@chatlet/actions/remote/channel';
import {useChatletChannelState} from '@chatlet/store/chatlet_channel';
import {useEffect} from 'react';

// The channel's Chatlet state, fetched once per mount (the board turns on and
// off rarely; a screen remount refreshes it).
export function useChatletChannel(serverUrl: string, channelId: string) {
    const state = useChatletChannelState(serverUrl, channelId);

    useEffect(() => {
        if (serverUrl && channelId) {
            fetchChatletChannel(serverUrl, channelId);
        }
    }, [serverUrl, channelId]);

    return state;
}
