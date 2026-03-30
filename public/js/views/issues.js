import { getIssues, createIssue, updateIssue, resolveIssue, deleteIssue, getActivity, uploadPhoto, photoUrl } from '../api.js';
import { esc, formatTs } from '../app.js';
import { openSheet, closeSheet } from '../components/sheet.js';

let issues = [];
let currentFilter = 'ALL';

const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, MONITOR: 3 };

export async function renderIssues() {
  try {
    const params = {};
    if (currentFilter !== 'ALL') params.priority = currentFilter;
    issues = await getIssues(params);
  } catch {
    // Use cached or empty
    if (!issues.length) issues = [];
  }

  updateCounts();
  renderBoard();
}

function updateCounts() {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, MONITOR: 0 };
  issues.forEach(i => { if (!i.resolved) counts[i.priority]++; });
  document.getElementById('count-critical').textContent = counts.CRITICAL;
  document.getElementById('count-high').textContent = counts.HIGH;
  document.getElementById('count-medium').textContent = counts.MEDIUM;
  document.getElementById('count-monitor').textContent = counts.MONITOR;
}

function renderBoard() {
  const board = document.getElementById('board-issues');

  let list = [...issues].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return (priorityOrder[a.priority] - priorityOrder[b.priority]) || (new Date(b.created_at) - new Date(a.created_at));
  });

  if (!list.length) {
    board.innerHTML = `<div class="empty-state"><div class="big">ALL CLEAR</div><div class="small">No issues${currentFilter !== 'ALL' ? ' at this priority' : ''}</div></div>`;
    return;
  }

  board.innerHTML = list.map(issue => `
    <div class="card ${issue.resolved ? 'resolved' : ''}" data-priority="${issue.priority}" data-id="${issue.id}">
      <div class="card-inner">
        <div class="card-top">
          <div class="card-name">${esc(issue.name)}</div>
          <div class="priority-badge">${issue.resolved ? '✓ ' : ''}${issue.priority}</div>
        </div>
        <div class="card-issue">${esc(issue.description)}</div>
        <div class="card-status">${esc(issue.status)}</div>
      </div>
      <div class="card-footer">
        <div class="card-ts">${formatTs(issue.created_at)}</div>
        <div class="card-ts" style="color:var(--border)">TAP TO OPEN ›</div>
      </div>
    </div>
  `).join('');

  board.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openIssueSheet(card.dataset.id));
  });
}

async function openIssueSheet(id) {
  const issue = issues.find(i => i.id === id);
  if (!issue) return;

  let activityHtml = '';
  try {
    const logs = await getActivity({ entity_type: 'issue', entity_id: id, limit: 10 });
    if (logs.length) {
      activityHtml = `
        <div class="field-label">Activity</div>
        <ul class="activity-list">
          ${logs.map(l => `<li class="activity-item"><span class="act-time">${formatTs(l.created_at)}</span>${esc(l.action)}${l.changes ? ' — ' + summarizeChanges(l.changes) : ''}</li>`).join('')}
        </ul>
      `;
    }
  } catch { /* offline */ }

  let photosHtml = '';
  if (issue.photos && issue.photos.length) {
    photosHtml = `
      <div class="field-label">Photos</div>
      <div class="photo-strip">
        ${issue.photos.map(p => `<div class="photo-thumb" data-photo-id="${p.id}"><img src="${photoUrl(p.id)}" alt=""></div>`).join('')}
      </div>
    `;
  }

  openSheet({
    title: issue.name,
    badge: issue.priority,
    badgeType: 'priority',
    viewContent: `
      <div class="field-label">Issue</div>
      <div class="field-value">${esc(issue.description)}</div>
      <div class="field-label">Status / Action Taken</div>
      <div class="field-value mono">${esc(issue.status) || '—'}</div>
      ${issue.asset_id ? `<div class="field-label">Linked Asset</div><div class="field-value mono">${esc(issue.asset_id)}</div>` : ''}
      <div class="field-label">Logged</div>
      <div class="field-value mono">${formatTs(issue.created_at)}</div>
      ${photosHtml}
      ${activityHtml}
    `,
    editContent: `
      <div class="form-group"><label>Machine / Equipment Name</label><input type="text" id="f-name" value="${esc(issue.name)}" placeholder="e.g. Mario Kart"></div>
      <div class="form-group"><label>Issue Description</label><textarea id="f-issue" placeholder="What's wrong?">${esc(issue.description)}</textarea></div>
      <div class="form-group"><label>Status / Action Taken</label><input type="text" id="f-status" value="${esc(issue.status)}" placeholder="e.g. Parts ordered"></div>
      <div class="form-group"><label>Priority</label>
        <select id="f-priority">
          <option value="CRITICAL" ${issue.priority === 'CRITICAL' ? 'selected' : ''}>Critical — Down, revenue impact or safety</option>
          <option value="HIGH" ${issue.priority === 'HIGH' ? 'selected' : ''}>High — Down or major malfunction</option>
          <option value="MEDIUM" ${issue.priority === 'MEDIUM' ? 'selected' : ''}>Medium — Degraded, still operable</option>
          <option value="MONITOR" ${issue.priority === 'MONITOR' ? 'selected' : ''}>Monitor — Minor issue, watch it</option>
        </select>
      </div>
      <div class="form-group"><label>Add Photo</label><input type="file" id="f-photo" accept="image/*" capture="environment"></div>
    `,
    resolved: issue.resolved,
    onSave: async () => {
      const name = document.getElementById('f-name').value.trim();
      const description = document.getElementById('f-issue').value.trim();
      const status = document.getElementById('f-status').value.trim();
      const priority = document.getElementById('f-priority').value;
      if (!name || !description) return;
      await updateIssue(id, { name, description, status, priority });

      const photoInput = document.getElementById('f-photo');
      if (photoInput.files.length) {
        const fd = new FormData();
        fd.append('photo', photoInput.files[0]);
        fd.append('issue_id', id);
        await uploadPhoto(fd);
      }

      closeSheet();
      renderIssues();
    },
    onResolve: async () => {
      await resolveIssue(id);
      closeSheet();
      renderIssues();
    },
    onDelete: async () => {
      await deleteIssue(id);
      closeSheet();
      renderIssues();
    }
  });
}

