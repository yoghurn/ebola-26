'use client';

import { useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { generatePaletteFromHex, type ColorPalette } from '../../../lib/colorUtils';
import { useOnlineCount } from '../../../lib/useOnlineCount';
import { updateFaviconWithTheme } from '../../../lib/faviconUtils';

const AD_HOST_PATTERNS = [
  'adservice.google.',
  'adsystem.com',
  'adsbygoogle',
  'adtrafficquality.google',
  'amazon-adsystem.com',
  'doubleclick.net',
  'gamedistribution.com',
  'gamemonetize.',
  'google-analytics.com',
  'googlesyndication.com',
  'googletagmanager.com',
  'imasdk.googleapis.com',
  'ima3.js',
  'pagead2.googlesyndication.com',
  'pubfuture-ad.com',
  'sdkjs.js',
  'unityads.',
  'vast.',
  'video-ad',
];

const AD_ELEMENT_SELECTOR = [
  '#ad_iframe',
  '#ad_position_box',
  '#button.imgb',
  '#imaContainer',
  '#imaContainer_new',
  '#sidebarad1',
  '#sidebarad2',
  '.ad',
  '.ads',
  '.adsbox',
  '.advertisement',
  '.banner-ad',
  '.google-auto-placed',
  '.imgb',
  '[class*="ad-container" i]',
  '[class*="ads" i]',
  '[id*="ad-container" i]',
  '[id*="ads" i]',
  '[id*="advert" i]',
  'iframe[id*="ad" i]',
  'iframe[src*="doubleclick.net" i]',
  'iframe[src*="googlesyndication.com" i]',
  'iframe[src*="imasdk.googleapis.com" i]',
  'ins.adsbygoogle',
].join(',');

function buildGameSafetyScript(blockedPatterns: string[], adSelector: string) {
  return `
(function() {
  var blockedPatterns = ${JSON.stringify(blockedPatterns)};
  var adSelector = ${JSON.stringify(adSelector)};
  var memoryStorage = {};

  function normalizeUrl(value) {
    if (!value) return '';
    try {
      if (typeof value === 'string') return new URL(value, location.href).href.toLowerCase();
      if (value && typeof value.url === 'string') return new URL(value.url, location.href).href.toLowerCase();
    } catch (e) {
      return String(value).toLowerCase();
    }
    return String(value).toLowerCase();
  }

  function isBlocked(value) {
    var url = normalizeUrl(value);
    return blockedPatterns.some(function(pattern) {
      return url.indexOf(pattern) !== -1;
    });
  }

  function removeAds(root) {
    try {
      var scope = root && root.querySelectorAll ? root : document;
      scope.querySelectorAll(adSelector).forEach(function(node) {
        node.remove();
      });
    } catch (e) {}
  }

  var safeStorage = {
    getItem: function(key) { return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null; },
    setItem: function(key, value) { memoryStorage[key] = String(value); },
    removeItem: function(key) { delete memoryStorage[key]; }
  };

  try {
    localStorage.setItem('__test', '1');
    localStorage.removeItem('__test');
  } catch (e) {
    Object.defineProperty(window, 'localStorage', { value: safeStorage, configurable: true });
  }

  window.alert = function() {};
  window.confirm = function() { return true; };
  window.prompt = function() { return null; };
  window.open = function() { return null; };

  var originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function(input, init) {
      if (isBlocked(input)) return Promise.reject(new Error('Blocked ad request'));
      return originalFetch.apply(this, arguments);
    };
  }

  if (window.XMLHttpRequest && XMLHttpRequest.prototype) {
    var originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (isBlocked(url)) {
        this.__blockedAdRequest = true;
        return;
      }
      return originalOpen.apply(this, arguments);
    };
    var originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
      if (this.__blockedAdRequest) return;
      return originalSend.apply(this, arguments);
    };
  }

  var originalCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName, options) {
    var element = originalCreateElement(tagName, options);
    var tag = String(tagName).toLowerCase();
    if (tag === 'script' || tag === 'iframe' || tag === 'img') {
      var descriptor = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'src');
      if (descriptor && descriptor.set && descriptor.get) {
        Object.defineProperty(element, 'src', {
          get: function() { return descriptor.get.call(this); },
          set: function(value) {
            if (isBlocked(value)) return;
            descriptor.set.call(this, value);
          },
          configurable: true
        });
      }
    }
    return element;
  };

  function startObserver() {
    removeAds(document);
    new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (!node || node.nodeType !== 1) return;
          if (node.matches && node.matches(adSelector)) node.remove();
          else removeAds(node);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
`;
}

function stripAdContent(doc: Document) {
  doc.querySelectorAll(AD_ELEMENT_SELECTOR).forEach(el => el.remove());
  doc.querySelectorAll('script, iframe, img, link').forEach(el => {
    const src = el.getAttribute('src') || el.getAttribute('href') || '';
    const lowerSrc = src.toLowerCase();
    if (AD_HOST_PATTERNS.some(pattern => lowerSrc.includes(pattern))) {
      el.remove();
    }
  });
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Failed to fetch ${url}: ${response.status}${details ? ` ${details}` : ''}`);
  }
  return response.text();
}

async function fetchRemoteGameHtml(url: string) {
  try {
    return await fetchText(`/api/game-html?url=${encodeURIComponent(url)}`);
  } catch (proxyError) {
    console.warn('Game HTML proxy failed, trying direct fetch:', proxyError);
    return fetchText(url);
  }
}

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const parsedGameId = Number.parseInt(gameId, 10);
  const router = useRouter();
  useOnlineCount();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [colorPalette, setColorPalette] = useState<ColorPalette>(generatePaletteFromHex('#FFFFFF'));
  const [showHomeButton, setShowHomeButton] = useState(true);

  useEffect(() => {
    // Get custom color from cookie
    const colorCookie = document.cookie.split('; ').find(row => row.startsWith('customColor='));
    const color = colorCookie ? colorCookie.split('=')[1] : '#FFFFFF';
    const palette = generatePaletteFromHex(color);
    setColorPalette(palette);
    updateFaviconWithTheme(palette.bg, palette.text);
    
    const showHomeCookie = document.cookie.split('; ').find(row => row.startsWith('showHomeButton='));
    if (showHomeCookie) {
      setShowHomeButton(showHomeCookie.split('=')[1] !== 'false');
    }
  }, []);

  useEffect(() => {
    // Wait for iframe to be ready
    const iframe = iframeRef.current;
    if (!iframe) return;

    const loadGame = async () => {
      try {
        const cacheBuster = Date.now();
        let game: any;
        let gameHtml: string;

        if (parsedGameId < 0) {
          const localGamesRes = await fetch('/localGames.json');
          const localGames = await localGamesRes.json();
          game = localGames.find((g: any) => g.id === parsedGameId);

          if (!game) {
            throw new Error(`Game ${gameId} not found`);
          }

          document.title = game.name;
          gameHtml = await fetchText(`${game.url}?v=${cacheBuster}`);
        } else {
          // Fetch game data from CDN
          const assetsRes = await fetch(`https://cdn.jsdelivr.net/gh/freebuisness/assets@master/zones.json?v=${cacheBuster}`);
          const games = await assetsRes.json();
          game = games.find((g: any) => g.id === parsedGameId);

          if (!game) {
            throw new Error(`Game ${gameId} not found`);
          }

          document.title = game.name;

          // Fetch the game HTML
          const gameUrl = game.url.replace('{HTML_URL}', 'https://cdn.jsdelivr.net/gh/freebuisness/html@main');
          gameHtml = await fetchRemoteGameHtml(`${gameUrl}?v=${cacheBuster}`);

          // Fallback to main branch if not found
          if (gameHtml.trim().startsWith("Couldn't find the requested file")) {
            const fallbackUrl = game.url.replace('{HTML_URL}', 'https://raw.githubusercontent.com/freebuisness/html/main');
            gameHtml = await fetchRemoteGameHtml(`${fallbackUrl}?v=${cacheBuster}`);
          }
        }

        // Parse HTML and remove known ad containers and ad network resources.
        const parser = new DOMParser();
        const doc = parser.parseFromString(gameHtml, 'text/html');
        if (parsedGameId < 0 && !doc.querySelector('base[href]')) {
          const base = doc.createElement('base');
          base.href = new URL(game.url, window.location.origin).href;
          doc.head.prepend(base);
        }
        stripAdContent(doc);
        gameHtml = doc.documentElement.outerHTML;

        // Inject safety script at the beginning of head
        const safetyScriptContent = buildGameSafetyScript(AD_HOST_PATTERNS, AD_ELEMENT_SELECTOR);

        gameHtml = gameHtml.replace(/<\/head>/i, `<style>${AD_ELEMENT_SELECTOR}{display:none!important;visibility:hidden!important;pointer-events:none!important}</style><script>${safetyScriptContent}</script></head>`);

        // Create a blob from the HTML and set iframe src to blob URL
        const blob = new Blob([gameHtml], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        
        if (iframe) {
          iframe.src = blobUrl;
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading game:', err);
        setLoading(false);
        document.title = `Game ${gameId}`;

        // Display error in iframe
        const errorHtml = `
          <html><head><style>
            body { 
              background: #1a1a2e; 
              color: #fff; 
              font-family: Arial; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
            }
            .error { text-align: center; }
          </style></head>
          <body>
            <div class="error">
              <h2>Failed to load game</h2>
              <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
            </div>
          </body>
          </html>
        `;
        const errorBlob = new Blob([errorHtml], { type: 'text/html;charset=utf-8' });
        const errorBlobUrl = URL.createObjectURL(errorBlob);
        if (iframe) {
          iframe.src = errorBlobUrl;
        }
      }
    };

    // Load the game
    loadGame();
  }, [gameId]);

  return (
    <div 
      suppressHydrationWarning
      style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      {/* Game iframe */}
      <iframe
        ref={iframeRef}
        suppressHydrationWarning
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          margin: 0,
          padding: 0,
          display: 'block'
        }}
        title={`Game ${gameId}`}
        sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-presentation"
      />

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '2rem',
          borderRadius: '12px',
          zIndex: 9999,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Loading game...</div>
          <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Game {gameId}</div>
        </div>
      )}

      {/* Home button */}
      {showHomeButton && (
        <button
          onClick={() => router.push('/arcade/')}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '50px',
            height: '50px',
            borderRadius: '8px',
            border: `1px solid ${colorPalette.border}`,
            background: colorPalette.bg,
            color: colorPalette.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            transition: 'transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease',
            padding: 0,
            opacity: colorPalette.opacity
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colorPalette.link;
            e.currentTarget.style.borderColor = colorPalette.hover;
            e.currentTarget.style.color = colorPalette.bg;
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colorPalette.bg;
            e.currentTarget.style.borderColor = colorPalette.border;
            e.currentTarget.style.color = colorPalette.text;
            e.currentTarget.style.opacity = String(colorPalette.opacity);
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg width="28" height="28" viewBox="0 0 460.298 460.297" style={{ fill: 'currentColor' }}>
            <g>
              <path d="M230.149 120.939 65.986 256.274c0 .191-.048.472-.144.855-.094.38-.144.656-.144.852v137.041c0 4.948 1.809 9.236 5.426 12.847 3.616 3.613 7.898 5.431 12.847 5.431h109.63V303.664h73.097v109.64h109.629c4.948 0 9.236-1.814 12.847-5.435 3.617-3.607 5.432-7.898 5.432-12.847V257.981c0-.76-.104-1.334-.288-1.707L230.149 120.939z"></path>
              <path d="M457.122 225.438 394.6 173.476V56.989c0-2.663-.856-4.853-2.574-6.567-1.704-1.712-3.894-2.568-6.563-2.568h-54.816c-2.666 0-4.855.856-6.57 2.568-1.711 1.714-2.566 3.905-2.566 6.567v55.673l-69.662-58.245c-6.084-4.949-13.318-7.423-21.694-7.423-8.375 0-15.608 2.474-21.698 7.423L3.172 225.438c-1.903 1.52-2.946 3.566-3.14 6.136-.193 2.568.472 4.811 1.997 6.713l17.701 21.128c1.525 1.712 3.521 2.759 5.996 3.142 2.285.192 4.57-.476 6.855-1.998L230.149 95.817l197.57 164.741c1.526 1.328 3.521 1.991 5.996 1.991h.858c2.471-.376 4.463-1.43 5.996-3.138l17.703-21.125c1.522-1.906 2.189-4.145 1.991-6.716-.195-2.563-1.242-4.609-3.141-6.132z"></path>
            </g>
          </svg>
        </button>
      )}
    </div>
  );
}
