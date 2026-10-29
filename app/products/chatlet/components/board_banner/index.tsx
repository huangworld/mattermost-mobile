// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The board at the top of a channel: a one-line strip with the latest change
// that opens into the board itself (the web app's sidebar popout in a
// WebView), capped so the chat stays usable. A dot marks changes since the
// board was last open; a button opens it full screen.
import {reloadChatletRoomSoon} from '@chatlet/actions/remote/room';
import BoardWebView from '@chatlet/components/board_webview';
import {useChatletChannel} from '@chatlet/hooks/use_chatlet_channel';
import {useChatletRoom} from '@chatlet/hooks/use_chatlet_room';
import {goToChatletBoard} from '@chatlet/screens/navigation';
import {latestChangeAt, setBannerExpanded} from '@chatlet/store/chatlet_room';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Pressable, Text, useWindowDimensions, View} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';

import {showPermalink} from '@actions/remote/permalink';
import CompassIcon from '@components/compass_icon';
import {CHATLET_BANNER_HEIGHT} from '@constants/view';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {useDefaultHeaderHeight} from '@hooks/header';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

type Props = {
    channelId: string;
    displayName: string;
};

const messages = defineMessages({
    title: {
        id: 'chatlet.banner.title',
        defaultMessage: 'Board',
    },
    by: {
        id: 'chatlet.banner.by',
        defaultMessage: '{by}: {text}',
    },
    expand: {
        id: 'chatlet.banner.expand',
        defaultMessage: 'Show the board',
    },
    collapse: {
        id: 'chatlet.banner.collapse',
        defaultMessage: 'Hide the board',
    },
    fullScreen: {
        id: 'chatlet.banner.full_screen',
        defaultMessage: 'Open the board full screen',
    },
});

const EXPANDED_MAX = 420;
const EXPANDED_SHARE = 0.45;
const ANIMATION_MS = 220;
const DOT = 8;

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        backgroundColor: theme.centerChannelBg,
        borderBottomWidth: 1,
        borderBottomColor: changeOpacity(theme.centerChannelColor, 0.12),
        overflow: 'hidden',
    },
    strip: {
        height: CHATLET_BANNER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        gap: 8,
    },
    pressed: {
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.06),
    },
    dot: {
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
        backgroundColor: theme.buttonBg,
    },
    title: {
        ...typography('Body', 100, 'SemiBold'),
        color: theme.centerChannelColor,
    },
    text: {
        ...typography('Body', 100),
        color: changeOpacity(theme.centerChannelColor, 0.64),
        flex: 1,
    },
    unread: {
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
        backgroundColor: theme.newMessageSeparator,
    },
    icon: {
        color: changeOpacity(theme.centerChannelColor, 0.64),
    },
    iconButton: {
        padding: 4,
    },
    iconPressed: {
        opacity: 0.72,
    },
    board: {
        flex: 1,
    },
}));

const ChatletBoardBanner = ({channelId, displayName}: Props) => {
    const serverUrl = useServerUrl();
    const theme = useTheme();
    const intl = useIntl();
    const styles = getStyleSheet(theme);
    const defaultHeight = useDefaultHeaderHeight();
    const {height: windowHeight} = useWindowDimensions();

    // The one place that asks the plugin about this channel; receipts read the same state.
    const chatlet = useChatletChannel(serverUrl, channelId);
    const room = useChatletRoom(serverUrl, channelId, chatlet.enabled);
    const shown = chatlet.enabled && Boolean(chatlet.boardMsgId);
    const expandedHeight = Math.min(EXPANDED_MAX, Math.round(windowHeight * EXPANDED_SHARE));
    const height = useSharedValue(shown ? CHATLET_BANNER_HEIGHT : 0);

    // The WebView stays mounted through the collapse animation, then goes.
    const [mounted, setMounted] = useState(room.expanded);
    useEffect(() => {
        if (room.expanded) {
            setMounted(true);
            return undefined;
        }
        const timer = setTimeout(() => setMounted(false), ANIMATION_MS);
        return () => clearTimeout(timer);
    }, [room.expanded]);

    useEffect(() => {
        let target = 0;
        if (shown) {
            target = room.expanded ? expandedHeight : CHATLET_BANNER_HEIGHT;
        }
        height.value = withTiming(target, {duration: ANIMATION_MS});
    }, [height, shown, room.expanded, expandedHeight]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
    }));

    const containerStyle = useMemo(() => [styles.container, {top: defaultHeight, zIndex: 1}, animatedStyle], [styles, defaultHeight, animatedStyle]);

    const toggle = useCallback(() => {
        setBannerExpanded(serverUrl, channelId, !room.expanded);
    }, [serverUrl, channelId, room.expanded]);

    const openFullScreen = useCallback(() => {
        goToChatletBoard(channelId, displayName);
    }, [channelId, displayName]);

    const onJumpToPost = useCallback((teamName: string, postId: string) => {
        showPermalink(serverUrl, teamName, postId);
    }, [serverUrl]);

    // Coming back to the channel after a change elsewhere: the strip's line refreshes.
    useEffect(() => {
        if (shown) {
            reloadChatletRoomSoon(serverUrl, channelId);
        }
    }, [serverUrl, channelId, shown, chatlet.boardMsgId]);

    if (!shown) {
        return null;
    }

    const latest = room.versions[room.versions.length - 1];
    const unread = latestChangeAt(room) > room.seenVersionAt && !room.expanded;

    // Chatlet's own "what changed" line when it is the newest word; else the version's label.
    let line = '';
    if (room.notice && (!latest || room.notice.createdAt >= latest.createdAt)) {
        line = room.notice.text;
    } else if (latest) {
        line = latest.by && latest.by !== 'Chatlet' ? intl.formatMessage(messages.by, {by: latest.by, text: latest.text}) : latest.text;
    }

    return (
        <Animated.View
            style={containerStyle}
            testID='channel.chatlet_banner'
        >
            <Pressable
                onPress={toggle}
                style={({pressed}) => [styles.strip, pressed && styles.pressed]}
                accessibilityRole='button'
                accessibilityLabel={intl.formatMessage(room.expanded ? messages.collapse : messages.expand)}
                testID='channel.chatlet_banner.toggle.button'
            >
                <View style={styles.dot}/>
                <Text style={styles.title}>{intl.formatMessage(messages.title)}</Text>
                <Text
                    style={styles.text}
                    numberOfLines={1}
                    ellipsizeMode='tail'
                >
                    {line}
                </Text>
                {unread && <View style={styles.unread}/>}
                {room.expanded && (
                    <Pressable
                        onPress={openFullScreen}
                        style={({pressed}) => [styles.iconButton, pressed && styles.iconPressed]}
                        accessibilityRole='button'
                        accessibilityLabel={intl.formatMessage(messages.fullScreen)}
                        hitSlop={8}
                        testID='channel.chatlet_banner.full_screen.button'
                    >
                        <CompassIcon
                            name='arrow-expand-all'
                            size={18}
                            style={styles.icon}
                        />
                    </Pressable>
                )}
                <CompassIcon
                    name={room.expanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    style={styles.icon}
                />
            </Pressable>
            {mounted && (
                <View style={styles.board}>
                    <BoardWebView
                        channelId={channelId}
                        onJumpToPost={onJumpToPost}
                        testID='channel.chatlet_banner.webview'
                    />
                </View>
            )}
        </Animated.View>
    );
};

export default ChatletBoardBanner;
