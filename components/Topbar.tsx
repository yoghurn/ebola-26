'use client';

import { useEffect, useRef, type MouseEvent } from 'react';

interface TopbarProps {
  color: string;
  onSettingsClick: () => void;
  onProfileClick?: () => void;
  isSettingsOpen?: boolean;
  isProfileOpen?: boolean;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  onlineCount?: number | null;
  showThemeHint?: boolean;
  onThemeHintDismiss?: () => void;
}

export default function Topbar({ color, onSettingsClick, onProfileClick, isSettingsOpen, isProfileOpen, searchQuery, onSearchChange, onlineCount, showThemeHint, onThemeHintDismiss }: TopbarProps) {
  const logoRef = useRef<HTMLAnchorElement>(null);

  const scrollToTop = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/assets/logos/new_logo.svg');
        const svg = await response.text();
        const recoloredSVG = svg.replace(/fill="[^\"]*"/g, 'fill="currentColor"');
        if (logoRef.current) {
          logoRef.current.innerHTML = recoloredSVG;
        }
      } catch (e) {
        console.error('Could not load new_logo.svg', e);
      }
    };

    loadLogo();
  }, []);

  return (
    <div className="topbar">
      <div className="left">
        <a
          href="#top"
          className="logo"
          aria-label="Scroll to top"
          ref={logoRef}
          onClick={scrollToTop}
          style={{
            width: '156px',
            height: '72px',
            filter: 'drop-shadow(6px 0px 0px rgba(0,0,0,0.25)) drop-shadow(0px 1px 2px rgba(0,0,0,0.25))',
            color,
          }}
        />
        {onlineCount !== undefined && (
          <div className="topbar-online-count">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden="true"
              style={{ marginRight: '6px', verticalAlign: 'middle' }}
            >
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                fill="currentColor"
              />
            </svg>
            {onlineCount === null ? 'players offline' : `${onlineCount} ${onlineCount === 1 ? 'player' : 'players'} online`}
          </div>
        )}
      </div>
      <div className="right">
        {typeof searchQuery === 'string' && onSearchChange && (
          <input
            type="text"
            className="search-input topbar-search"
            placeholder="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        )}
        {onProfileClick && (
          <a
            id="profileButton"
            aria-label="Open profile"
            onClick={onProfileClick}
            className={isProfileOpen ? 'settings-open' : undefined}
            style={{ cursor: 'pointer' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="26"
              height="26"
              aria-hidden="true"
            >
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                fill="currentColor"
              />
            </svg>
          </a>
        )}
        <a
          id="settingsButton"
          aria-label="Open settings"
          onClick={onSettingsClick}
          className={isSettingsOpen ? 'settings-open' : undefined}
          style={{ cursor: 'pointer' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            aria-hidden="true"
          >
            <path
              d="m22.683 9.394-1.88-.239a9.45 9.45 0 0 0-.569-1.374l1.161-1.495a1.486 1.486 0 0 0-.122-1.979l-1.575-1.575a1.49 1.49 0 0 0-1.985-.127L16.22 3.766a9.416 9.416 0 0 0-1.375-.569l-.239-1.877A1.498 1.498 0 0 0 13.12 0h-2.24c-.757 0-1.396.567-1.486 1.317l-.239 1.88a9.307 9.307 0 0 0-1.375.569L6.286 2.605a1.488 1.488 0 0 0-1.979.122L2.732 4.301a1.49 1.49 0 0 0-.127 1.986l1.161 1.494a9.34 9.34 0 0 0-.569 1.374l-1.877.239C.567 9.484 0 10.123 0 10.88v2.24c0 .757.567 1.396 1.317 1.486l1.88.239c.155.477.346.937.569 1.374l-1.161 1.495a1.486 1.486 0 0 0 .122 1.979l1.575 1.575a1.492 1.492 0 0 0 1.985.126l1.494-1.161c.437.224.897.415 1.374.569l.239 1.876c.09.755.729 1.322 1.486 1.322h2.24c.757 0 1.396-.567 1.486-1.317l.239-1.88a9.45 9.45 0 0 0 1.374-.569l1.495 1.161c.605.47 1.459.415 1.979-.122l1.575-1.575a1.49 1.49 0 0 0 .127-1.985l-1.161-1.494c.224-.437.415-.897.569-1.374l1.876-.239a1.498 1.498 0 0 0 1.32-1.486v-2.24a1.496 1.496 0 0 0-1.316-1.486zM12 17c-2.757 0-5-2.243-5-5s2.243-5 5-5 5 2.243 5 5-2.243 5-5 5z"
              fill="currentColor"
            />
          </svg>
        </a>
        {showThemeHint && (
          <div className="theme-hint-popup">
            <p>You can change the color of your theme in settings!</p>
            {onThemeHintDismiss && (
              <button type="button" className="theme-hint-dismiss" onClick={onThemeHintDismiss}>
                dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
