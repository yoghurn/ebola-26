'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../components/Topbar';
import SettingsPanel from '../../components/SettingsPanel';
import Bottombar from '../../components/Bottombar';
import { generatePaletteFromHex, type ColorPalette } from '../../lib/colorUtils';
import { useOnlineCount } from '../../lib/useOnlineCount';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [showHomeButton, setShowHomeButton] = useState(true);
  const [hideFlashGames, setHideFlashGames] = useState(true);
  const [hidePortGames, setHidePortGames] = useState(false);
  const [hideEmulatorGames, setHideEmulatorGames] = useState(false);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [hideSplash, setHideSplash] = useState(false);
  const [splashLogoMarkup, setSplashLogoMarkup] = useState('');
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
      if (hideFlashGames && g.special?.includes('flash')) return false;
      if (hidePortGames && g.special?.includes('port')) return false;
      if (hideEmulatorGames && g.special?.includes('emulator')) return false;
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
      setHideSplash(false);
      localStorage.setItem('lastOpenedAt', String(now));
    } catch {
      setShowSplash(true);
      setHideSplash(false);
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

    const fadeTimer = window.setTimeout(() => setHideSplash(true), 1400);
    const removeTimer = window.setTimeout(() => setShowSplash(false), 1950);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [showSplash, isThemeLoaded]);

  useEffect(() => {
    updateGamesDisplay(searchQuery);
  }, [allGames, hideFlashGames, hidePortGames, hideEmulatorGames]);

  // Initialize other settings
  useEffect(() => {
    const savedShowHomeButton = getCookie('showHomeButton');
    if (savedShowHomeButton === null) {
      setCookie('showHomeButton', 'true');
      setShowHomeButton(true);
    } else {
      setShowHomeButton(savedShowHomeButton !== 'false');
    }

    const savedHideFlashGames = getCookie('hideFlashGames');
    if (savedHideFlashGames === null) {
      setCookie('hideFlashGames', 'true');
      setHideFlashGames(true);
    } else {
      setHideFlashGames(savedHideFlashGames !== 'false');
    }

    const savedHidePortGames = getCookie('hidePortGames');
    if (savedHidePortGames === null) {
      setCookie('hidePortGames', 'false');
      setHidePortGames(false);
    } else {
      setHidePortGames(savedHidePortGames === 'true');
    }

    const savedHideEmulatorGames = getCookie('hideEmulatorGames');
    if (savedHideEmulatorGames === null) {
      setCookie('hideEmulatorGames', 'false');
      setHideEmulatorGames(false);
    } else {
      setHideEmulatorGames(savedHideEmulatorGames === 'true');
    }

    // Load games, blacklist, and forced includes
    Promise.all([
      fetch('https://cdn.jsdelivr.net/gh/gn-math/assets@master/zones.json').then(res => res.json()),
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
              thumbnail: `https://cdn.jsdelivr.net/gh/gn-math/covers@main/${g.id}.png`,
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
            <div className={`startup-splash ${hideSplash ? 'fade-out' : ''}`}>
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
        onSettingsClick={() => setSettingsOpen(!settingsOpen)}
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
        hideFlashGames={hideFlashGames}
        onHideFlashGamesToggle={(nextValue) => {
          setHideFlashGames(nextValue);
          setCookie('hideFlashGames', String(nextValue));
        }}
        hidePortGames={hidePortGames}
        onHidePortGamesToggle={(nextValue) => {
          setHidePortGames(nextValue);
          setCookie('hidePortGames', String(nextValue));
        }}
        hideEmulatorGames={hideEmulatorGames}
        onHideEmulatorGamesToggle={(nextValue) => {
          setHideEmulatorGames(nextValue);
          setCookie('hideEmulatorGames', String(nextValue));
        }}
      />

      {/* Bottombar */}
      <Bottombar />
    </>
  );
}
