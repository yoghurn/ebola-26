'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';
import {
  clearLocalCloudSyncState,
  ensureLocalGameProgress,
  normalizeCloudSyncPayload,
  readLocalCloudSyncState,
  serializeCloudSyncState,
  serializeLocalCloudSyncState,
  writeLocalCloudSyncState,
} from '../lib/gameProgress';
import {
  getCodeValidationMessage,
  getUsernameValidationMessage,
  normalizeUsername,
  usernameToEmail,
} from '../lib/supabaseAuth';

interface ProfilePanelProps {
  isOpen: boolean;
}

interface CloudProgressRecord {
  progress: unknown;
  syncedAt: string | null;
}

export default function ProfilePanel({ isOpen }: ProfilePanelProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const lastSyncedStateRef = useRef<string | null>(null);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [cloudProgress, setCloudProgress] = useState<CloudProgressRecord | null>(null);
  const [showSyncMenu, setShowSyncMenu] = useState(false);

  useEffect(() => {
    ensureLocalGameProgress();
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setErrorMessage('');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const currentUsername = session?.user.user_metadata?.username as string | undefined;
  const hasCloudProgress = cloudProgress?.progress !== null && cloudProgress?.progress !== undefined;
  const lastSyncedLabel = cloudProgress?.syncedAt
    ? new Date(cloudProgress.syncedAt).toLocaleString()
    : 'No cloud backup yet';

  const getAccessToken = async () => {
    if (!supabase) {
      return null;
    }

    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const loadCloudProgressRecord = async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return null;
    }

    const response = await fetch('/api/progress', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = (await response.json().catch(() => null)) as
      | { progress?: unknown; syncedAt?: string | null; error?: string }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error || 'Could not load cloud progress.');
    }

    return {
      progress: payload?.progress ?? null,
      syncedAt: payload?.syncedAt ?? null,
    } satisfies CloudProgressRecord;
  };

  const replaceCloudWithCurrentProgress = async () => {
    const localState = readLocalCloudSyncState();
    const serializedLocalState = serializeCloudSyncState(localState);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Missing session token.');
    }

    const response = await fetch('/api/progress', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        progress: serializedLocalState,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { syncedAt?: string; error?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.error || 'Could not sync current progress.');
    }

    const nextRecord = {
      progress: localState,
      syncedAt: payload?.syncedAt ?? null,
    } satisfies CloudProgressRecord;

    lastSyncedStateRef.current = serializedLocalState;
    setCloudProgress(nextRecord);
    return nextRecord;
  };

  const resetFeedback = () => {
    setErrorMessage('');
    setStatusMessage('Use your username and code to sign in or create an account.');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add the required environment variables.');
      return;
    }

    const normalizedUsername = normalizeUsername(username);
    const usernameError = getUsernameValidationMessage(normalizedUsername);
    if (usernameError) {
      setErrorMessage(usernameError);
      return;
    }

    const codeError = getCodeValidationMessage(code);
    if (codeError) {
      setErrorMessage(codeError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('Checking account...');

    const email = usernameToEmail(normalizedUsername);
    const signInResult = await supabase.auth.signInWithPassword({
      email,
      password: code,
    });

    if (!signInResult.error) {
      try {
        const cloudRecord = await loadCloudProgressRecord();
        setCloudProgress(cloudRecord);
        lastSyncedStateRef.current = cloudRecord?.progress ? serializeCloudSyncState(normalizeCloudSyncPayload(cloudRecord.progress)) : null;
        if (cloudRecord?.progress) {
          setStatusMessage(
            cloudRecord?.syncedAt
              ? `Signed in. Cloud progress is available from ${new Date(cloudRecord.syncedAt).toLocaleString()}, but your current local progress was kept.`
              : 'Signed in. Cloud progress is available, but your current local progress was kept.',
          );
        } else {
          setShowSyncMenu(false);
          setStatusMessage('Signed in. No cloud progress found for this account.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load cloud progress.';
        setErrorMessage(message);
      }
      setCode('');
      setIsSubmitting(false);
      return;
    }

    const signUpResponse = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: normalizedUsername,
        code,
      }),
    });

    if (signUpResponse.ok) {
      const retrySignIn = await supabase.auth.signInWithPassword({
        email,
        password: code,
      });

      if (!retrySignIn.error) {
        try {
          const cloudRecord = await replaceCloudWithCurrentProgress();
          setShowSyncMenu(false);
          setStatusMessage(
            cloudRecord.syncedAt
              ? `Last synced at: ${new Date(cloudRecord.syncedAt).toLocaleString()}`
              : 'Last synced at: not synced yet',
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Account created, but cloud sync failed.';
          setErrorMessage(message);
        }
        setCode('');
        setIsSubmitting(false);
        return;
      }

      setErrorMessage(retrySignIn.error.message);
      setIsSubmitting(false);
      return;
    }

    const signUpPayload = (await signUpResponse.json().catch(() => null)) as { error?: string } | null;
    if (signUpResponse.status === 409) {
      setErrorMessage('That username already exists. If it is yours, the code is incorrect.');
    } else {
      setErrorMessage(signUpPayload?.error || signInResult.error.message);
    }
    setIsSubmitting(false);
  };

  const handleSignOut = async () => {
    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add the required environment variables.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage(error.message);
    } else {
      clearLocalCloudSyncState();
      setStatusMessage('Signed out.');
      setUsername('');
      setCode('');
      setCloudProgress(null);
      setShowSyncMenu(false);
      setShowLogoutConfirm(false);
      lastSyncedStateRef.current = null;
      window.location.reload();
    }
    setIsSubmitting(false);
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add the required environment variables.');
      return;
    }

    const codeError = getCodeValidationMessage(newCode);
    if (codeError) {
      setErrorMessage(codeError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const { error } = await supabase.auth.updateUser({
      password: newCode,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setStatusMessage('Code updated.');
      setNewCode('');
      setShowChangePassword(false);
    }

    setIsSubmitting(false);
  };

  const handleLoadCloudProgress = async () => {
    if (!hasCloudProgress) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      writeLocalCloudSyncState(cloudProgress?.progress ?? {});
      lastSyncedStateRef.current = cloudProgress?.progress
        ? serializeCloudSyncState(normalizeCloudSyncPayload(cloudProgress.progress))
        : serializeLocalCloudSyncState();
      setShowSyncMenu(false);
      setStatusMessage(
        `Loaded cloud progress${cloudProgress?.syncedAt ? ` from ${new Date(cloudProgress.syncedAt).toLocaleString()}` : ''}.`,
      );
      setShowLoadConfirm(false);
      window.location.reload();
    } catch {
      setErrorMessage('Could not load cloud progress into local storage.');
    }

    setIsSubmitting(false);
  };

  const handleReplaceWithCurrentProgress = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const nextRecord = await replaceCloudWithCurrentProgress();
      setShowSyncMenu(false);
      setStatusMessage(
        `Cloud progress replaced with current progress${nextRecord.syncedAt ? ` at ${new Date(nextRecord.syncedAt).toLocaleString()}` : ''}.`,
      );
      setShowSaveConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not replace cloud progress.';
      setErrorMessage(message);
    }

    setIsSubmitting(false);
  };

  return (
    <>
      <div className={`profile-panel ${isOpen ? 'show' : ''}`}>
        <div className="settings-header">
          <h3>profile</h3>
        </div>

        <section className="settings-section">
        {session ? (
          <>
            {showSyncMenu && (
              <div className="profile-sync-menu">
                <div className="settings-section-title">sync progress</div>
                <button
                  type="button"
                  className="profile-sync-option"
                  onClick={() => {
                    setShowLoadConfirm((current) => !current);
                    setShowSaveConfirm(false);
                    setErrorMessage('');
                    setStatusMessage('');
                  }}
                  disabled={isSubmitting || !hasCloudProgress}
                >
                  <span className="profile-sync-option-title">Load Game Progress</span>
                  <span className="profile-sync-option-description">
                    {hasCloudProgress
                      ? `This will replace your current progress with the progress you saved on the cloud. Last synced at: ${lastSyncedLabel}`
                      : 'This will replace your current progress with the progress you saved on the cloud. No cloud progress is saved yet.'}
                  </span>
                </button>
                <button
                  type="button"
                  className="profile-sync-option"
                  onClick={() => {
                    setShowSaveConfirm((current) => !current);
                    setShowLoadConfirm(false);
                    setErrorMessage('');
                    setStatusMessage('');
                  }}
                  disabled={isSubmitting}
                >
                  <span className="profile-sync-option-title">Save Game Progress</span>
                  <span className="profile-sync-option-description">
                    This replaces your progress on the cloud with your current progress. This action is permanent.
                  </span>
                </button>
                {showLoadConfirm && (
                  <div className="profile-session-card profile-confirm-card">
                    <div className="settings-section-title">confirm load</div>
                    <p className="settings-help">
                      Press load game progress to replace your current local progress with the cloud copy.
                    </p>
                    <div className="settings-actions">
                      <button
                        type="button"
                        className="settings-action"
                        onClick={handleLoadCloudProgress}
                        disabled={isSubmitting || !hasCloudProgress}
                      >
                        {isSubmitting ? 'loading...' : 'load game progress'}
                      </button>
                    </div>
                  </div>
                )}
                {showSaveConfirm && (
                  <div className="profile-session-card profile-confirm-card">
                    <div className="settings-section-title">confirm save</div>
                    <p className="settings-help">
                      Press save game progress to replace your cloud progress with the current local copy.
                    </p>
                    <div className="settings-actions">
                      <button
                        type="button"
                        className="settings-action"
                        onClick={handleReplaceWithCurrentProgress}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'saving...' : 'save game progress'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="profile-session-card">
              <div className="settings-section-title">signed in as</div>
              <div className="profile-session-name">@{currentUsername || session.user.email || 'account'}</div>
              <p className="settings-help">
                {cloudProgress?.syncedAt ? `Last synced at: ${lastSyncedLabel}` : 'No cloud progress synced yet.'}
              </p>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-action"
                onClick={async () => {
                  setIsSubmitting(true);
                  setErrorMessage('');

                  try {
                    const cloudRecord = await loadCloudProgressRecord();
                    setCloudProgress(cloudRecord);
                    lastSyncedStateRef.current = cloudRecord?.progress
                      ? serializeCloudSyncState(normalizeCloudSyncPayload(cloudRecord.progress))
                      : null;
                    setShowSyncMenu(true);
                    setStatusMessage(
                      cloudRecord?.syncedAt
                        ? `Last synced at: ${new Date(cloudRecord.syncedAt).toLocaleString()}`
                        : 'Last synced at: not synced yet',
                    );
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Could not open sync options.';
                    setErrorMessage(message);
                  }

                  setIsSubmitting(false);
                }}
                disabled={isSubmitting}
              >
                sync options
              </button>
              <button
                type="button"
                className="settings-action"
                onClick={() => {
                  setShowChangePassword((current) => !current);
                  setShowLogoutConfirm(false);
                  setErrorMessage('');
                  setStatusMessage('');
                }}
                disabled={isSubmitting}
              >
                {showChangePassword ? 'cancel password change' : 'change password'}
              </button>
              <button
                type="button"
                className="settings-action"
                onClick={() => {
                  setShowLogoutConfirm((current) => !current);
                  setShowChangePassword(false);
                  setErrorMessage('');
                  setStatusMessage('');
                }}
                disabled={isSubmitting}
              >
                {showLogoutConfirm ? 'cancel logout' : 'sign out'}
              </button>
            </div>
            {showLogoutConfirm && (
              <div className="profile-session-card profile-confirm-card">
                <div className="settings-section-title">confirm logout</div>
                <p className="settings-help">Press log out to sign out of this account on this browser.</p>
                <div className="settings-actions">
                  <button type="button" className="settings-action" onClick={handleSignOut} disabled={isSubmitting}>
                    {isSubmitting ? 'signing out...' : 'log out'}
                  </button>
                </div>
              </div>
            )}
            {showChangePassword && (
              <form className="profile-form profile-password-form" onSubmit={handleChangePassword}>
                <label className="settings-label" htmlFor="profileNewCode">
                  new code
                  <input
                    id="profileNewCode"
                    type="password"
                    className="settings-text-input"
                    placeholder="enter a new code"
                    autoComplete="new-password"
                    value={newCode}
                    onChange={(event) => {
                      setNewCode(event.target.value);
                      setErrorMessage('');
                      setStatusMessage('');
                    }}
                    disabled={isSubmitting}
                  />
                </label>
                <div className="settings-actions">
                  <button type="submit" className="settings-action" disabled={isSubmitting}>
                    {isSubmitting ? 'updating...' : 'update password'}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <form className="profile-form" onSubmit={handleSubmit}>
              <label className="settings-label" htmlFor="profileHandle">
                username
                <input
                  id="profileHandle"
                  type="text"
                  className="settings-text-input"
                  placeholder="enter your username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    resetFeedback();
                  }}
                  disabled={isSubmitting}
                />
              </label>

              <label className="settings-label" htmlFor="profileCode">
                code
                <input
                  id="profileCode"
                  type="password"
                  className="settings-text-input"
                  placeholder="enter your code"
                  autoComplete="current-password"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    resetFeedback();
                  }}
                  disabled={isSubmitting}
                />
              </label>

              <div className="settings-actions">
                <button type="submit" className="settings-action" disabled={isSubmitting}>
                  {isSubmitting ? 'working...' : 'continue'}
                </button>
              </div>
            </form>
        )}

        <p className="settings-help">{statusMessage}</p>
        {errorMessage && <p className="profile-auth-error">{errorMessage}</p>}
        </section>
      </div>
    </>
  );
}
