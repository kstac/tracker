import {useRef, useState} from 'react';
import {Platform, View} from 'react-native';
import {router} from 'expo-router';
import {WebView, WebViewMessageEvent, WebViewNavigation} from 'react-native-webview';
import {ActivityIndicator, Button, Menu, Text} from 'react-native-paper';
import {kvSet} from '@/db/repo';
import {exchangeTicket, extractTicket, LOGIN_FLOWS, LoginFlow} from '@/garmin/auth';
import {GarminClient} from '@/garmin/client';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

// The embedded widget renders the service ticket into the page instead of redirecting, so scan the DOM for it.
const FIND_TICKET_JS = `
  (function () {
    var html = document.documentElement ? document.documentElement.innerHTML : '';
    var m = html.match(/[?&]ticket=(ST-[^"&\\s'<>]+)/);
    if (m) window.ReactNativeWebView.postMessage(m[1]);
  })();
  true;
`;

export default function GarminLoginScreen() {
  const {chart} = useAppTheme();
  const {sync} = useAppData();
  const [flow, setFlow] = useState<LoginFlow>(LOGIN_FLOWS[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<'browsing' | 'exchanging' | 'error'>('browsing');
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const handleTicket = async (ticket: string) => {
    if (handled.current) return;
    handled.current = true;
    setStatus('exchanging');
    try {
      const tokens = await exchangeTicket(ticket, flow.serviceUrl);
      const client = await GarminClient.fromTokens(tokens);
      await kvSet('garmin.display_name', await client.displayName());
      router.back();
      sync().catch(() => {});
    } catch (e) {
      handled.current = false;
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  const onRequest = (req: WebViewNavigation) => {
    const ticket = extractTicket(req.url);
    if (ticket) {
      handleTicket(ticket);
      return false;
    }
    return true;
  };

  const onMessage = (e: WebViewMessageEvent) => {
    const ticket = e.nativeEvent.data;
    if (ticket?.startsWith('ST-')) handleTicket(ticket);
  };

  const switchFlow = (f: LoginFlow) => {
    setMenuOpen(false);
    setError(null);
    setStatus('browsing');
    handled.current = false;
    setFlow(f);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={{flex: 1, backgroundColor: chart.page, padding: 16}}>
        <Text style={{color: chart.inkSecondary}}>Garmin sign-in only works in the phone app.</Text>
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: chart.page}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, paddingHorizontal: 16}}>
        <Text variant="bodySmall" style={{color: chart.inkSecondary, flex: 1}}>
          You sign in on Garmin’s own page. Your password never touches this app; it only keeps the access token Garmin issues.
        </Text>
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={<Button compact onPress={() => setMenuOpen(true)}>Method</Button>}
        >
          {LOGIN_FLOWS.map((f) => (
            <Menu.Item key={f.id} title={f.label} leadingIcon={f.id === flow.id ? 'check' : undefined} onPress={() => switchFlow(f)} />
          ))}
        </Menu>
      </View>

      {status === 'error' && (
        <View style={{padding: 16, gap: 8}}>
          <Text style={{color: chart.status.critical}}>{error}</Text>
          <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
            Try again, or pick a different sign-in method from the Method menu.
          </Text>
          <Button mode="contained" onPress={() => switchFlow(flow)}>Try again</Button>
        </View>
      )}

      {status === 'exchanging' ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12}}>
          <ActivityIndicator />
          <Text style={{color: chart.inkSecondary}}>Finishing sign-in…</Text>
        </View>
      ) : status === 'browsing' ? (
        <WebView
          key={flow.id}
          source={{uri: flow.url}}
          style={{flex: 1}}
          onShouldStartLoadWithRequest={onRequest}
          onNavigationStateChange={(nav) => {
            const ticket = extractTicket(nav.url);
            if (ticket) handleTicket(ticket);
          }}
          injectedJavaScript={FIND_TICKET_JS}
          onMessage={onMessage}
          onLoadEnd={() => undefined}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
        />
      ) : null}
    </View>
  );
}
