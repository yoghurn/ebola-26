const USERNAME_EMAIL_DOMAIN = 'users.ebola.local';

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(value);
}

export function usernameToEmail(username: string) {
  return `${username}@${USERNAME_EMAIL_DOMAIN}`;
}

export function getUsernameValidationMessage(username: string) {
  if (!username) {
    return 'Enter a username.';
  }

  if (!isValidUsername(username)) {
    return 'Username must be 3-32 characters and use letters, numbers, dots, dashes, or underscores.';
  }

  return null;
}

export function getCodeValidationMessage(code: string) {
  if (!code) {
    return 'Enter a code.';
  }

  if (code.length < 6) {
    return 'Code must be at least 6 characters.';
  }

  return null;
}
