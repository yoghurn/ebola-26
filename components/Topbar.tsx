'use client';

import { useEffect, useRef } from 'react';

interface TopbarProps {
  color: string;
  onSettingsClick: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  onlineCount?: number | null;
}

export default function Topbar({ color, onSettingsClick, searchQuery, onSearchChange, onlineCount }: TopbarProps) {
  const logoRef = useRef<HTMLAnchorElement>(null);

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
          href="/arcade/"
          className="logo"
          aria-label="Arcade home"
          ref={logoRef}
          style={{
            width: '156px',
            height: '72px',
            filter: 'drop-shadow(6px 0px 0px rgba(0,0,0,0.25)) drop-shadow(0px 1px 2px rgba(0,0,0,0.25))',
            color,
          }}
        />
        {onlineCount !== undefined && (
          <span className="topbar-online-count">
            {onlineCount === null ? 'players offline' : `${onlineCount} players online`}
          </span>
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
        <a
          id="settingsButton"
          aria-label="Open settings"
          onClick={onSettingsClick}
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
      </div>
    </div>
  );
}
