const CACHE_NAME = 'gattitown-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/theme.css',
  '/css/cards.css',
  '/css/sheets.css',
  '/css/forms.css',
  '/js/app.js',
  '/js/api.js',
  '/js/store.js',
  '/js/views/issues.js',
  '/js/views/assets.js',
  '/js/views/menu.js',
  '/js/components/sheet.js'
];

// Install: cache app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: different strategies per request type
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API requests: network-first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    // Don't cache mutations
    if (e.request.method !== 'GET') return;

    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Photo files: cache-first (they don't change)
  if (url.pathname.startsWith('/api/photos/') && url.pathname.endsWith('/file')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // App shell: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Background sync for offline mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'gattitown-sync') {
    event.waitUntil(drainSyncQueue());
  }
});

async function drainSyncQueue() {
  const db = await openIndexedDB();
  const tx = db.transaction('syncQueue', 'readonly');
  const store = tx.objectStore('syncQueue');

  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = async () => {
      const items = req.result || [];
      for (const item of items) {
        try {
          const opts = { method: item.method, headers: {} };
          if (item.payload) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(item.payload);
          }
          const res = await fetch(item.endpoint, opts);
          if (res.ok) {
            const delTx = db.transaction('syncQueue', 'readwrite');
            delTx.objectStore('syncQueue').delete(item.id);
          }
        } catch { /* retry next time */ }
      }
      resolve();
    };
    req.onerror = () => resolve();
  });
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('gattitown', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