export function openNewIssue() {
  openSheet({
    title: 'New Issue',
    badge: '',
    badgeType: 'priority',
    startInEdit: true,
    editContent: `
      <div class="form-group"><label>Machine / Equipment Name</label><input type="text" id="f-name" placeholder="e.g. Mario Kart"></div>
      <div class="form-group"><label>Issue Description</label><textarea id="f-issue" placeholder="What's wrong?"></textarea></div>
      <div class="form-group"><label>Status / Action Taken</label><input type="text" id="f-status" placeholder="e.g. Parts ordered, Out of service"></div>
      <div class="form-group"><label>Priority</label>
        <select id="f-priority">
          <option value="CRITICAL">Critical — Down, revenue impact or safety</option>
          <option value="HIGH" selected>High — Down or major malfunction</option>
          <option value="MEDIUM">Medium — Degraded, still operable</option>
          <option value="MONITOR">Monitor — Minor issue, watch it</option>
        </select>
      </div>
      <div class="form-group"><label>Add Photo</label><input type="file" id="f-photo" accept="image/*" capture="environment"></div>
    `,
    onSave: async () => {
      const name = document.getElementById('f-name').value.trim();
      const description = document.getElementById('f-issue').value.trim();
      const status = document.getElementById('f-status').value.trim();
      const priority = document.getElementById('f-priority').value;
      if (!name || !description) { document.getElementById('f-name').focus(); return; }

      const issue = await createIssue({ name, description, status, priority });

      const photoInput = document.getElementById('f-photo');
      if (photoInput.files.length) {
        const fd = new FormData();
        fd.append('photo', photoInput.files[0]);
        fd.append('issue_id', issue.id);
        await uploadPhoto(fd);
      }

      closeSheet();
      renderIssues();
    }
  });
  setTimeout(() => document.getElementById('f-name')?.focus(), 300);
}

function summarizeChanges(changesStr) {
  try {
    const changes = typeof changesStr === 'string' ? JSON.parse(changesStr) : changesStr;
    return Object.entries(changes).map(([k, v]) => {
      if (v && typeof v === 'object' && 'from' in v) return `${k}: ${v.from} → ${v.to}`;
      return `${k}: ${JSON.stringify(v)}`;
    }).join(', ');
  } catch { return ''; }
}

export function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  renderIssues();
}

export function initIssues() {
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  // FAB
  document.getElementById('fab-btn').addEventListener('click', () => {
    const hash = window.location.hash.replace('#', '') || 'issues';
    if (hash === 'issues' || hash === '') {
      openNewIssue();
    } else if (hash === 'assets') {
      // Import dynamically to avoid circular dependency
      import('./assets.js').then(m => m.openNewAsset());
    }
  });
}
