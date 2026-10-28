// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Screens} from '@constants';
import {navigateToScreen} from '@screens/navigation';

export type ChatletBoardProps = {
    channelId: string;
    displayName: string;
};

export const goToChatletBoard = (channelId: string, displayName: string) => {
    navigateToScreen(Screens.CHATLET_BOARD, {channelId, displayName} satisfies ChatletBoardProps);
};
