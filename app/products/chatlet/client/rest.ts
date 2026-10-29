// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The Chatlet plugin's own routes: whether a channel has a board, and where
// generated views come from. See mattermost/plugin/server/http.go in chatlet.

export type ChatletChannelResponse = {
    room: string;
    enabled: boolean;
    agentMode?: string;
    model?: string;
    boardMsgId?: string;
    enabledBy?: string;
    viewsOrigin?: string;
    botUserId?: string;
    isHost?: boolean;
};

// A room snapshot: every message the sidecar keeps for the channel. People's
// messages carry Chatlet's read receipt; the newest decision carries the
// board's versions.
export type ChatletSnapshotMessage = {
    id: string;
    kind: string;
    text?: string;
    createdAt?: number;
    chatlet?: {state: string; at?: number; turnId?: string; reason?: string};
    versions?: Array<{id: string; text?: string; by?: string; createdAt?: number; sourceMessageIds?: string[]}>;
};

export type ChatletSnapshotResponse = {
    messages?: ChatletSnapshotMessage[];
    agentBusy?: boolean;
};

export interface ClientChatletMix {
    getChatletRoute: () => string;
    getChatletChannel: (channelId: string) => Promise<ChatletChannelResponse>;
    getChatletSnapshot: (channelId: string) => Promise<ChatletSnapshotResponse>;
}

const ClientChatlet = (superclass: any) => class extends superclass {
    getChatletRoute = () => {
        return this.getPluginRoute('chatlet');
    };

    getChatletChannel = async (channelId: string) => {
        return this.doFetch(
            `${this.getChatletRoute()}/api/channel?channel=${encodeURIComponent(channelId)}`,
            {method: 'get'},
        );
    };

    getChatletSnapshot = async (channelId: string) => {
        return this.doFetch(
            `${this.getChatletRoute()}/api/group/snapshot?room=${encodeURIComponent(channelId)}`,
            {method: 'get'},
        );
    };
};

export default ClientChatlet;
