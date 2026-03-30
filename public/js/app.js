import { drainSyncQueue, getLegacyIssues, markMigrated } from './store.js';
import { migrateData, search } from './api.js';
import { renderIssues, initIssues } from './views/issues.js';
import { renderAssets, initAssets } from './views/assets.js';
import { renderMenu } from './views/menu.js';

const views = ['issues', 'assets', 'menu'];
let currentView = 'issues';

export function navigate(hash) {
  const route = (hash || '#issues').replace('#', '');
  const [view, id] = route.split('/');

  if (views.includes(view)) {
    currentView = view;
  }

  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === currentView);
  });

  // Update views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const viewEl = document.getElementById(`view-${currentView}`);
  if (viewEl) viewEl.classList.add('active');

  // Update header stats visibility
  const statRow = document.querySelector('.stat-row');
  const filterBar = document.querySelector('.filter-bar');
  if (currentView === 'issues') {
    statRow.style.display = '';
    filterBar.style.display = '';
  } else {
    statRow.style.display = 'none';
    filterBar.style.display = 'none';
  }

  // Update search bar visibility
  const searchBar = document.querySelector('.search-bar');
  searchBar.classList.toggle('active', currentView === 'assets' || currentView === 'issues');

  // Render the active view
  if (currentView === 'issues') renderIssues();
  else if (currentView === 'assets') renderAssets(id);
  else if (currentView === 'menu') renderMenu();
}

export function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatTs(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Clock
function updateClock() {
  const el = document.getElementById('live-clock');
  if (!el) return;
  const n = new Date();
  el.innerHTML =
    n.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + '<br>' +
    n.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

// Offline detection
function updateOnlineStatus() {
  document.body.classList.toggle('offline', !navigator.onLine);
  if (navigator.onLine) drainSyncQueue();
}

// Migration
async function checkMigration() {
  const legacy = getLegacyIssues();
  if (legacy && legacy.length) {
    try {
      await migrateData(legacy);
      markMigrated();
      console.log('Migration complete');
    } catch {
      console.log('Migration queued for later');
    }
  }
}

// Init
export function init() {
  updateClock();
  setInterval(updateClock, 1000);

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      window.location.hash = tab.dataset.view;
    });
  });

  // Hash routing
  window.addEventListener('hashchange', () => navigate(window.location.hash));

  // Online/offline
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Search
  let searchTimeout;
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const q = searchInput.value.trim();
      if (!q) { navigate(window.location.hash || '#issues'); return; }
      try {
        const results = await search(q);
        renderSearchResults(results);
      } catch { /* offline */ }
    }, 300);
  });

  // Init views
  initIssues();
  initAssets();

  // Navigate to current hash or default
  navigate(window.location.hash || '#issues');

  // Check migration
  checkMigration();

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function renderSearchResults(results) {
  const viewEl = document.getElementById(`view-${currentView}`);
  const boardId = currentView === 'issues' ? 'board-issues' : currentView === 'assets' ? 'board-assets' : null;
  if (!boardId) return;
  const board = document.getElementById(boardId);

  let html = '';
  if (results.assets && results.assets.length) {
    html += `<div class="field-label" style="padding:8px 4px 4px;">Assets</div>`;
    html += results.assets.map(a => `
      <div class="card" data-status="${a.status}" data-id="${a.id}" onclick="window.location.hash='assets/${a.id}'">
        <div class="card-inner"><div class="card-top"><div class="card-name">${esc(a.name)}</div><div class="status-badge ${(a.status||'active').toLowerCase()}">${a.status||'ACTIVE'}</div></div>
        <div class="card-meta">${esc(a.location||'')}${a.category?' · '+esc(a.category):''}</div></div>
      </div>`).join('');
  }
  if (results.issues && results.issues.length) {
    html += `<div class="field-label" style="padding:8px 4px 4px;">Issues</div>`;
    html += results.issues.map(i => `
      <div class="card ${i.resolved?'resolved':''}" data-priority="${i.priority}">
        <div class="card-inner"><div class="card-top"><div class="card-name">${esc(i.name)}</div><div class="priority-badge">${i.priority}</div></div>
        <div class="card-issue">${esc(i.description)}</div></div>
      </div>`).join('');
  }
  if (!html) {
    html = `<div class="empty-state"><div class="big">NO RESULTS</div><div class="small">Try a different search term</div></div>`;
  }
  board.innerHTML = html;
}

// Boot
init();
