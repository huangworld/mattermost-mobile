// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTheme} from '@context/theme';
import {getModalHeaderOptions, useNavigationHeader} from '@hooks/navigation_header';
import {usePropsFromParams} from '@hooks/props_from_params';
import ChatletBoardScreen from '@screens/chatlet_board';
import {navigateBack} from '@screens/navigation';

import type {ChatletBoardProps} from '@chatlet/screens/navigation';

export default function ChatletBoardRoute() {
    const {channelId, displayName} = usePropsFromParams<ChatletBoardProps>();
    const theme = useTheme();

    useNavigationHeader({
        showWhenPushed: true,
        headerOptions: {
            headerTitle: displayName,
            ...getModalHeaderOptions(theme, navigateBack, 'close.chatlet_board.button'),
        },
    });

    return (<ChatletBoardScreen channelId={channelId}/>);
}
