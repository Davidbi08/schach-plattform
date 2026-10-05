const PAGE_CACHE = 'schach-offline-pages-v1';
const ASSET_CACHE = 'schach-offline-assets-v1';
const ENGINE_FILES = [
  '/stockfish/stockfish-19-lite-single.js',
  '/stockfish/stockfish-19-lite-single.wasm',
];
const GAME_PAGES = ['/bot', '/play'];

async function saveGamePage(path) {
  const pageCache = await caches.open(PAGE_CACHE);
  const response = await fetch(path, { cache: 'reload' });
  if (!response.ok) throw new Error('Could not cache ' + path);
  await pageCache.put(new URL(path, self.location.origin).href, response.clone());

  const html = await response.clone().text();
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const assetUrl = new URL(match[1], self.location.origin);
    if (assetUrl.origin === self.location.origin && assetUrl.pathname.startsWith('/_next/static/')) {
      urls.add(assetUrl.href);
    }
  }

  const assetCache = await caches.open(ASSET_CACHE);
  await Promise.all(Array.from(urls, async (url) => {
    try {
      const asset = await fetch(url);
      if (asset.ok) await assetCache.put(url, asset);
    } catch {
      // An optional page asset can be fetched the next time the page is online.
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const assetCache = await caches.open(ASSET_CACHE);
    await assetCache.addAll(ENGINE_FILES);
    for (const path of GAME_PAGES) await saveGamePage(path);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('schach-offline-') && ![PAGE_CACHE, ASSET_CACHE].includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (url.pathname === '/') {
      event.respondWith((async () => {
        try {
          return await fetch(request);
        } catch {
          return Response.redirect(new URL('/bot', self.location.origin).href, 302);
        }
      })());
      return;
    }

    if (!GAME_PAGES.includes(url.pathname)) return;
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const pageCache = await caches.open(PAGE_CACHE);
          await pageCache.put(new URL(url.pathname, self.location.origin).href, response.clone());
        }
        return response;
      } catch {
        const pageCache = await caches.open(PAGE_CACHE);
        const cached = await pageCache.match(new URL(url.pathname, self.location.origin).href);
        return cached || new Response('Diese Offline-Seite wurde noch nicht gespeichert. Bitte öffne die Bot-Auswahl einmal mit Internetverbindung.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/stockfish/')) {
    event.respondWith((async () => {
      const assetCache = await caches.open(ASSET_CACHE);
      const cached = await assetCache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await assetCache.put(request, response.clone());
      return response;
    })());
  }
});
