// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from '@testing-library/react-native';

import {
    getChatletRoom,
    setBannerExpanded,
    setPostState,
    setRoomFromSnapshot,
    toPostState,
    usePostState,
    usePostVersionCount,
} from './chatlet_room';

const serverUrl = 'https://chat.example';
const channelId = 'chan1';

describe('chatlet room store', () => {
    it('should read receipts and versions from a snapshot', () => {
        setRoomFromSnapshot(serverUrl, channelId, {
            messages: [
                {id: 'p1', kind: 'user', chatlet: {state: 'seen', at: 10}},
                {id: 'p2', kind: 'user', chatlet: {state: 'nonsense'}},
                {id: 'p3', kind: 'user'},
                {id: 'd1', kind: 'decision', versions: [{id: 'v1', createdAt: 5, sourceMessageIds: ['p1']}]},
                {id: 'd2', kind: 'decision', versions: [{id: 'v2', text: 'Added Roast', by: 'alice', createdAt: 7, sourceMessageIds: ['p1', 'p3']}]},
                {id: 'n1', kind: 'board-update', text: 'Board updated: Dinner: added Roast', createdAt: 8},
            ],
        });
        const room = getChatletRoom(serverUrl, channelId);
        expect(room.notice).toEqual({text: 'Dinner: added Roast', createdAt: 8});
        expect(Object.keys(room.posts)).toEqual(['p1']);
        expect(room.posts.p1).toEqual({state: 'seen', at: 10});
        expect(room.boardId).toBe('d2');
        expect(room.versions).toHaveLength(1);
        expect(room.versions[0]).toEqual({id: 'v2', text: 'Added Roast', by: 'alice', createdAt: 7, sourceMessageIds: ['p1', 'p3']});
        expect(room.loadedAt).toBeGreaterThan(0);
    });

    it('should apply a receipt patch to one post and notify only that post', () => {
        const p1 = renderHook(() => usePostState(serverUrl, channelId, 'p1'));
        const p3 = renderHook(() => usePostState(serverUrl, channelId, 'p3'));
        expect(p3.result.current).toBeUndefined();
        act(() => {
            setPostState(serverUrl, channelId, 'p3', {state: 'reading', turnId: 't1'});
        });
        expect(p3.result.current).toEqual({state: 'reading', turnId: 't1'});
        expect(p1.result.current).toEqual({state: 'seen', at: 10});
        act(() => {
            setPostState(serverUrl, channelId, 'p3', {state: 'bogus'});
        });
        expect(p3.result.current).toEqual({state: 'reading', turnId: 't1'});
    });

    it('should count the versions a post fed', () => {
        const {result} = renderHook(() => usePostVersionCount(serverUrl, channelId, 'p3'));
        expect(result.current).toBe(1);
        act(() => {
            setRoomFromSnapshot(serverUrl, channelId, {messages: [{id: 'd2', kind: 'decision', versions: []}]});
        });
        expect(result.current).toBe(0);
    });

    it('should mark versions seen when the banner opens', () => {
        setRoomFromSnapshot(serverUrl, channelId, {messages: [{id: 'd2', kind: 'decision', versions: [{id: 'v9', createdAt: 99}]}, {id: 'n2', kind: 'board-update', text: 'Board updated', createdAt: 120}]});
        expect(getChatletRoom(serverUrl, channelId).seenVersionAt).toBe(0);
        setBannerExpanded(serverUrl, channelId, true);
        expect(getChatletRoom(serverUrl, channelId)).toMatchObject({expanded: true, seenVersionAt: 120});
        setBannerExpanded(serverUrl, channelId, false);
        expect(getChatletRoom(serverUrl, channelId)).toMatchObject({expanded: false, seenVersionAt: 120});
    });

    it('should reject receipts without a known state', () => {
        expect(toPostState(null)).toBeUndefined();
        expect(toPostState({state: 'seen', at: 'soon'})).toEqual({state: 'seen'});
        expect(toPostState({state: 'skipped', reason: 'failed'})).toEqual({state: 'skipped', reason: 'failed'});
    });
});
