const CACHE = "wayize-shell-v2";
const TILES = "wayize-tiles-v3";
const TILE_LIMIT = 120;
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/static/trafic/css/app.css",
  "/static/trafic/js/app.js",
  "/static/trafic/js/quartiers.js",
  "/static/trafic/vendor/leaflet/leaflet.css",
  "/static/trafic/vendor/leaflet/leaflet.js",
  "/static/trafic/icons/icon-192.png",
  "/static/trafic/icons/icon-512.png",
  "/static/trafic/icons/favicon-32.png",
  "/static/trafic/fonts/dm-sans-400.woff2",
  "/static/trafic/fonts/dm-sans-500.woff2",
  "/static/trafic/fonts/dm-sans-600.woff2",
  "/static/trafic/fonts/dm-sans-700.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) await cache.put(url, response);
          } catch (error) {
            // Une ressource absente ne bloque pas l'installation.
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE && key !== TILES)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isTile(url) {
  return (
    url.hostname === "tile.openstreetmap.fr" ||
    url.hostname.endsWith(".tile.openstreetmap.fr")
  );
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function trimTiles(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= TILE_LIMIT) return;
    await Promise.all(keys.slice(0, keys.length - TILE_LIMIT).map((key) => cache.delete(key)));
  } catch (error) {
    // Le cache des tuiles reste un confort, pas une garantie.
  }
}

async function tile(request) {
  const cache = await caches.open(TILES);
  try {
    const response = await fetch(request);
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (response && response.ok && type.startsWith("image/")) {
      cache.put(request, response.clone());
      trimTiles(cache);
      return response;
    }
  } catch (error) {
    // Réseau coupé : on retombe sur la tuile déjà en cache.
  }
  const cached = await cache.match(request);
  if (cached) return cached;
  return Response.error();
}

function offlinePage() {
  return new Response(
    "<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Wayizé</title><body style=\"font-family:sans-serif;padding:28px;background:#f4f5f7;color:#141414\"><h1 style=\"letter-spacing:-.03em\">Wayizé est hors ligne</h1><p>Reconnectez-vous pour revoir la circulation à Libreville.</p></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function page(request) {
  try {
    return await networkFirst(request, CACHE);
  } catch (error) {
    const cached = (await caches.match(request)) || (await caches.match("/"));
    return cached || offlinePage();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !isTile(url)) return;
  if (isTile(url)) {
    event.respondWith(tile(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(page(request));
    return;
  }
  event.respondWith(
    networkFirst(request, CACHE).catch(() => caches.match(request))
  );
});
