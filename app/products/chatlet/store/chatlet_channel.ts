// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Per channel: does Chatlet run here (so the board button shows)? Kept in
// memory per server, like the agents plugin's status.
import {useEffect, useState} from 'react';
import {BehaviorSubject} from 'rxjs';

export type ChatletChannelState = {
    known: boolean;
    enabled: boolean;
    boardMsgId?: string;
    botUserId?: string;
};

const DefaultState: ChatletChannelState = {known: false, enabled: false};

const subjects: Dictionary<BehaviorSubject<ChatletChannelState>> = {};

const keyFor = (serverUrl: string, channelId: string) => `${serverUrl}|${channelId}`;

const getSubject = (serverUrl: string, channelId: string) => {
    const key = keyFor(serverUrl, channelId);
    if (!subjects[key]) {
        subjects[key] = new BehaviorSubject(DefaultState);
    }
    return subjects[key];
};

export const getChatletChannel = (serverUrl: string, channelId: string) => {
    return getSubject(serverUrl, channelId).value;
};

export const setChatletChannel = (serverUrl: string, channelId: string, state: Partial<ChatletChannelState>) => {
    const subject = getSubject(serverUrl, channelId);
    subject.next({...subject.value, ...state, known: true});
};

export const observeChatletChannel = (serverUrl: string, channelId: string) => {
    return getSubject(serverUrl, channelId).asObservable();
};

export const useChatletChannelState = (serverUrl: string, channelId: string) => {
    const subject = getSubject(serverUrl, channelId);
    const [state, setState] = useState(subject.value);

    useEffect(() => {
        const subscription = subject.subscribe(setState);
        return () => {
            subscription?.unsubscribe();
        };
    }, [subject]);

    return state;
};
