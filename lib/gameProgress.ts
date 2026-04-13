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
const EXCLUDED_LOCAL_STORAGE_KEYS = ['lastOpenedAt'] as const;

type CloudCookieKey = (typeof CLOUD_COOKIE_KEYS)[number];
type ExcludedLocalStorageKey = (typeof EXCLUDED_LOCAL_STORAGE_KEYS)[number];

export interface CloudSyncState {
  gameProgress: string;
  localStorage: Record<string, string>;
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

function clearCookie(name: CloudCookieKey) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${name}=; expires=${new Date(0).toUTCString()}; path=/`;
}

function shouldSyncLocalStorageKey(key: string) {
  if (EXCLUDED_LOCAL_STORAGE_KEYS.includes(key as ExcludedLocalStorageKey)) {
    return false;
  }

  if (key.startsWith('sb-')) {
    return false;
  }

  return true;
}

function normalizeCloudSyncState(state: unknown): CloudSyncState {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return {
      gameProgress: '{}',
      localStorage: {},
      cookies: {},
    };
  }

  const candidate = state as { gameProgress?: unknown; localStorage?: unknown; cookies?: unknown };

  if ('gameProgress' in candidate || 'localStorage' in candidate || 'cookies' in candidate) {
    const cookies =
      candidate.cookies && typeof candidate.cookies === 'object' && !Array.isArray(candidate.cookies)
        ? Object.fromEntries(
            Object.entries(candidate.cookies).filter(
              ([key, value]) => CLOUD_COOKIE_KEYS.includes(key as CloudCookieKey) && typeof value === 'string',
            ),
          )
        : {};
    const localStorage =
      candidate.localStorage && typeof candidate.localStorage === 'object' && !Array.isArray(candidate.localStorage)
        ? Object.fromEntries(
            Object.entries(candidate.localStorage).filter(
              ([key, value]) => shouldSyncLocalStorageKey(key) && typeof value === 'string',
            ),
          )
        : {};

    return {
      gameProgress: normalizeProgressValue(
        typeof candidate.gameProgress === 'string' ? candidate.gameProgress : JSON.stringify(candidate.gameProgress ?? {}),
      ),
      localStorage,
      cookies,
    };
  }

  return {
    gameProgress: normalizeProgressValue(JSON.stringify(state)),
    localStorage: {
      [GAME_PROGRESS_KEY]: normalizeProgressValue(JSON.stringify(state)),
    },
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
  const localStorageSnapshot: Record<string, string> = {};

  if (typeof window !== 'undefined') {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !shouldSyncLocalStorageKey(key)) {
        continue;
      }

      const value = window.localStorage.getItem(key);
      if (value !== null) {
        localStorageSnapshot[key] = key === GAME_PROGRESS_KEY ? normalizeProgressValue(value) : value;
      }
    }
  }

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
    localStorage: {
      ...localStorageSnapshot,
      [GAME_PROGRESS_KEY]: readLocalGameProgress(),
    },
    cookies,
  } satisfies CloudSyncState;
}

export function writeLocalCloudSyncState(state: unknown) {
  const normalizedState = normalizeCloudSyncState(state);

  if (typeof window !== 'undefined') {
    const syncedKeys = new Set(Object.keys(normalizedState.localStorage));

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (!key || !shouldSyncLocalStorageKey(key)) {
        continue;
      }

      if (!syncedKeys.has(key)) {
        window.localStorage.removeItem(key);
      }
    }

    for (const [key, value] of Object.entries(normalizedState.localStorage)) {
      window.localStorage.setItem(key, key === GAME_PROGRESS_KEY ? normalizeProgressValue(value) : value);
    }
  }

  writeLocalGameProgress(normalizedState.gameProgress);

  for (const [key, value] of Object.entries(normalizedState.cookies)) {
    writeCookie(key as CloudCookieKey, value);
  }
}

export function serializeCloudSyncState(state: CloudSyncState) {
  return JSON.stringify({
    gameProgress: JSON.parse(normalizeProgressValue(state.gameProgress)),
    localStorage: state.localStorage,
    cookies: state.cookies,
  });
}

export function serializeLocalCloudSyncState() {
  return serializeCloudSyncState(readLocalCloudSyncState());
}

export function normalizeCloudSyncPayload(payload: unknown) {
  return normalizeCloudSyncState(payload);
}

export function clearLocalCloudSyncState() {
  if (typeof window !== 'undefined') {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (!key || key.startsWith('sb-')) {
        continue;
      }

      window.localStorage.removeItem(key);
    }
  }

  for (const key of CLOUD_COOKIE_KEYS) {
    clearCookie(key);
  }
}
