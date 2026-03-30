const DB_NAME = 'gattitown';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function cacheSet(key, data) {
  const db = await openDB();
  const tx = db.transaction('cache', 'readwrite');
  tx.objectStore('cache').put({ key, data, ts: Date.now() });
}

export async function cacheGet(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('cache', 'readonly');
    const req = tx.objectStore('cache').get(key);
    req.onsuccess = () => resolve(req.result?.data || null);
    req.onerror = () => resolve(null);
  });
}

export async function addToSyncQueue(entry) {
  const db = await openDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  tx.objectStore('syncQueue').add({ ...entry, created_at: new Date().toISOString(), retries: 0 });
}

export async function getSyncQueue() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('syncQueue', 'readonly');
    const req = tx.objectStore('syncQueue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function removeSyncItem(id) {
  const db = await openDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  tx.objectStore('syncQueue').delete(id);
}

export async function drainSyncQueue() {
  const items = await getSyncQueue();
  for (const item of items) {
    try {
      const opts = { method: item.method, headers: {} };
      if (item.payload) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(item.payload);
      }
      const res = await fetch(item.endpoint, opts);
      if (res.ok) {
        await removeSyncItem(item.id);
      }
    } catch {
      // Will retry next time
    }
  }
}

// Check for localStorage migration data
export function getLegacyIssues() {
  try {
    const raw = localStorage.getItem('gattitown_issues_v1');
    if (raw && !localStorage.getItem('gattitown_migrated')) {
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return null;
}

export function markMigrated() {
  localStorage.setItem('gattitown_migrated', 'true');
}
