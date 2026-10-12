// 軽量PWA Service Worker (即時反映ネットワークファースト仕様)
const CACHE_NAME = 'cosplay-analytics-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// 最新のデプロイを即座に届けるため、常にネットワーク優先
self.addEventListener('fetch', (event) => {
  // ブラウザ拡張機能やスキーム外を無視
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request))
  );
});
