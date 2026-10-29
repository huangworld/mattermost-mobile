// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// What the phone shows of a Chatlet room without the board: Chatlet's read
// receipt per post, the board's versions (for the banner's "latest change"
// line and the "N board updates" count under a post), and whether the banner
// is open. In memory per server and channel, like the agents' streaming state.
import {useEffect, useState} from 'react';
import {BehaviorSubject} from 'rxjs';
import {distinctUntilChanged, map} from 'rxjs/operators';

import {CHATLET_BANNER_SHARE} from '@constants/view';

import type {ChatletSnapshotResponse} from '@chatlet/client/rest';

export type ChatletReadState = 'queued' | 'reading' | 'seen' | 'skipped';

export type ChatletPostState = {
    state: ChatletReadState;
    at?: number;
    turnId?: string;
    reason?: string;
};

export type ChatletVersion = {
    id: string;
    text: string;
    by: string;
    createdAt: number;
    sourceMessageIds: string[];
};

// Chatlet's latest "what changed" line, for the banner strip.
export type ChatletNotice = {
    text: string;
    createdAt: number;
};

export type ChatletRoom = {
    loadedAt: number;
    boardId?: string;
    posts: Record<string, ChatletPostState>;
    versions: ChatletVersion[];
    notice?: ChatletNotice;
    expanded: boolean;
    seenVersionAt: number;

    // The banner's height as a share of the window, once someone dragged it.
    heightShare?: number;
};

const READ_STATES = new Set<string>(['queued', 'reading', 'seen', 'skipped']);
const NOTICE_PREFIX = /^Board updated:?\s*/;

const DefaultRoom: ChatletRoom = {loadedAt: 0, posts: {}, versions: [], expanded: false, seenVersionAt: 0};

const subjects: Dictionary<BehaviorSubject<ChatletRoom>> = {};

const keyFor = (serverUrl: string, channelId: string) => `${serverUrl}|${channelId}`;

const getSubject = (serverUrl: string, channelId: string) => {
    const key = keyFor(serverUrl, channelId);
    if (!subjects[key]) {
        subjects[key] = new BehaviorSubject(DefaultRoom);
    }
    return subjects[key];
};

const update = (serverUrl: string, channelId: string, patch: Partial<ChatletRoom>) => {
    const subject = getSubject(serverUrl, channelId);
    subject.next({...subject.value, ...patch});
};

export const getChatletRoom = (serverUrl: string, channelId: string) => getSubject(serverUrl, channelId).value;

export const toPostState = (value: unknown): ChatletPostState | undefined => {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const {state, at, turnId, reason} = value as Record<string, unknown>;
    if (typeof state !== 'string' || !READ_STATES.has(state)) {
        return undefined;
    }
    return {
        state: state as ChatletReadState,
        ...(typeof at === 'number' ? {at} : {}),
        ...(typeof turnId === 'string' ? {turnId} : {}),
        ...(typeof reason === 'string' ? {reason} : {}),
    };
};

export const setRoomFromSnapshot = (serverUrl: string, channelId: string, snapshot: ChatletSnapshotResponse) => {
    const messages = snapshot.messages ?? [];
    const posts: Record<string, ChatletPostState> = {};
    for (const message of messages) {
        if (message.kind !== 'user') {
            continue;
        }
        const state = toPostState(message.chatlet);
        if (state) {
            posts[message.id] = state;
        }
    }
    const decision = [...messages].reverse().find((message) => message.kind === 'decision');
    const versions: ChatletVersion[] = (decision?.versions ?? []).map((version) => ({
        id: version.id,
        text: version.text || 'Updated the board',
        by: version.by || 'Chatlet',
        createdAt: version.createdAt || 0,
        sourceMessageIds: version.sourceMessageIds ?? [],
    }));
    const latestNotice = [...messages].reverse().find((message) => message.kind === 'board-update' && message.text);
    const notice = latestNotice ? {text: latestNotice.text!.replace(NOTICE_PREFIX, ''), createdAt: latestNotice.createdAt || 0} : undefined;
    update(serverUrl, channelId, {loadedAt: Date.now(), boardId: decision?.id, posts, versions, notice});
};

// When the board last changed, as far as the strip is concerned.
export const latestChangeAt = (room: ChatletRoom) => Math.max(room.notice?.createdAt ?? 0, room.versions[room.versions.length - 1]?.createdAt ?? 0);

export const setPostState = (serverUrl: string, channelId: string, postId: string, value: unknown) => {
    const state = toPostState(value);
    if (!state) {
        return;
    }
    const room = getChatletRoom(serverUrl, channelId);
    update(serverUrl, channelId, {posts: {...room.posts, [postId]: state}});
};

export const setBannerExpanded = (serverUrl: string, channelId: string, expanded: boolean) => {
    const room = getChatletRoom(serverUrl, channelId);
    const seenVersionAt = expanded ? Math.max(room.seenVersionAt, latestChangeAt(room)) : room.seenVersionAt;
    update(serverUrl, channelId, {expanded, seenVersionAt});
};

export const setBannerHeightShare = (serverUrl: string, channelId: string, share: number) => {
    const heightShare = Math.min(CHATLET_BANNER_SHARE.Max, Math.max(CHATLET_BANNER_SHARE.Min, share));
    update(serverUrl, channelId, {heightShare});
};

export const markVersionsSeen = (serverUrl: string, channelId: string) => {
    const room = getChatletRoom(serverUrl, channelId);
    update(serverUrl, channelId, {seenVersionAt: Math.max(room.seenVersionAt, latestChangeAt(room))});
};

export const clearChatletRooms = (serverUrl: string) => {
    for (const key of Object.keys(subjects)) {
        if (key.startsWith(`${serverUrl}|`)) {
            subjects[key].next(DefaultRoom);
        }
    }
};

export const useChatletRoomState = (serverUrl: string, channelId: string) => {
    const subject = getSubject(serverUrl, channelId);
    const [room, setRoom] = useState(subject.value);

    useEffect(() => {
        const subscription = subject.subscribe(setRoom);
        return () => {
            subscription.unsubscribe();
        };
    }, [subject]);

    return room;
};

// One post's receipt, re-rendering only when its own entry changes.
export const usePostState = (serverUrl: string, channelId: string, postId: string) => {
    const subject = getSubject(serverUrl, channelId);
    const [state, setState] = useState<ChatletPostState | undefined>(subject.value.posts[postId]);

    useEffect(() => {
        const subscription = subject.pipe(
            map((room) => room.posts[postId]),
            distinctUntilChanged(),
        ).subscribe(setState);
        return () => {
            subscription.unsubscribe();
        };
    }, [subject, postId]);

    return state;
};

const countVersionsFor = (room: ChatletRoom, postId: string) => room.versions.filter((version) => version.sourceMessageIds.includes(postId)).length;

// How many board versions a post fed, re-rendering only when that count changes.
export const usePostVersionCount = (serverUrl: string, channelId: string, postId: string) => {
    const subject = getSubject(serverUrl, channelId);
    const [count, setCount] = useState(countVersionsFor(subject.value, postId));

    useEffect(() => {
        const subscription = subject.pipe(
            map((room) => countVersionsFor(room, postId)),
            distinctUntilChanged(),
        ).subscribe(setCount);
        return () => {
            subscription.unsubscribe();
        };
    }, [subject, postId]);

    return count;
};
