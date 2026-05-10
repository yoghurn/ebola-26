import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_REMOTE_HOSTS = new Set([
  'cdn.jsdelivr.net',
  'raw.githubusercontent.com',
]);

const ALLOWED_REMOTE_PATHS = [
  '/gh/freebuisness/html@',
  '/freebuisness/html/',
];

function isAllowedGameHtmlUrl(url: URL) {
  return (
    url.protocol === 'https:' &&
    ALLOWED_REMOTE_HOSTS.has(url.hostname) &&
    ALLOWED_REMOTE_PATHS.some(path => url.pathname.startsWith(path))
  );
}

function getFallbackUrls(url: URL) {
  const urls = [url];

  if (url.hostname === 'cdn.jsdelivr.net') {
    const match = url.pathname.match(/^\/gh\/freebuisness\/html@([^/]+)\/(.+)$/);
    if (match) {
      const [, branch, filePath] = match;
      const fallback = new URL(`https://raw.githubusercontent.com/freebuisness/html/${branch}/${filePath}`);
      fallback.search = url.search;
      urls.push(fallback);
    }
  }

  if (url.hostname === 'raw.githubusercontent.com') {
    const match = url.pathname.match(/^\/freebuisness\/html\/([^/]+)\/(.+)$/);
    if (match) {
      const [, branch, filePath] = match;
      const fallback = new URL(`https://cdn.jsdelivr.net/gh/freebuisness/html@${branch}/${filePath}`);
      fallback.search = url.search;
      urls.push(fallback);
    }
  }

  return urls;
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url.' }, { status: 400 });
  }

  let gameUrl: URL;
  try {
    gameUrl = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: 'Invalid url.' }, { status: 400 });
  }

  if (!isAllowedGameHtmlUrl(gameUrl)) {
    return NextResponse.json({ error: 'Blocked remote game url.' }, { status: 403 });
  }

  const errors: string[] = [];

  for (const candidateUrl of getFallbackUrls(gameUrl)) {
    if (!isAllowedGameHtmlUrl(candidateUrl)) continue;

    try {
      const response = await fetch(candidateUrl.toString(), {
        cache: 'no-store',
        headers: {
          accept: 'text/html,*/*;q=0.8',
          'user-agent': 'Mozilla/5.0',
        },
      });
      const body = await response.text();

      if (response.ok || body) {
        return new NextResponse(body, {
          status: response.status,
          headers: {
            'content-type': response.headers.get('content-type') || 'text/html; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      }

      errors.push(`${candidateUrl.hostname}: ${response.status}`);
    } catch (error) {
      errors.push(`${candidateUrl.hostname}: ${error instanceof Error ? error.message : 'fetch failed'}`);
    }
  }

  return NextResponse.json(
    { error: 'Could not fetch remote game HTML.', details: errors },
    { status: 502 },
  );
}
