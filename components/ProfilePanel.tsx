'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';
import {
  getCodeValidationMessage,
  getUsernameValidationMessage,
  normalizeUsername,
  usernameToEmail,
} from '../lib/supabaseAuth';

interface ProfilePanelProps {
  isOpen: boolean;
}

export default function ProfilePanel({ isOpen }: ProfilePanelProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [statusMessage, setStatusMessage] = useState('Use your username and code to sign in or create an account.');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setStatusMessage(`Signed in as ${normalizedUsername}.`);
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
        setStatusMessage(`Created and signed in as ${normalizedUsername}.`);
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
      setStatusMessage('Signed out.');
      setUsername('');
      setCode('');
    }
    setIsSubmitting(false);
  };

  return (
    <div className={`profile-panel ${isOpen ? 'show' : ''}`}>
      <div className="settings-header">
        <h3>profile</h3>
      </div>

      <section className="settings-section">
        {session ? (
          <>
            <div className="profile-session-card">
              <div className="settings-section-title">signed in</div>
              <div className="profile-session-name">{currentUsername || session.user.email || 'account'}</div>
              <p className="settings-help">Your session is stored locally in Supabase auth.</p>
            </div>
            <div className="settings-actions">
              <button type="button" className="settings-action" onClick={handleSignOut} disabled={isSubmitting}>
                {isSubmitting ? 'signing out...' : 'sign out'}
              </button>
            </div>
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
  );
}
