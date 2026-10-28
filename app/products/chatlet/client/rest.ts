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

export interface ClientChatletMix {
    getChatletRoute: () => string;
    getChatletChannel: (channelId: string) => Promise<ChatletChannelResponse>;
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
};

export default ClientChatlet;
