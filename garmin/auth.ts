import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const DI_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const DI_GRANT_TYPE = 'https://connectapi.garmin.com/di-oauth2-service/oauth/grant/service_ticket';
const DI_CLIENT_IDS = [
  'GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2',
  'GARMIN_CONNECT_MOBILE_ANDROID_DI_2024Q4',
  'GARMIN_CONNECT_MOBILE_ANDROID_DI',
  'GARMIN_CONNECT_MOBILE_IOS_DI',
];

const SSO_EMBED = 'https://sso.garmin.com/sso/embed';

export type LoginFlow = {
  id: 'portal' | 'mobile' | 'widget';
  label: string;
  url: string;
  /** Must match the service the ticket was issued for, or the DI exchange is rejected. */
  serviceUrl: string;
};

const qs = (params: Record<string, string>) =>
  Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export const LOGIN_FLOWS: LoginFlow[] = [
  {
    id: 'portal',
    label: 'Garmin web sign-in',
    serviceUrl: 'https://connect.garmin.com/app',
    url: `https://sso.garmin.com/portal/sso/en-US/sign-in?${qs({clientId: 'GarminConnect', service: 'https://connect.garmin.com/app'})}`,
  },
  {
    id: 'mobile',
    label: 'Garmin mobile sign-in',
    serviceUrl: 'https://mobile.integration.garmin.com/gcm/android',
    url: `https://sso.garmin.com/mobile/sso/en/sign-in?${qs({clientId: 'GCM_ANDROID_DARK', service: 'https://mobile.integration.garmin.com/gcm/android'})}`,
  },
  {
    id: 'widget',
    label: 'Garmin embedded widget',
    serviceUrl: SSO_EMBED,
    url: `https://sso.garmin.com/sso/signin?${qs({
      id: 'gauth-widget',
      embedWidget: 'true',
      gauthHost: SSO_EMBED,
      service: SSO_EMBED,
      source: SSO_EMBED,
      redirectAfterAccountLoginUrl: SSO_EMBED,
      redirectAfterAccountCreationUrl: SSO_EMBED,
    })}`,
  },
];

export function extractTicket(text: string): string | null {
  const m = text.match(/[?&]ticket=(ST-[^"&\s'<>]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export const NATIVE_HEADERS: Record<string, string> = {
  'User-Agent': 'GCM-Android-5.23',
  'X-Garmin-User-Agent': 'com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0',
  'X-Garmin-Paired-App-Version': '10861',
  'X-Garmin-Client-Platform': 'Android',
  'X-App-Ver': '10861',
  'X-Lang': 'en',
  'X-GCExperience': 'GC5',
  'Accept-Language': 'en-US,en;q=0.9',
};

export type GarminTokens = {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  expiresAt: number;
};

export class GarminAuthError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'GarminAuthError';
  }
}

const formBody = (params: Record<string, string>) => qs(params);
const basicAuth = (clientId: string) => `Basic ${btoa(`${clientId}:`)}`;

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function tokensFromResponse(data: any, clientId: string, previousRefresh?: string): GarminTokens {
  if (!data?.access_token) throw new GarminAuthError('Garmin returned no access token');
  const payload = decodeJwtPayload(data.access_token);
  const expiresAt =
    typeof payload?.exp === 'number'
      ? payload.exp * 1000
      : Date.now() + (typeof data.expires_in === 'number' ? data.expires_in * 1000 : 3600_000);
  const refreshToken = data.refresh_token ?? previousRefresh;
  if (!refreshToken) throw new GarminAuthError('Garmin returned no refresh token');
  return {
    accessToken: data.access_token,
    refreshToken,
    clientId: typeof payload?.client_id === 'string' ? payload.client_id : clientId,
    expiresAt,
  };
}

export async function exchangeTicket(ticket: string, serviceUrl: string): Promise<GarminTokens> {
  let lastStatus: number | undefined;
  for (const clientId of DI_CLIENT_IDS) {
    const res = await fetch(DI_TOKEN_URL, {
      method: 'POST',
      headers: {
        ...NATIVE_HEADERS,
        Authorization: basicAuth(clientId),
        Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: formBody({client_id: clientId, service_ticket: ticket, grant_type: DI_GRANT_TYPE, service_url: serviceUrl}),
    });
    if (res.status === 429) throw new GarminAuthError('Garmin is rate limiting sign-in. Try again in a few minutes.', 429);
    lastStatus = res.status;
    if (!res.ok) continue;
    try {
      return tokensFromResponse(await res.json(), clientId);
    } catch {
      continue;
    }
  }
  throw new GarminAuthError(`Garmin token exchange failed (HTTP ${lastStatus ?? '?'})`, lastStatus);
}

export async function refreshTokens(tokens: GarminTokens): Promise<GarminTokens> {
  const res = await fetch(DI_TOKEN_URL, {
    method: 'POST',
    headers: {
      ...NATIVE_HEADERS,
      Authorization: basicAuth(tokens.clientId),
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: formBody({grant_type: 'refresh_token', client_id: tokens.clientId, refresh_token: tokens.refreshToken}),
  });
  if (!res.ok) throw new GarminAuthError(`Garmin token refresh failed (HTTP ${res.status})`, res.status);
  return tokensFromResponse(await res.json(), tokens.clientId, tokens.refreshToken);
}

const KEYS = {access: 'garmin.access', refresh: 'garmin.refresh', meta: 'garmin.meta'};

export async function saveTokens(tokens: GarminTokens) {
  await SecureStore.setItemAsync(KEYS.access, tokens.accessToken);
  await SecureStore.setItemAsync(KEYS.refresh, tokens.refreshToken);
  await SecureStore.setItemAsync(KEYS.meta, JSON.stringify({clientId: tokens.clientId, expiresAt: tokens.expiresAt}));
}

export async function loadTokens(): Promise<GarminTokens | null> {
  if (Platform.OS === 'web') return null;
  const [accessToken, refreshToken, meta] = await Promise.all([
    SecureStore.getItemAsync(KEYS.access),
    SecureStore.getItemAsync(KEYS.refresh),
    SecureStore.getItemAsync(KEYS.meta),
  ]);
  if (!accessToken || !refreshToken || !meta) return null;
  const {clientId, expiresAt} = JSON.parse(meta);
  return {accessToken, refreshToken, clientId, expiresAt};
}

export async function clearTokens() {
  if (Platform.OS === 'web') return;
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
}
