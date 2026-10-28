// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The Chatlet board for a channel: the web app's right-hand-sidebar popout
// (`/_popout/rhs/<team>/plugin/chatlet?channel=<name>`) in a WebView, signed
// in with this app's session. The board, its map, generated views and the
// decision timeline all run there unchanged. When the board points at a chat
// message, the page asks us to show it: the board closes and the native
// channel opens that post.
import CookieManager from '@preeternal/react-native-cookie-manager';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {StyleSheet, View} from 'react-native';
import {WebView, type WebViewMessageEvent, type WebViewNavigation} from 'react-native-webview';

import {showPermalink} from '@actions/remote/permalink';
import FormattedText from '@components/formatted_text';
import Loading from '@components/loading';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import DatabaseManager from '@database/manager';
import {getServerCredentials} from '@init/credentials';
import {getChannelById} from '@queries/servers/channel';
import {getCurrentTeam, getTeamById} from '@queries/servers/team';
import {navigateBack} from '@screens/navigation';
import {logDebug} from '@utils/log';
import {getCSRFFromCookie} from '@utils/security';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';
import {tryOpenURL} from '@utils/url';

type Props = {
    channelId: string;
};

type Target = {
    uri: string;
    teamName: string;
};

// The page tells the app it is in the app through the user agent (the plugin
// bundle hides the popout header and routes links and chat jumps to us).
const USER_AGENT_MARK = 'ChatletBoard/1';

// What the page may navigate to inside the WebView: itself and its assets.
const INTERNAL_PATHS = ['/_popout/', '/static/', '/api/', '/plugins/', '/login', '/landing'];

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.centerChannelBg,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    message: {
        ...typography('Body', 200),
        color: changeOpacity(theme.centerChannelColor, 0.72),
        textAlign: 'center',
    },
}));

// Puts the app's session into the WebKit cookie store, so the page loads as
// the signed-in user without a login screen.
async function primeSessionCookies(serverUrl: string) {
    const credentials = await getServerCredentials(serverUrl);
    if (!credentials?.token) {
        return false;
    }
    const secure = serverUrl.startsWith('https');
    const cookies = [
        {name: 'MMAUTHTOKEN', value: credentials.token, httpOnly: true},
        {name: 'MMUSERID', value: credentials.userId, httpOnly: false},
    ];
    const csrf = await getCSRFFromCookie(serverUrl);
    if (csrf) {
        cookies.push({name: 'MMCSRF', value: csrf, httpOnly: false});
    }
    for (const cookie of cookies) {
        // eslint-disable-next-line no-await-in-loop
        await CookieManager.set(serverUrl, {...cookie, path: '/', secure}, true);
    }
    return true;
}

async function resolveTarget(serverUrl: string, channelId: string): Promise<Target | null> {
    const {database} = DatabaseManager.getServerDatabaseAndOperator(serverUrl);
    const channel = await getChannelById(database, channelId);
    if (!channel) {
        return null;
    }
    const team = channel.teamId ? await getTeamById(database, channel.teamId) : await getCurrentTeam(database);
    if (!team) {
        return null;
    }
    const uri = `${serverUrl}/_popout/rhs/${encodeURIComponent(team.name)}/plugin/chatlet?channel=${encodeURIComponent(channel.name)}`;
    return {uri, teamName: team.name};
}

const ChatletBoardScreen = ({channelId}: Props) => {
    const serverUrl = useServerUrl();
    const theme = useTheme();
    const intl = useIntl();
    const styles = getStyleSheet(theme);
    const [target, setTarget] = useState<Target | null>(null);
    const [failed, setFailed] = useState<'session' | 'channel' | null>(null);
    const reprimed = useRef(false);

    useEffect(() => {
        let live = true;
        const prepare = async () => {
            let ok = false;
            let resolved: Target | null = null;
            try {
                ok = await primeSessionCookies(serverUrl);
                resolved = ok ? await resolveTarget(serverUrl, channelId) : null;
            } catch (error) {
                logDebug('chatlet board: could not prepare', error);
            }
            if (!live) {
                return;
            }
            if (resolved) {
                setTarget(resolved);
            } else {
                setFailed(ok ? 'channel' : 'session');
            }
        };
        prepare();
        return () => {
            live = false;
        };
    }, [serverUrl, channelId]);

    const onMessage = useCallback(async (event: WebViewMessageEvent) => {
        let message: {type?: string; postId?: string; url?: string} = {};
        try {
            message = JSON.parse(event.nativeEvent.data);
        } catch {
            return;
        }
        logDebug('chatlet board: message', message.type, message.postId || message.url);
        if (message.type === 'jumpToPost' && message.postId && target) {
            // The board is a modal: let it finish closing before the permalink
            // (a transparent modal of its own) opens over the channel.
            await navigateBack();
            await new Promise((resolve) => setTimeout(resolve, 450));
            showPermalink(serverUrl, target.teamName, message.postId);
        } else if (message.type === 'openLink' && message.url && /^https?:\/\//i.test(message.url)) {
            tryOpenURL(message.url);
        }
    }, [serverUrl, target]);

    // A new object for the same target remounts the WebView source.
    const reload = useCallback(() => {
        setTarget((t) => (t ? {...t} : t));
    }, []);

    // The page may only move within itself; anything else opens outside.
    const onShouldStartLoadWithRequest = useCallback((request: WebViewNavigation) => {
        const {url} = request;
        if (!/^https?:\/\//i.test(url)) {
            return false;
        }
        if (url.startsWith(serverUrl)) {
            const path = url.slice(serverUrl.length);
            if (INTERNAL_PATHS.some((prefix) => path.startsWith(prefix))) {
                // The login page means the cookies did not take: prime once more.
                if (path.startsWith('/login') && !reprimed.current) {
                    reprimed.current = true;
                    primeSessionCookies(serverUrl).then(reload);
                    return false;
                }
                return true;
            }
        }
        if (request.navigationType === 'click' || request.navigationType === 'other') {
            tryOpenURL(url);
        }
        return false;
    }, [serverUrl, reload]);

    if (failed) {
        return (
            <View style={styles.centered}>
                <FormattedText
                    id={failed === 'session' ? 'chatlet_board.sign_in_again' : 'chatlet_board.no_channel'}
                    defaultMessage={failed === 'session' ? 'Sign in again to open the board.' : 'This channel is not available.'}
                    style={styles.message}
                />
            </View>
        );
    }

    if (!target) {
        return (
            <View style={styles.centered}>
                <Loading color={theme.buttonBg}/>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <WebView
                source={{uri: target.uri}}
                sharedCookiesEnabled={true}
                applicationNameForUserAgent={USER_AGENT_MARK}
                injectedJavaScriptBeforeContentLoaded={"try{localStorage.setItem('__landingPageSeen__','true')}catch(e){}; true;"}
                onMessage={onMessage}
                onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
                allowsInlineMediaPlayback={true}
                allowsBackForwardNavigationGestures={false}
                startInLoadingState={true}
                renderLoading={() => (
                    <View style={[StyleSheet.absoluteFill, styles.centered]}>
                        <Loading color={theme.buttonBg}/>
                    </View>
                )}
                style={styles.container}
                testID='chatlet_board.webview'
                accessibilityLabel={intl.formatMessage({id: 'chatlet_board.title', defaultMessage: 'Chatlet board'})}
            />
        </View>
    );
};

export default ChatletBoardScreen;
