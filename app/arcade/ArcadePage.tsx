'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Topbar from '../../components/Topbar';
import SettingsPanel from '../../components/SettingsPanel';
import ProfilePanel from '../../components/ProfilePanel';
import Bottombar from '../../components/Bottombar';
import { generatePaletteFromHex, type ColorPalette } from '../../lib/colorUtils';
import { useOnlineCount } from '../../lib/useOnlineCount';
import { updateFaviconWithTheme } from '../../lib/faviconUtils';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';
import { readLocalCloudSyncState, serializeCloudSyncState } from '../../lib/gameProgress';

interface Game {
  gameID: number;
  name: string;
  path: string;
  thumbnail: string;
  dateAdded: string;
  tags?: string[];
  special?: string[];
}

export default function ArcadePage() {
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Game[]>([]);
  const [favorites, setFavorites] = useState<Game[]>([]);
  const [customColor, setCustomColor] = useState<string>('#FFFFFF');
  const [colorPalette, setColorPalette] = useState<ColorPalette>(generatePaletteFromHex('#FFFFFF'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [saveProgressMessage, setSaveProgressMessage] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authGateMessage, setAuthGateMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHomeButton, setShowHomeButton] = useState(true);
  const [showFlashGames, setShowFlashGames] = useState(true);
  const [showPortGames, setShowPortGames] = useState(false);
  const [showEmulatorGames, setShowEmulatorGames] = useState(false);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [splashFading, setSplashFading] = useState(false);
  const [splashLogoMarkup, setSplashLogoMarkup] = useState('');
  const [requireSignIn, setRequireSignIn] = useState(true);
  const onlineCount = useOnlineCount();

  const MAX_RECENT = 5;
  const SPLASH_THRESHOLD_MS = 60_000;

  // Cookie utilities
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop()?.split(';').shift() : null;
  };

  const setCookie = (name: string, value: string, days: number = 30) => {
    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = `${name}=${value}${expires}; path=/`;
  };

  // Recently Played
  const getRecentlyPlayedFromStorage = () => {
    const cookie = getCookie('recentlyPlayed');
    if (!cookie) return [];
    try {
      return JSON.parse(cookie);
    } catch {
      return [];
    }
  };

  const saveRecentlyPlayed = (games: Game[]) => {
    setCookie('recentlyPlayed', JSON.stringify(games));
    setRecentlyPlayed(games);
  };

  const addRecentlyPlayed = (game: Game) => {
    const recent = getRecentlyPlayedFromStorage().filter((g: Game) => g.name !== game.name);
    recent.unshift(game);
    if (recent.length > MAX_RECENT) recent.pop();
    saveRecentlyPlayed(recent);
  };

  // Favorites
  const getFavoritesFromStorage = () => {
    const cookie = getCookie('favorites');
    if (!cookie) return [];
    try {
      return JSON.parse(cookie);
    } catch {
      return [];
    }
  };

  const saveFavorites = (games: Game[]) => {
    setCookie('favorites', JSON.stringify(games));
    setFavorites(games);
  };

  const isFavorited = (game: Game, favs: Game[] = favorites) => {
    return favs.some(f => f.name === game.name);
  };

  const toggleFavorite = (game: Game) => {
    const favs = getFavoritesFromStorage();
    let newFavs;
    if (isFavorited(game, favs)) {
      newFavs = favs.filter((f: Game) => f.name !== game.name);
    } else {
      newFavs = [...favs, game];
    }
    saveFavorites(newFavs);
    updateGamesDisplay(searchQuery, newFavs);
  };

  const sortGames = (games: Game[], favs: Game[] = favorites) => {
    return games.sort((a, b) => {
      const aFav = isFavorited(a, favs);
      const bFav = isFavorited(b, favs);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
    });
  };

  const updateGamesDisplay = (query: string, favs?: Game[]) => {
    const currentFavs = favs || getFavoritesFromStorage();
    const normalizedQuery = query.trim().toLowerCase();
    let gamesToDisplay = allGames.filter((g) => {
      if (g.special?.includes('fnf')) return false;
      if (showFlashGames && g.special?.includes('flash')) return false;
      if (showPortGames && g.special?.includes('port')) return false;
      if (showEmulatorGames && g.special?.includes('emulator')) return false;
      return true;
    });
    if (normalizedQuery) {
      gamesToDisplay = gamesToDisplay.filter(g => {
        const nameMatch = (g.name || '').toLowerCase().includes(normalizedQuery);
        const tagMatch = g.tags && g.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));
        return nameMatch || tagMatch;
      });
    }
    setFilteredGames(sortGames(gamesToDisplay, currentFavs));
  };

  const setThemeStyle = (hexColor: string) => {
    const palette = generatePaletteFromHex(hexColor);
    const root = document.documentElement;
    root.style.setProperty('--bg-color', palette.bg);
    root.style.setProperty('--text-color', palette.text);
    root.style.setProperty('--link-color', palette.link);
    root.style.setProperty('--link-hover-color', palette.hover);
    root.style.setProperty('--card-border-color', palette.border);
    root.style.setProperty('--card-overlay-color', palette.overlay);
    root.style.setProperty('--bottombar-border-color', palette.bottomBorder);
    root.style.setProperty('--bottombar-opacity', palette.opacity.toString());
    setCookie('customColor', hexColor);
    setCustomColor(hexColor);
    setColorPalette(palette);
    setIsThemeLoaded(true);
    updateFaviconWithTheme(palette.bg, palette.text);
  };

  const exportProgress = () => {
    const allStorage: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allStorage[key] = localStorage.getItem(key) || '';
    }
    const blob = new Blob([JSON.stringify(allStorage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'localStorage_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importProgress = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem('gameProgress', JSON.stringify(JSON.parse(reader.result as string)));
        alert('Game progress imported successfully!');
      } catch {
        alert('Invalid JSON file. Please select a valid game progress file.');
      }
    };
    reader.readAsText(file);
  };

  const saveProgressToCloud = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setSaveProgressMessage('supabase is not configured');
      return;
    }

    setIsSavingProgress(true);
    setSaveProgressMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setSaveProgressMessage('sign in to save progress');
        return;
      }

      const response = await fetch('/api/progress', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          progress: serializeCloudSyncState(readLocalCloudSyncState()),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { syncedAt?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'could not save progress');
      }

      setSaveProgressMessage(
        payload?.syncedAt ? `saved ${new Date(payload.syncedAt).toLocaleString()}` : 'progress saved',
      );
    } catch (error) {
      setSaveProgressMessage(error instanceof Error ? error.message : 'could not save progress');
    } finally {
      setIsSavingProgress(false);
    }
  };

  useEffect(() => {
    // Load auth configuration
    fetch('/authConfig.json')
      .then(res => res.json())
      .then(config => {
        setRequireSignIn(config.requireSignIn ?? true);
      })
      .catch(() => {
        // Default to true if config file is not found
        setRequireSignIn(true);
      });
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      if (!data.session && requireSignIn) {
        setProfileOpen(true);
        setSettingsOpen(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession) {
        setAuthGateMessage('');
      } else if (requireSignIn) {
        setProfileOpen(true);
        setSettingsOpen(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Initialize theme immediately
  useEffect(() => {
    const savedColor = getCookie('customColor') || '#FFFFFF';
    setThemeStyle(savedColor);
  }, []);

  useEffect(() => {
    try {
      const now = Date.now();
      const lastOpenedAt = Number(localStorage.getItem('lastOpenedAt') || '0');
      const shouldShowSplash = !lastOpenedAt || now - lastOpenedAt >= SPLASH_THRESHOLD_MS;

      setShowSplash(shouldShowSplash);
      setSplashFading(false);
      localStorage.setItem('lastOpenedAt', String(now));
    } catch {
      setShowSplash(true);
      setSplashFading(false);
    }
  }, []);

  useEffect(() => {
    if (!showSplash) return;

    let cancelled = false;

    const loadLogo = async () => {
      try {
        const response = await fetch('/assets/logos/new_logo.svg');
        const svg = await response.text();
        const recoloredSVG = svg.replace(/fill="[^\"]*"/g, 'fill="currentColor"');
        if (!cancelled) {
          setSplashLogoMarkup(recoloredSVG);
        }
      } catch (error) {
        console.error('Could not load splash logo', error);
      }
    };

    loadLogo();

    return () => {
      cancelled = true;
    };
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash || !isThemeLoaded) return;

    const fadeTimer = window.setTimeout(() => setSplashFading(true), 1400);
    const removeTimer = window.setTimeout(() => setShowSplash(false), 1950);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [showSplash, isThemeLoaded]);

  useEffect(() => {
    updateGamesDisplay(searchQuery);
  }, [allGames, showFlashGames, showPortGames, showEmulatorGames]);

  // Initialize other settings
  useEffect(() => {
    const savedShowHomeButton = getCookie('showHomeButton');
    if (savedShowHomeButton === null) {
      setCookie('showHomeButton', 'true');
      setShowHomeButton(true);
    } else {
      setShowHomeButton(savedShowHomeButton !== 'false');
    }

    const savedShowFlashGames = getCookie('showFlashGames');
    if (savedShowFlashGames === null) {
      setCookie('showFlashGames', 'true');
      setShowFlashGames(true);
    } else {
      setShowFlashGames(savedShowFlashGames !== 'false');
    }

    const savedShowPortGames = getCookie('showPortGames');
    if (savedShowPortGames === null) {
      setCookie('showPortGames', 'false');
      setShowPortGames(false);
    } else {
      setShowPortGames(savedShowPortGames === 'true');
    }

    const savedShowEmulatorGames = getCookie('showEmulatorGames');
    if (savedShowEmulatorGames === null) {
      setCookie('showEmulatorGames', 'false');
      setShowEmulatorGames(false);
    } else {
      setShowEmulatorGames(savedShowEmulatorGames === 'true');
    }

    // Load games, blacklist, and forced includes
    Promise.all([
      fetch('https://cdn.jsdelivr.net/gh/freebuisness/assets@master/zones.json').then(res => res.json()),
      fetch('/blacklist.json').then(res => res.json()),
      fetch('/forcedGames.json').then(res => res.json()).catch(() => []),
      fetch('/localGames.json').then(res => res.json()).catch(() => [])
    ])
      .then(([gamesData, blacklist, forcedGames, localGames]) => {
        const blacklistIds = new Set(blacklist);
        const forcedGameIds = new Set(forcedGames);
        const allGamesList: Game[] = [];

        // Add CDN games
        if (gamesData?.length) {
          const cdnGames = gamesData
            .filter((g: any) => !blacklistIds.has(g.id) || forcedGameIds.has(g.id))
            .map((g: any) => ({
              gameID: g.id,
              name: g.name,
              path: `/arcade/${g.id}`,
              thumbnail: `https://cdn.jsdelivr.net/gh/freebuisness/covers@main/${g.id}.png`,
              dateAdded: '0',
              tags: [],
              special: g.special || []
            })) as Game[];
          allGamesList.push(...cdnGames);
        }

        // Add local games
        if (localGames?.length) {
          const local = localGames
            .map((g: any) => ({
              gameID: g.id,
              name: g.name,
              path: g.url,
              thumbnail: g.cover,
              dateAdded: '0',
              tags: g.tags || [],
              special: g.special || []
            })) as Game[];
          allGamesList.push(...local);
        }

        setAllGames(allGamesList);
      })
      .catch(err => console.error('Error loading game list:', err));

    // Load recently played
    const recent = getRecentlyPlayedFromStorage();
    setRecentlyPlayed(recent);

    // Load favorites
    const favs = getFavoritesFromStorage();
    setFavorites(favs);

    // Initialize localStorage
    if (!localStorage.getItem('gameProgress')) {
      localStorage.setItem('gameProgress', '{}');
    }

    // Handle tree.html easter egg
    const sequence = ['t', 'r', 'e', 'e'];
    let currentIndex = 0;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === sequence[currentIndex]) {
        currentIndex++;
        if (currentIndex === sequence.length) {
          window.location.href = '/arcade/tree.html';
        }
      } else {
        currentIndex = 0;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <style>
        {`
          :root {
            --bg-color: ${colorPalette.bg};
            --text-color: ${colorPalette.text};
            --link-color: ${colorPalette.link};
            --link-hover-color: ${colorPalette.hover};
            --card-border-color: ${colorPalette.border};
            --card-overlay-color: ${colorPalette.overlay};
            --bottombar-border-color: ${colorPalette.bottomBorder};
            --bottombar-opacity: ${colorPalette.opacity.toString()};
          }
        `}
      </style>
      
      {(!isThemeLoaded || showSplash) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: colorPalette.bg,
          zIndex: 9999
        }}>
          {showSplash && (
            <div className={`startup-splash ${splashFading ? 'fade-out' : ''}`}>
              <div className="startup-splash-glow" />
              <div
                className="startup-splash-logo"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: splashLogoMarkup }}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Topbar */}
      <Topbar
        color={customColor}
        onSettingsClick={() => {
          if (!session && requireSignIn) {
            setProfileOpen(true);
            setAuthGateMessage('you must have an account to use this site');
            return;
          }
          setSettingsOpen(!settingsOpen);
          setProfileOpen(false);
        }}
        isSettingsOpen={settingsOpen}
        onProfileClick={() => {
          if (!session && requireSignIn) {
            setProfileOpen(true);
            setAuthGateMessage('');
            return;
          }
          setProfileOpen(!profileOpen);
          setSettingsOpen(false);
        }}
        isProfileOpen={profileOpen}
        onlineCount={onlineCount}
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          updateGamesDisplay(value);
        }}
      />

      {/* Main Content */}
      <div className="main-content">
        <div className="games-container">
          {/* Recently Played */}
          <div className="grid-section">
            <h2 className="grid-title">recently played</h2>
            <div id="recentlyPlayedGrid">
              {recentlyPlayed.length === 0 ? (
                <p style={{ color: 'var(--link-color)' }}>you haven't played any games yet :(</p>
              ) : (
                recentlyPlayed.map(game => (
                  <a
                    key={`recent-${game.gameID}`}
                    href={game.path}
                    onClick={() => addRecentlyPlayed(game)}
                    className="card"
                    data-title={game.name}
                  >
                    <img src={game.thumbnail} alt={game.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                  </a>
                ))
              )}
            </div>
          </div>

          {/* All Games */}
          <div className="grid-section">
            <div className="grid-title-container">
              <h2 className="grid-title">all games ({filteredGames.length})</h2>
            </div>
            <div id="gameGrid">
              {filteredGames.map(game => (
                <a
                  key={`game-${game.gameID}`}
                  href={game.path}
                  onClick={() => addRecentlyPlayed(game)}
                  className={`card ${isFavorited(game) ? 'favorited' : ''}`}
                  data-title={game.name}
                >
                  <img src={game.thumbnail} alt={game.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', position: 'absolute', top: 0, left: 0 }} />
                  <div
                    className="favorite-badge"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite(game);
                    }}
                  >
                    {isFavorited(game) ? '★' : '☆'}
                  </div>
                  {game.tags?.includes('new') && (
                    <div className="new-badge">new</div>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        color={customColor}
        onColorChange={setThemeStyle}
        onExport={exportProgress}
        onImportClick={() => {
          const input = document.getElementById('importFile') as HTMLInputElement;
          input?.click();
        }}
        onFileImport={importProgress}
        showHomeButton={showHomeButton}
        onHomeButtonToggle={(nextValue) => {
          setShowHomeButton(nextValue);
          setCookie('showHomeButton', String(nextValue));
        }}
        showFlashGames={showFlashGames}
        onShowFlashGamesToggle={(nextValue) => {
          setShowFlashGames(nextValue);
          setCookie('showFlashGames', String(nextValue));
        }}
        showPortGames={showPortGames}
        onShowPortGamesToggle={(nextValue) => {
          setShowPortGames(nextValue);
          setCookie('showPortGames', String(nextValue));
        }}
        showEmulatorGames={showEmulatorGames}
        onShowEmulatorGamesToggle={(nextValue) => {
          setShowEmulatorGames(nextValue);
          setCookie('showEmulatorGames', String(nextValue));
        }}
      />
      <ProfilePanel isOpen={profileOpen} />

      {!session && requireSignIn && (
        <div
          onClick={() => {
            setProfileOpen(true);
            setSettingsOpen(false);
            setAuthGateMessage('you must have an account to use this site');
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1900,
            background: 'transparent',
          }}
        />
      )}

      {authGateMessage && !session && requireSignIn && (
        <div
          style={{
            position: 'fixed',
            right: '20px',
            bottom: '76px',
            zIndex: 1960,
            maxWidth: '260px',
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid var(--card-border-color)',
            background: 'color-mix(in srgb, var(--bg-color) 88%, white 4%)',
            color: 'var(--text-color)',
            fontSize: '12px',
            lineHeight: 1.4,
          }}
        >
          {authGateMessage}
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          right: '20px',
          bottom: '76px',
          zIndex: 960,
          display: 'grid',
          gap: '8px',
          justifyItems: 'end',
        }}
      >
        {saveProgressMessage && (
          <div
            style={{
              maxWidth: '260px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--card-border-color)',
              background: 'color-mix(in srgb, var(--bg-color) 88%, white 4%)',
              color: 'var(--text-color)',
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            {saveProgressMessage}
          </div>
        )}
        <button
          type="button"
          onClick={saveProgressToCloud}
          disabled={isSavingProgress}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid var(--card-border-color)',
            backgroundColor: 'var(--bg-color)',
            color: 'var(--text-color)',
            cursor: isSavingProgress ? 'default' : 'pointer',
            fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', 'Source Code Pro', 'Consolas', 'Courier New', monospace",
            fontSize: '13px',
          }}
        >
          {isSavingProgress ? 'saving...' : 'save progress'}
        </button>
      </div>

      {/* Bottombar */}
      <Bottombar />
    </>
  );
}
