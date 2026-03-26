const GAME_PROGRESS_KEY = 'gameProgress';
const CLOUD_COOKIE_KEYS = [
  'customColor',
  'favorites',
  'recentlyPlayed',
  'showHomeButton',
  'showFlashGames',
  'showPortGames',
  'showEmulatorGames',
] as const;

type CloudCookieKey = (typeof CLOUD_COOKIE_KEYS)[number];

export interface CloudSyncState {
  gameProgress: string;
  cookies: Partial<Record<CloudCookieKey, string>>;
}

function normalizeProgressValue(value: string | null) {
  if (!value) {
    return '{}';
  }

  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return '{}';
  }
}

function readCookie(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  return parts.length === 2 ? parts.pop()?.split(';').shift() ?? null : null;
}

function writeCookie(name: CloudCookieKey, value: string) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${name}=${value}; expires=${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()}; path=/`;
}

function normalizeCloudSyncState(state: unknown): CloudSyncState {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return {
      gameProgress: '{}',
      cookies: {},
    };
  }

  const candidate = state as { gameProgress?: unknown; cookies?: unknown };

  if ('gameProgress' in candidate || 'cookies' in candidate) {
    const cookies =
      candidate.cookies && typeof candidate.cookies === 'object' && !Array.isArray(candidate.cookies)
        ? Object.fromEntries(
            Object.entries(candidate.cookies).filter(
              ([key, value]) => CLOUD_COOKIE_KEYS.includes(key as CloudCookieKey) && typeof value === 'string',
            ),
          )
        : {};

    return {
      gameProgress: normalizeProgressValue(
        typeof candidate.gameProgress === 'string' ? candidate.gameProgress : JSON.stringify(candidate.gameProgress ?? {}),
      ),
      cookies,
    };
  }

  return {
    gameProgress: normalizeProgressValue(JSON.stringify(state)),
    cookies: {},
  };
}

export function readLocalGameProgress() {
  if (typeof window === 'undefined') {
    return '{}';
  }

  return normalizeProgressValue(window.localStorage.getItem(GAME_PROGRESS_KEY));
}

export function writeLocalGameProgress(progress: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(GAME_PROGRESS_KEY, normalizeProgressValue(progress));
}

export function ensureLocalGameProgress() {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.localStorage.getItem(GAME_PROGRESS_KEY)) {
    window.localStorage.setItem(GAME_PROGRESS_KEY, '{}');
  }
}

export function readLocalCloudSyncState() {
  const cookies: Partial<Record<CloudCookieKey, string>> = {};

  if (typeof document !== 'undefined') {
    for (const key of CLOUD_COOKIE_KEYS) {
      const value = readCookie(key);
      if (value !== null) {
        cookies[key] = value;
      }
    }
  }

  return {
    gameProgress: readLocalGameProgress(),
    cookies,
  } satisfies CloudSyncState;
}

export function writeLocalCloudSyncState(state: unknown) {
  const normalizedState = normalizeCloudSyncState(state);
  writeLocalGameProgress(normalizedState.gameProgress);

  for (const [key, value] of Object.entries(normalizedState.cookies)) {
    writeCookie(key as CloudCookieKey, value);
  }
}

export function serializeCloudSyncState(state: CloudSyncState) {
  return JSON.stringify({
    gameProgress: JSON.parse(normalizeProgressValue(state.gameProgress)),
    cookies: state.cookies,
  });
}

export function serializeLocalCloudSyncState() {
  return serializeCloudSyncState(readLocalCloudSyncState());
}

export function normalizeCloudSyncPayload(payload: unknown) {
  return normalizeCloudSyncState(payload);
}
