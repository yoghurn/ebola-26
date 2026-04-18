'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
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

const REPORT_TYPES = ['Game not loading', 'Bug Report', 'DMCA', 'Other'] as const;
const SECTION_VISIBILITY_COOKIE = 'arcadeSectionVisibility';
const SHOW_RECENTLY_PLAYED_SECTION = false;

type SectionVisibilityState = {
  favorites: boolean;
  recentlyPlayed: boolean;
  allGames: boolean;
};

const DEFAULT_SECTION_VISIBILITY: SectionVisibilityState = {
  favorites: true,
  recentlyPlayed: true,
  allGames: true,
};

export default function ArcadePage() {
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Game[]>([]);
  const [favorites, setFavorites] = useState<Game[]>([]);
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibilityState>(DEFAULT_SECTION_VISIBILITY);
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
  const [showPortGames, setShowPortGames] = useState(true);
  const [showEmulatorGames, setShowEmulatorGames] = useState(true);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [splashFading, setSplashFading] = useState(false);
  const [splashLogoMarkup, setSplashLogoMarkup] = useState('');
  const [requireSignIn, setRequireSignIn] = useState(true);
  const [reportMenuGame, setReportMenuGame] = useState<Game | null>(null);
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]>('Game not loading');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSubmitMessage, setReportSubmitMessage] = useState('');
  const splashFadeTimerRef = useRef<number | null>(null);
  const splashRemoveTimerRef = useRef<number | null>(null);
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

  const getSectionVisibilityFromStorage = (): SectionVisibilityState => {
    const cookie = getCookie(SECTION_VISIBILITY_COOKIE);
    if (!cookie) return DEFAULT_SECTION_VISIBILITY;

    try {
      const parsed = JSON.parse(cookie) as Partial<SectionVisibilityState>;
      return {
        favorites: parsed.favorites ?? DEFAULT_SECTION_VISIBILITY.favorites,
        recentlyPlayed: parsed.recentlyPlayed ?? DEFAULT_SECTION_VISIBILITY.recentlyPlayed,
        allGames: parsed.allGames ?? DEFAULT_SECTION_VISIBILITY.allGames,
      };
    } catch {
      return DEFAULT_SECTION_VISIBILITY;
    }
  };

  const toggleSectionVisibility = (section: keyof SectionVisibilityState) => {
    setSectionVisibility((current) => {
      const next = {
        ...current,
        [section]: !current[section],
      };
      setCookie(SECTION_VISIBILITY_COOKIE, JSON.stringify(next));
      return next;
    });
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
    updateGamesDisplay(searchQuery);
  };

  const openReportMenu = (game: Game) => {
    setReportMenuGame(game);
    setReportType('Game not loading');
    setReportDescription('');
    setReportSubmitMessage('');
  };

  const closeReportMenu = () => {
    setReportMenuGame(null);
    setReportType('Game not loading');
    setReportDescription('');
    setReportSubmitMessage('');
    setIsSubmittingReport(false);
  };

  const handleReportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reportMenuGame || !reportDescription.trim()) {
      setReportSubmitMessage('description is required');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let accessToken: string | null = null;

    if (supabase) {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token ?? null;
    }

    setIsSubmittingReport(true);
    setReportSubmitMessage('');

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          type: reportType,
          gameId: reportMenuGame.gameID,
          gameName: reportMenuGame.name,
          description: reportDescription.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; success?: boolean } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'could not submit report');
      }

      setReportSubmitMessage('report submitted');
      setReportDescription('');
    } catch (error) {
      setReportSubmitMessage(error instanceof Error ? error.message.toLowerCase() : 'could not submit report');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const updateGamesDisplay = (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    let gamesToDisplay = allGames.filter((g) => {
      if (g.special?.includes('fnf')) return false;
      if (!showFlashGames && g.special?.includes('flash')) return false;
      if (!showPortGames && g.special?.includes('port')) return false;
      if (!showEmulatorGames && g.special?.includes('emulator')) return false;
      return true;
    });
    if (normalizedQuery) {
      gamesToDisplay = gamesToDisplay.filter(g => {
        const nameMatch = (g.name || '').toLowerCase().includes(normalizedQuery);
        const tagMatch = g.tags && g.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));
        return nameMatch || tagMatch;
      });
    }
    gamesToDisplay.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    setFilteredGames(gamesToDisplay);
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

  const playSplashIntro = () => {
    if (!isThemeLoaded) return;

    if (splashFadeTimerRef.current !== null) {
      window.clearTimeout(splashFadeTimerRef.current);
    }
    if (splashRemoveTimerRef.current !== null) {
      window.clearTimeout(splashRemoveTimerRef.current);
    }

    setSplashFading(false);
    setShowSplash(false);
    window.setTimeout(() => setShowSplash(true), 0);
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

    splashFadeTimerRef.current = window.setTimeout(() => setSplashFading(true), 850);
    splashRemoveTimerRef.current = window.setTimeout(() => setShowSplash(false), 1250);

    return () => {
      if (splashFadeTimerRef.current !== null) {
        window.clearTimeout(splashFadeTimerRef.current);
        splashFadeTimerRef.current = null;
      }
      if (splashRemoveTimerRef.current !== null) {
        window.clearTimeout(splashRemoveTimerRef.current);
        splashRemoveTimerRef.current = null;
      }
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
      setCookie('showPortGames', 'true');
      setShowPortGames(true);
    } else {
      setShowPortGames(savedShowPortGames !== 'false');
    }

    const savedShowEmulatorGames = getCookie('showEmulatorGames');
    if (savedShowEmulatorGames === null) {
      setCookie('showEmulatorGames', 'true');
      setShowEmulatorGames(true);
    } else {
      setShowEmulatorGames(savedShowEmulatorGames !== 'false');
    }

    const savedSectionVisibility = getSectionVisibilityFromStorage();
    setSectionVisibility(savedSectionVisibility);
    if (getCookie(SECTION_VISIBILITY_COOKIE) === null) {
      setCookie(SECTION_VISIBILITY_COOKIE, JSON.stringify(savedSectionVisibility));
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
        const seenIds = new Set<number>();

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
          
          cdnGames.forEach(game => {
            if (!seenIds.has(game.gameID)) {
              seenIds.add(game.gameID);
              allGamesList.push(game);
            }
          });
        }

        // Add local games
        if (localGames?.length) {
          const local = localGames
            .map((g: any) => ({
              gameID: g.id,
              name: g.name,
              path: `/arcade/${g.id}`,
              thumbnail: g.cover,
              dateAdded: '0',
              tags: g.tags || [],
              special: g.special || []
            })) as Game[];
          
          local.forEach(game => {
            if (!seenIds.has(game.gameID)) {
              seenIds.add(game.gameID);
              allGamesList.push(game);
            }
          });
        }

        allGamesList.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
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
      if (event.key && event.key.toLowerCase() === sequence[currentIndex]) {
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
          if (value.trim().toLowerCase() === 'splash') {
            playSplashIntro();
          }
          updateGamesDisplay(value);
        }}
      />

      {/* Main Content */}
      <div className="main-content">
        <div className="games-container">
          {/* Favourites */}
          <div className="grid-section">
            <div className="grid-title-container">
              <h2 className="grid-title">favourites</h2>
              <button
                type="button"
                className="section-toggle-button"
                aria-label={sectionVisibility.favorites ? 'collapse favourites' : 'expand favourites'}
                aria-expanded={sectionVisibility.favorites}
                aria-controls="favoritesSectionContent"
                onClick={() => toggleSectionVisibility('favorites')}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={`section-toggle-icon ${sectionVisibility.favorites ? 'is-open' : ''}`}
                >
                  <path d="M7 10l5 5 5-5" />
                </svg>
              </button>
            </div>
            <div
              id="favoritesSectionContent"
              className={`section-collapsible ${sectionVisibility.favorites ? 'is-open' : ''}`}
              aria-hidden={!sectionVisibility.favorites}
            >
              <div className="section-collapsible-inner">
                <div className="section-collapsible-body">
                  <div id="favoritesGrid">
                    {favorites.length === 0 ? (
                      <p style={{ color: 'var(--link-color)' }}>you haven&apos;t favourited any games yet :(</p>
                    ) : (
                      favorites.map(game => (
                        <a
                          key={`favorite-${game.gameID}`}
                          href={game.path}
                          onClick={() => addRecentlyPlayed(game)}
                          className={`card ${isFavorited(game) ? 'favorited' : ''}`}
                          data-title={game.name}
                        >
                          <img src={game.thumbnail} alt={game.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', position: 'absolute', top: 0, left: 0 }} />
                          <button
                            type="button"
                            className="favorite-badge"
                            aria-label={isFavorited(game) ? `remove ${game.name} from favorites` : `add ${game.name} to favorites`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavorite(game);
                            }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className={`favorite-star ${isFavorited(game) ? 'is-filled' : ''}`}
                            >
                              <path d="M12 2.75l2.86 5.79 6.39.93-4.62 4.5 1.09 6.36L12 17.32l-5.72 3.01 1.09-6.36-4.62-4.5 6.39-.93L12 2.75z" />
                            </svg>
                          </button>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {SHOW_RECENTLY_PLAYED_SECTION && (
            <>
              {/* Recently Played */}
              <div className="grid-section">
                <div className="grid-title-container">
                  <h2 className="grid-title">recently played</h2>
                  <button
                    type="button"
                    className="section-toggle-button"
                    aria-label={sectionVisibility.recentlyPlayed ? 'collapse recently played' : 'expand recently played'}
                    aria-expanded={sectionVisibility.recentlyPlayed}
                    aria-controls="recentlyPlayedSectionContent"
                    onClick={() => toggleSectionVisibility('recentlyPlayed')}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className={`section-toggle-icon ${sectionVisibility.recentlyPlayed ? 'is-open' : ''}`}
                    >
                      <path d="M7 10l5 5 5-5" />
                    </svg>
                  </button>
                </div>
                <div
                  id="recentlyPlayedSectionContent"
                  className={`section-collapsible ${sectionVisibility.recentlyPlayed ? 'is-open' : ''}`}
                  aria-hidden={!sectionVisibility.recentlyPlayed}
                >
                  <div className="section-collapsible-inner">
                    <div className="section-collapsible-body">
                      <div id="recentlyPlayedGrid">
                        {recentlyPlayed.length === 0 ? (
                          <p style={{ color: 'var(--link-color)' }}>you haven&apos;t played any games yet :(</p>
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
                  </div>
                </div>
              </div>
            </>
          )}

          {/* All Games */}
          <div className="grid-section">
            <div className="grid-title-container">
              <h2 className="grid-title">all games ({filteredGames.length})</h2>
              <button
                type="button"
                className="section-toggle-button"
                aria-label={sectionVisibility.allGames ? 'collapse all games' : 'expand all games'}
                aria-expanded={sectionVisibility.allGames}
                aria-controls="allGamesSectionContent"
                onClick={() => toggleSectionVisibility('allGames')}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={`section-toggle-icon ${sectionVisibility.allGames ? 'is-open' : ''}`}
                >
                  <path d="M7 10l5 5 5-5" />
                </svg>
              </button>
            </div>
            <div
              id="allGamesSectionContent"
              className={`section-collapsible ${sectionVisibility.allGames ? 'is-open' : ''}`}
              aria-hidden={!sectionVisibility.allGames}
            >
              <div className="section-collapsible-inner">
                <div className="section-collapsible-body">
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
                        <button
                          type="button"
                          className="favorite-badge"
                          aria-label={isFavorited(game) ? `remove ${game.name} from favorites` : `add ${game.name} to favorites`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFavorite(game);
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className={`favorite-star ${isFavorited(game) ? 'is-filled' : ''}`}
                          >
                            <path d="M12 2.75l2.86 5.79 6.39.93-4.62 4.5 1.09 6.36L12 17.32l-5.72 3.01 1.09-6.36-4.62-4.5 6.39-.93L12 2.75z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="report-badge"
                          aria-label={`report ${game.name}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openReportMenu(game);
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="report-icon"
                          >
                            <path d="M6 3.75v16.5" />
                            <path d="M6 5.25h8.15l-.9 2.75 4.5 1.5-1.35 4H6" />
                          </svg>
                        </button>
                        {game.tags?.includes('new') && (
                          <div className="new-badge with-report">new</div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
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

      {reportMenuGame && (
        <div className="report-modal-backdrop" onClick={closeReportMenu}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <h3>report</h3>
              <button type="button" className="report-modal-close" aria-label="Close report menu" onClick={closeReportMenu}>
                x
              </button>
            </div>

            <form className="report-form" onSubmit={handleReportSubmit}>
              <label className="report-field">
                <span>Type:</span>
                <select value={reportType} onChange={(e) => setReportType(e.target.value as (typeof REPORT_TYPES)[number])}>
                  {REPORT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <div className="report-field report-game-line">
                <span>Game:</span> {reportMenuGame.name} (ID: {reportMenuGame.gameID})
              </div>

              <label className="report-field">
                <span>Description:</span>
                <textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} rows={7} />
              </label>

              <button type="submit" className="report-submit-button" disabled={isSubmittingReport}>
                {isSubmittingReport ? 'Submitting...' : 'Submit'}
              </button>
              {reportSubmitMessage && <p className="report-status">{reportSubmitMessage}</p>}
              <p className="report-note">
                {session ? 'Responses may only be sent to signed-in accounts.' : 'You will not get a response if you are without an account.'}
              </p>
            </form>
          </div>
        </div>
      )}

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
