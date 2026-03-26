const GAME_PROGRESS_KEY = 'gameProgress';

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
