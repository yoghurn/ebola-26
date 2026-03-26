'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { generatePaletteFromHex, type ColorPalette } from '../../../lib/colorUtils';
import { useOnlineCount } from '../../../lib/useOnlineCount';
import { updateFaviconWithTheme } from '../../../lib/faviconUtils';

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();
  useOnlineCount();
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    // Fetch game data from CDN
    fetch(`https://cdn.jsdelivr.net/gh/gn-math/assets@master/zones.json?v=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        const game = data.find((g: any) => g.id === parseInt(gameId));
        if (game) {
          setGameTitle(game.name);
          document.title = game.name;
          
          // Fetch the game HTML using the URL from game data
          const gameUrl = game.url.replace('{HTML_URL}', 'https://cdn.jsdelivr.net/gh/gn-math/html@main');
          return fetch(`${gameUrl}?v=${Date.now()}`);
        } else {
          throw new Error(`Game ${gameId} not found`);
        }
      })
      .then(res => {
        console.log(`Fetching game ${gameId}, status:`, res.status);
        if (!res.ok) throw new Error('Failed to load game HTML');
        return res.text();
      })
      .then(html => {
        // Remove sidebarad divs
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const sidebarAd1 = doc.getElementById('sidebarad1');
        const sidebarAd2 = doc.getElementById('sidebarad2');
        if (sidebarAd1) sidebarAd1.remove();
        if (sidebarAd2) sidebarAd2.remove();
        
        // Inject script to disable popups at the beginning of head
        const disablePopupsScript = doc.createElement('script');
        disablePopupsScript.textContent = `
          window.alert = function() {};
          window.confirm = function() { return true; };
          window.prompt = function() { return null; };
        `;
        const head = doc.querySelector('head');
        if (head) {
          head.insertBefore(disablePopupsScript, head.firstChild);
        }
        
        // Serialize back to HTML string
        const modifiedHtml = new XMLSerializer().serializeToString(doc);
        
        // Create a blob from the modified HTML content
        const blob = new Blob([modifiedHtml], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        setIframeUrl(blobUrl);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading game:', err);
        setError(err.message);
        setLoading(false);
        setGameTitle(`Game ${gameId}`);
        document.title = `Game ${gameId}`;
      });
  }, [gameId]);

  if (loading) return <div style={{ color: customColor, textAlign: 'center', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, padding: 0 }}>Loading game...</div>;
  if (error) return <div style={{ color: customColor, textAlign: 'center', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, padding: 0 }}>Error: {error}</div>;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      <iframe
        src={iframeUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          margin: 0,
          padding: 0,
          display: 'block'
        }}
        title={`Game ${gameId}`}
        allowFullScreen
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
      />
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
