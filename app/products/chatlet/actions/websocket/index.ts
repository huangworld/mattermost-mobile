// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The plugin relays the sidecar's room events to a channel's members:
// `config` when Chatlet turns on or off, `board` when a board appears,
// `patch` for any change to a message (a person's post gets Chatlet's read
// receipt under `chatlet`; the board gets its state), `message` for new
// lines, and `snapshot-invalidate` when the room should be re-read.
import {reloadChatletRoomSoon} from '@chatlet/actions/remote/room';
import {setChatletChannel} from '@chatlet/store/chatlet_channel';
import {setPostState} from '@chatlet/store/chatlet_room';

import {safeParseJSON} from '@utils/helpers';

type ChatletConfigData = {
    room?: string;
    enabled?: boolean;
};

type ChatletBoardData = {
    room?: string;
    boardId?: string;
};

type ChatletPatchData = {
    room?: string;
    id?: string;
    patch?: string;
    by?: string;
};

type ChatletMessageData = {
    room?: string;
    id?: string;
    kind?: string;
    message?: string;
};

const channelOf = (msg: WebSocketMessage<{room?: string}>) => msg.data?.room || msg.broadcast?.channel_id;

const BOARD_KEYS = ['state', 'stateRevision', 'versions', 'initialized', 'name'];

export const handleChatletConfig = (serverUrl: string, msg: WebSocketMessage<ChatletConfigData>) => {
    const channelId = channelOf(msg);
    if (!channelId) {
        return;
    }
    setChatletChannel(serverUrl, channelId, {enabled: Boolean(msg.data?.enabled)});
};

export const handleChatletBoard = (serverUrl: string, msg: WebSocketMessage<ChatletBoardData>) => {
    const channelId = channelOf(msg);
    if (!channelId) {
        return;
    }
    setChatletChannel(serverUrl, channelId, {enabled: true, boardMsgId: msg.data?.boardId});
    reloadChatletRoomSoon(serverUrl, channelId);
};

export const handleChatletPatch = (serverUrl: string, msg: WebSocketMessage<ChatletPatchData>) => {
    const channelId = channelOf(msg);
    const id = msg.data?.id;
    if (!channelId || !id || !msg.data?.patch) {
        return;
    }
    const patch = safeParseJSON(msg.data.patch) as Record<string, unknown> | undefined;
    if (!patch || typeof patch !== 'object') {
        return;
    }
    if ('chatlet' in patch) {
        setPostState(serverUrl, channelId, id, patch.chatlet);
    }
    if (BOARD_KEYS.some((key) => key in patch)) {
        reloadChatletRoomSoon(serverUrl, channelId);
    }
};

export const handleChatletMessage = (serverUrl: string, msg: WebSocketMessage<ChatletMessageData>) => {
    const channelId = channelOf(msg);
    if (!channelId) {
        return;
    }
    if (msg.data?.kind === 'user' && msg.data.id && msg.data.message) {
        const message = safeParseJSON(msg.data.message) as {chatlet?: unknown} | undefined;
        if (message?.chatlet) {
            setPostState(serverUrl, channelId, msg.data.id, message.chatlet);
        }
        return;
    }
    if (msg.data?.kind === 'decision-trace') {
        reloadChatletRoomSoon(serverUrl, channelId);
    }
};

export const handleChatletSnapshotInvalidate = (serverUrl: string, msg: WebSocketMessage<{room?: string}>) => {
    const channelId = channelOf(msg);
    if (channelId) {
        reloadChatletRoomSoon(serverUrl, channelId);
    }
};
