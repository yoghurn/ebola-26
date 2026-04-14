'use client';

import { useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { generatePaletteFromHex, type ColorPalette } from '../../../lib/colorUtils';
import { useOnlineCount } from '../../../lib/useOnlineCount';
import { updateFaviconWithTheme } from '../../../lib/faviconUtils';

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();
  useOnlineCount();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [gameTitle, setGameTitle] = useState<string>('');
  const [customColor, setCustomColor] = useState<string>('#FFFFFF');
  const [colorPalette, setColorPalette] = useState<ColorPalette>(generatePaletteFromHex('#FFFFFF'));
  const [showHomeButton, setShowHomeButton] = useState(true);

  useEffect(() => {
    // Get custom color from cookie
    const colorCookie = document.cookie.split('; ').find(row => row.startsWith('customColor='));
    const color = colorCookie ? colorCookie.split('=')[1] : '#FFFFFF';
    setCustomColor(color);
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
        // Fetch game data from CDN
        const assetsRes = await fetch(`https://cdn.jsdelivr.net/gh/freebuisness/assets@master/zones.json?v=${Date.now()}`);
        const games = await assetsRes.json();
        const game = games.find((g: any) => g.id === parseInt(gameId));
        
        if (!game) {
          throw new Error(`Game ${gameId} not found`);
        }

        setGameTitle(game.name);
        document.title = game.name;

        // Fetch the game HTML
        const gameUrl = game.url.replace('{HTML_URL}', 'https://cdn.jsdelivr.net/gh/freebuisness/html@main');
        let gameHtml = await fetch(`${gameUrl}?v=${Date.now()}`).then(r => r.text());

        // Fallback to main branch if not found
        if (gameHtml.trim().startsWith("Couldn't find the requested file")) {
          const fallbackUrl = game.url.replace('{HTML_URL}', 'https://cdn.jsdelivr.net/gh/freebuisness/html@main');
          gameHtml = await fetch(fallbackUrl + '?v=' + Date.now()).then(r => r.text());
        }

        // Parse HTML and remove sidebarad1 and sidebarad2 divs using regex
        // Remove the entire div with id="sidebarad1" or id="sidebarad2"
        gameHtml = gameHtml.replace(/<div[^>]*id=["']?sidebarad[12]["']?[^>]*>[\s\S]*?<\/div>/gi, '');

        // Inject safety script at the beginning of head
        const safetyScriptContent = `
(function() {
    const memoryStorage = {};
    const safeStorage = {
        getItem: function(key) {
            try {
                return localStorage.getItem(key);
            } catch(e) {
                return memoryStorage[key] || null;
            }
        },
        setItem: function(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch(e) {
                memoryStorage[key] = String(value);
            }
        },
        removeItem: function(key) {
            try {
                localStorage.removeItem(key);
            } catch(e) {
                delete memoryStorage[key];
            }
        }
    };
    
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
    } catch(e) {
        Object.defineProperty(window, 'localStorage', {
            value: safeStorage,
            writable: false,
            configurable: false
        });
    }
    
    try {
        document.cookie = 'test=test';
    } catch(e) {
        Object.defineProperty(document, 'cookie', {
            get: function() { return ''; },
            set: function() { return true; }
        });
    }
})();

(function() {
    const schoolList = ["deledao", "goguardian", "lightspeed", "linewize", "securly", ".edu/"];
    function isBlockedDomain(url) {
        try {
            const domain = new URL(url, location.origin).hostname + "/";
            return schoolList.some(school => domain.includes(school));
        } catch(e) { return false; }
    }

    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (isBlockedDomain(url)) return Promise.reject(new Error("Blocked"));
        return originalFetch.apply(this, arguments);
    };

    if (XMLHttpRequest && XMLHttpRequest.prototype) {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            if (isBlockedDomain(url)) return;
            return originalOpen.apply(this, arguments);
        };
    }

    if (HTMLCanvasElement && HTMLCanvasElement.prototype) {
        HTMLCanvasElement.prototype.toDataURL = function() { return ""; };
    }
})();

// Handle window/document resize for responsive game resizing
(function() {
    const updateGameSize = () => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.width = document.documentElement.clientWidth;
            canvas.height = document.documentElement.clientHeight;
        }
        
        // Update all body elements to fill space
        document.documentElement.style.width = '100%';
        document.documentElement.style.height = '100%';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        
        // Dispatch events
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('orientationchange'));
        if (window.onresize) window.onresize();
    };
    
    // Listen to all resize events
    window.addEventListener('resize', updateGameSize, true);
    document.addEventListener('resize', updateGameSize, true);
    
    // Update when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            updateGameSize();
            // Continue polling as a safety measure
            setInterval(updateGameSize, 250);
        });
    } else {
        updateGameSize();
        setInterval(updateGameSize, 250);
    }
})();
`;

        // Inject comprehensive fullscreen CSS and script before closing head tag
        const fullscreenCss = `<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
}
body > * {
  width: 100% !important;
  height: 100% !important;
}
canvas {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
}
</style>`;

        gameHtml = gameHtml.replace(/<\/head>/i, `${fullscreenCss}<script>${safetyScriptContent}</script></head>`);

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
        setGameTitle(`Game ${gameId}`);
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
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation"
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
            border: `2px solid ${colorPalette.bottomBorder}`,
            background: colorPalette.overlay,
            color: colorPalette.bottomBorder,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            transition: 'all 0.3s ease',
            padding: 0
          }}
          onMouseEnter={(e) => {
            const overlayWithHigherOpacity = colorPalette.overlay.replace(/0\.75\)/, '0.9)');
            e.currentTarget.style.background = overlayWithHigherOpacity;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colorPalette.overlay;
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