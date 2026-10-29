// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Chatlet's read receipt under a person's post, like "seen by" in a
// messenger: waiting, reading, seen (with the time) or skipped. When the
// post fed one or more board versions, a tap opens the board banner.
import {useChatletChannelState} from '@chatlet/store/chatlet_channel';
import {setBannerExpanded, usePostState, usePostVersionCount} from '@chatlet/store/chatlet_room';
import React, {useCallback} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Pressable, Text, View} from 'react-native';

import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

type Props = {
    channelId: string;
    postId: string;
    userId: string;
    testID?: string;
};

const messages = defineMessages({
    queued: {
        id: 'chatlet.receipt.queued',
        defaultMessage: 'Waiting for Chatlet',
    },
    reading: {
        id: 'chatlet.receipt.reading',
        defaultMessage: 'Chatlet is reading',
    },
    seen: {
        id: 'chatlet.receipt.seen',
        defaultMessage: 'Seen by Chatlet · {time}',
    },
    skipped: {
        id: 'chatlet.receipt.skipped',
        defaultMessage: 'Chatlet skipped this',
    },
    stopped: {
        id: 'chatlet.receipt.reason.stopped',
        defaultMessage: '(stopped)',
    },
    failed: {
        id: 'chatlet.receipt.reason.failed',
        defaultMessage: '(the turn failed)',
    },
    dropped: {
        id: 'chatlet.receipt.reason.dropped',
        defaultMessage: '(too many at once)',
    },
    updates: {
        id: 'chatlet.receipt.updates',
        defaultMessage: '{count, plural, one {# board update} other {# board updates}}',
    },
});

const REASONS: Record<string, typeof messages.stopped | undefined> = {
    stopped: messages.stopped,
    failed: messages.failed,
    dropped: messages.dropped,
};

const DOT = 7;

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 2,
        flexWrap: 'wrap',
    },
    dot: {
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
        backgroundColor: theme.buttonBg,
    },
    hollow: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: changeOpacity(theme.centerChannelColor, 0.4),
    },
    faded: {
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.32),
    },
    text: {
        ...typography('Body', 75),
        color: changeOpacity(theme.centerChannelColor, 0.64),
    },
    link: {
        ...typography('Body', 75, 'SemiBold'),
        color: theme.linkColor,
    },
    pressed: {
        opacity: 0.72,
    },
}));

const ChatletPostStatus = ({channelId, postId, userId, testID}: Props) => {
    const serverUrl = useServerUrl();
    const theme = useTheme();
    const intl = useIntl();
    const styles = getStyleSheet(theme);
    const chatlet = useChatletChannelState(serverUrl, channelId);
    const receipt = usePostState(serverUrl, channelId, postId);
    const versions = usePostVersionCount(serverUrl, channelId, postId);

    const openBoard = useCallback(() => {
        setBannerExpanded(serverUrl, channelId, true);
    }, [serverUrl, channelId]);

    if (!chatlet.enabled || (chatlet.botUserId && userId === chatlet.botUserId)) {
        return null;
    }
    if (!receipt && !versions) {
        return null;
    }

    let text = '';
    if (receipt) {
        switch (receipt.state) {
            case 'queued':
                text = intl.formatMessage(messages.queued);
                break;
            case 'reading':
                text = intl.formatMessage(messages.reading);
                break;
            case 'seen':
                text = intl.formatMessage(messages.seen, {time: receipt.at ? intl.formatTime(receipt.at, {hour: 'numeric', minute: '2-digit'}) : ''});
                break;
            case 'skipped': {
                const reason = receipt.reason ? REASONS[receipt.reason] : undefined;
                text = `${intl.formatMessage(messages.skipped)}${reason ? ` ${intl.formatMessage(reason)}` : ''}`;
                break;
            }
        }
    }

    const dotStyle = [styles.dot, receipt?.state === 'queued' && styles.hollow, receipt?.state === 'skipped' && styles.faded];

    return (
        <View
            style={styles.row}
            testID={testID}
        >
            {receipt && <View style={dotStyle}/>}
            {Boolean(text) && <Text style={styles.text}>{text}</Text>}
            {versions > 0 && (
                <Pressable
                    onPress={openBoard}
                    style={({pressed}) => [pressed && styles.pressed]}
                    accessibilityRole='button'
                    hitSlop={6}
                    testID={testID ? `${testID}.updates` : undefined}
                >
                    <Text style={styles.link}>{intl.formatMessage(messages.updates, {count: versions})}</Text>
                </Pressable>
            )}
        </View>
    );
};

export default ChatletPostStatus;
