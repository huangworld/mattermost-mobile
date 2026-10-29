// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The board at the top of a channel: a one-line strip with the latest change
// that opens into the board itself (the web app's sidebar popout in a
// WebView, board only), taking most of the screen; a drag on the strip sets
// the height, and the chat keeps a few lines. A dot marks changes since the
// board was last open; a button opens it full screen, with the timeline.
import {reloadChatletRoomSoon} from '@chatlet/actions/remote/room';
import BoardWebView from '@chatlet/components/board_webview';
import {useChatletChannel} from '@chatlet/hooks/use_chatlet_channel';
import {useChatletRoom} from '@chatlet/hooks/use_chatlet_room';
import {goToChatletBoard} from '@chatlet/screens/navigation';
import {latestChangeAt, setBannerExpanded, setBannerHeightShare} from '@chatlet/store/chatlet_room';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Pressable, Text, useWindowDimensions, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';

import {showPermalink} from '@actions/remote/permalink';
import CompassIcon from '@components/compass_icon';
import {CHATLET_BANNER_HEIGHT, CHATLET_BANNER_SHARE} from '@constants/view';
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
    resizeHint: {
        id: 'chatlet.banner.resize_hint',
        defaultMessage: 'Drag to resize',
    },
});

const ANIMATION_MS = 220;
const DOT = 8;

// What the chat keeps under an opened board, whatever the drag asks.
const CHAT_KEEP = 160;

// A drag past this moves the banner's bottom edge; shorter is a touch.
const DRAG_START = 4;
const HANDLE_HEIGHT = 18;
const HANDLE_HIT = {top: 12, bottom: 12, left: 0, right: 0};

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
        marginBottom: HANDLE_HEIGHT,
    },
    handle: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: HANDLE_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.centerChannelBg,
    },
    grabber: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.24),
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

    // The opened height: the dragged share, or the default; never past the
    // point where the chat under it loses its last lines.
    const maxHeight = Math.max(CHATLET_BANNER_HEIGHT, windowHeight - defaultHeight - CHAT_KEEP);
    const minExpanded = Math.min(maxHeight, Math.round(windowHeight * CHATLET_BANNER_SHARE.Min));
    const expandedHeight = Math.min(maxHeight, Math.max(minExpanded, Math.round(windowHeight * (room.heightShare ?? CHATLET_BANNER_SHARE.Default))));
    const height = useSharedValue(shown ? CHATLET_BANNER_HEIGHT : 0);
    const dragStart = useSharedValue(0);

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

    // Where a drag of the bottom edge let go: short of the smallest board, the
    // strip; otherwise that height, remembered for this channel.
    const finishDrag = useCallback((value: number) => {
        if (value < minExpanded) {
            setBannerExpanded(serverUrl, channelId, false);
            return;
        }
        setBannerHeightShare(serverUrl, channelId, value / windowHeight);
    }, [serverUrl, channelId, minExpanded, windowHeight]);

    const pan = useMemo(() => Gesture.Pan().
        activeOffsetY([-DRAG_START, DRAG_START]).
        onStart(() => {
            dragStart.value = height.value;
        }).
        onUpdate((event) => {
            height.value = Math.min(maxHeight, Math.max(CHATLET_BANNER_HEIGHT, dragStart.value + event.translationY));
        }).
        onEnd(() => {
            const value = height.value;
            if (value < minExpanded) {
                height.value = withTiming(CHATLET_BANNER_HEIGHT, {duration: ANIMATION_MS});
            }
            scheduleOnRN(finishDrag, value);
        }), [dragStart, height, maxHeight, minExpanded, finishDrag]);

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
                        mode='banner'
                        onJumpToPost={onJumpToPost}
                        testID='channel.chatlet_banner.webview'
                    />
                </View>
            )}
            {room.expanded && (
                <GestureDetector gesture={pan}>
                    <View
                        style={styles.handle}
                        hitSlop={HANDLE_HIT}
                        accessibilityRole='adjustable'
                        accessibilityLabel={intl.formatMessage(messages.resizeHint)}
                        testID='channel.chatlet_banner.resize.handle'
                    >
                        <View style={styles.grabber}/>
                    </View>
                </GestureDetector>
            )}
        </Animated.View>
    );
};

export default ChatletBoardBanner;
