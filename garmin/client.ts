import {clearTokens, GarminAuthError, GarminTokens, loadTokens, NATIVE_HEADERS, refreshTokens, saveTokens} from '@/garmin/auth';

const BASE = 'https://connectapi.garmin.com';
const REFRESH_MARGIN_MS = 15 * 60_000;
const MIN_GAP_MS = 350;

export class GarminRateLimitError extends Error {}

export class GarminClient {
  private tokens: GarminTokens;
  private lastRequestAt = 0;
  private refreshing: Promise<void> | null = null;

  private constructor(tokens: GarminTokens) {
    this.tokens = tokens;
  }

  static async fromStorage(): Promise<GarminClient | null> {
    const tokens = await loadTokens();
    return tokens ? new GarminClient(tokens) : null;
  }

  static async fromTokens(tokens: GarminTokens): Promise<GarminClient> {
    await saveTokens(tokens);
    return new GarminClient(tokens);
  }

  private async refresh() {
    this.refreshing ??= (async () => {
      try {
        this.tokens = await refreshTokens(this.tokens);
        await saveTokens(this.tokens);
      } catch (e) {
        if (e instanceof GarminAuthError && (e.status === 400 || e.status === 401 || e.status === 403)) await clearTokens();
        throw e;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  private async throttle() {
    const wait = this.lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  private async request(path: string): Promise<Response> {
    if (this.tokens.expiresAt - Date.now() < REFRESH_MARGIN_MS) await this.refresh();
    await this.throttle();
    return fetch(`${BASE}${path}`, {
      headers: {...NATIVE_HEADERS, Authorization: `Bearer ${this.tokens.accessToken}`, Accept: 'application/json'},
    });
  }

  async get<T = any>(path: string, params?: Record<string, string | number | boolean>): Promise<T | null> {
    const query = params
      ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
      : '';
    let res = await this.request(path + query);
    if (res.status === 401) {
      await this.refresh();
      res = await this.request(path + query);
    }
    if (res.status === 429) throw new GarminRateLimitError('Garmin is rate limiting requests; sync will resume later.');
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) throw new GarminAuthError(`Garmin ${path} → HTTP ${res.status}`, res.status);
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  async displayName(): Promise<string> {
    const profile = await this.get<{displayName?: string}>('/userprofile-service/socialProfile');
    if (!profile?.displayName) throw new GarminAuthError('Could not read Garmin profile');
    return profile.displayName;
  }
}
