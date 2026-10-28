// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react-native';

import {getChatletChannel, setChatletChannel, useChatletChannelState} from './chatlet_channel';

describe('chatlet channel store', () => {
    it('starts unknown and off, then remembers what the plugin said', () => {
        expect(getChatletChannel('https://mm', 'c1')).toEqual({known: false, enabled: false});
        setChatletChannel('https://mm', 'c1', {enabled: true, boardMsgId: 'b1'});
        expect(getChatletChannel('https://mm', 'c1')).toEqual({known: true, enabled: true, boardMsgId: 'b1'});
        expect(getChatletChannel('https://mm', 'c2').enabled).toBe(false);
        expect(getChatletChannel('https://other', 'c1').enabled).toBe(false);
    });

    it('updates subscribed hooks', () => {
        const {result} = renderHook(() => useChatletChannelState('https://mm', 'c3'));
        expect(result.current.enabled).toBe(false);
        act(() => {
            setChatletChannel('https://mm', 'c3', {enabled: true});
        });
        expect(result.current.enabled).toBe(true);
    });
});
