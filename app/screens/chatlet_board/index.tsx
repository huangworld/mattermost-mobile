// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The board full screen, as a modal. When the board points at a chat message
// the modal closes first and the native channel opens that post.
import BoardWebView from '@chatlet/components/board_webview';
import React, {useCallback} from 'react';

import {showPermalink} from '@actions/remote/permalink';
import {useServerUrl} from '@context/server';
import {navigateBack} from '@screens/navigation';

type Props = {
    channelId: string;
};

// The modal's closing animation, then the permalink (a transparent modal of its own).
const CLOSE_SETTLE_MS = 450;

const ChatletBoardScreen = ({channelId}: Props) => {
    const serverUrl = useServerUrl();

    const onJumpToPost = useCallback(async (teamName: string, postId: string) => {
        await navigateBack();
        await new Promise((resolve) => setTimeout(resolve, CLOSE_SETTLE_MS));
        showPermalink(serverUrl, teamName, postId);
    }, [serverUrl]);

    return (
        <BoardWebView
            channelId={channelId}
            onJumpToPost={onJumpToPost}
        />
    );
};

export default ChatletBoardScreen;
