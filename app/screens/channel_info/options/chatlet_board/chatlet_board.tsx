// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useChatletChannel} from '@chatlet/hooks/use_chatlet_channel';
import {goToChatletBoard} from '@chatlet/screens/navigation';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {Platform} from 'react-native';

import OptionItem from '@components/option_item';
import {useServerUrl} from '@context/server';
import {usePreventDoubleTap} from '@hooks/utils';

type Props = {
    channelId: string;
    displayName: string;
}

// Shown only where Chatlet is on.
const ChatletBoardOption = ({channelId, displayName}: Props) => {
    const {formatMessage} = useIntl();
    const serverUrl = useServerUrl();
    const chatlet = useChatletChannel(serverUrl, channelId);
    const title = formatMessage({id: 'channel_info.chatlet_board', defaultMessage: 'Chatlet board'});

    const open = usePreventDoubleTap(useCallback(() => {
        goToChatletBoard(channelId, displayName);
    }, [channelId, displayName]));

    if (!chatlet.enabled) {
        return null;
    }

    return (
        <OptionItem
            action={open}
            label={title}
            icon='product-boards'
            type={Platform.select({ios: 'arrow', default: 'default'})}
            testID='channel_info.options.chatlet_board.option'
        />
    );
};

export default ChatletBoardOption;
