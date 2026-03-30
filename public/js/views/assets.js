import { getAssets, getAsset, createAsset, updateAsset, deleteAsset, getActivity, uploadPhoto, photoUrl } from '../api.js';
import { esc, formatTs } from '../app.js';
import { openSheet, closeSheet } from '../components/sheet.js';

let assets = [];

const CATEGORIES = ['Arcade', 'Redemption', 'VR', 'Kiddie Ride', 'Prize', 'Food Equipment', 'Utility'];

export async function renderAssets(detailId) {
  if (detailId) {
    return openAssetDetail(detailId);
  }

  try {
    assets = await getAssets();
  } catch {
    if (!assets.length) assets = [];
  }

  const board = document.getElementById('board-assets');

  if (!assets.length) {
    board.innerHTML = `<div class="empty-state"><div class="big">NO ASSETS</div><div class="small">Tap + to register equipment</div></div>`;
    return;
  }

  board.innerHTML = assets.map(asset => `
    <div class="card" data-status="${asset.status}" data-id="${asset.id}">
      <div class="card-inner">
        <div class="card-top">
          <div class="card-name">${esc(asset.name)}</div>
          <div class="status-badge ${(asset.status || 'ACTIVE').toLowerCase()}">${asset.status || 'ACTIVE'}</div>
        </div>
        <div class="card-meta">
          ${asset.location ? esc(asset.location) : ''}${asset.location && asset.category ? ' · ' : ''}${asset.category ? esc(asset.category) : ''}
        </div>
        ${asset.serial_number ? `<div class="card-meta">${esc(asset.serial_number)}</div>` : ''}
      </div>
      <div class="card-footer">
        <div class="card-ts">${asset.created_at ? formatTs(asset.created_at) : ''}</div>
        <div class="card-ts" style="color:var(--border)">TAP TO OPEN ›</div>
      </div>
    </div>
  `).join('');

  board.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = `assets/${card.dataset.id}`;
    });
  });
}

async function openAssetDetail(id) {
  let asset;
  try {
    asset = await getAsset(id);
  } catch {
    asset = assets.find(a => a.id === id);
  }
  if (!asset) return;

  let activityHtml = '';
  try {
    const logs = await getActivity({ entity_type: 'asset', entity_id: id, limit: 10 });
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
  const photos = asset.photos || [];
  photosHtml = `
    <div class="field-label">Photos</div>
    <div class="photo-strip">
      ${photos.map(p => `<div class="photo-thumb" data-photo-id="${p.id}"><img src="${photoUrl(p.id)}" alt=""></div>`).join('')}
      <button class="photo-add" id="photo-add-btn">+</button>
    </div>
    <input type="file" id="photo-input-hidden" accept="image/*" capture="environment" style="display:none">
  `;

  let issuesHtml = '';
  const issues = asset.issues || [];
  if (issues.length) {
    issuesHtml = `
      <div class="field-label">Open Issues (${issues.filter(i => !i.resolved).length})</div>
      ${issues.filter(i => !i.resolved).map(i => `
        <div style="padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="color:var(--${i.priority === 'CRITICAL' ? 'critical' : i.priority === 'HIGH' ? 'high' : i.priority === 'MEDIUM' ? 'medium' : 'monitor'});">●</span>
          <span style="font-weight:700;">${esc(i.description)}</span>
          <span class="card-status">${esc(i.status)}</span>
        </div>
      `).join('')}
    `;
  }

  openSheet({
    title: asset.name,
    badge: asset.status || 'ACTIVE',
    badgeType: 'status',
    viewContent: `
      ${asset.location ? `<div class="field-label">Location</div><div class="field-value">${esc(asset.location)}</div>` : ''}
      ${asset.category ? `<div class="field-label">Category</div><div class="field-value">${esc(asset.category)}</div>` : ''}
      ${asset.serial_number ? `<div class="field-label">Serial Number</div><div class="field-value mono">${esc(asset.serial_number)}</div>` : ''}
      ${asset.manufacturer ? `<div class="field-label">Manufacturer</div><div class="field-value">${esc(asset.manufacturer)}</div>` : ''}
      ${asset.model ? `<div class="field-label">Model</div><div class="field-value">${esc(asset.model)}</div>` : ''}
      ${asset.purchase_date ? `<div class="field-label">Purchase Date</div><div class="field-value mono">${esc(asset.purchase_date)}</div>` : ''}
      ${asset.warranty_exp ? `<div class="field-label">Warranty Expires</div><div class="field-value mono">${esc(asset.warranty_exp)}</div>` : ''}
      ${asset.notes ? `<div class="field-label">Notes</div><div class="field-value">${esc(asset.notes)}</div>` : ''}
      ${photosHtml}
      ${issuesHtml}
      ${activityHtml}
    `,
    editContent: buildAssetForm(asset),
    onSave: async () => {
      const data = readAssetForm();
      if (!data.name) return;
      await updateAsset(id, data);
      closeSheet();
      window.location.hash = 'assets';
    },
    onDelete: async () => {
      await deleteAsset(id);
      closeSheet();
      window.location.hash = 'assets';
    },
    onOpen: () => {
      // Photo add button
      setTimeout(() => {
        const addBtn = document.getElementById('photo-add-btn');
        const hiddenInput = document.getElementById('photo-input-hidden');
        if (addBtn && hiddenInput) {
          addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hiddenInput.click();
          });
          hiddenInput.addEventListener('change', async () => {
            if (hiddenInput.files.length) {
              const fd = new FormData();
              fd.append('photo', hiddenInput.files[0]);
              fd.append('asset_id', id);
              try {
                await uploadPhoto(fd);
                openAssetDetail(id); // Refresh
              } catch { /* queued */ }
            }
          });
        }

        // Lightbox
        document.querySelectorAll('.photo-thumb').forEach(thumb => {
          thumb.addEventListener('click', (e) => {
            e.stopPropagation();
            const img = thumb.querySelector('img');
            if (img) {
              const lb = document.getElementById('lightbox');
              document.getElementById('lightbox-img').src = img.src;
              lb.classList.add('open');
            }
          });
        });
      }, 100);
    }
  });
}

export function openNewAsset() {
  openSheet({
    title: 'New Asset',
    badge: '',
    badgeType: 'status',
    startInEdit: true,
    editContent: buildAssetForm({}),
    onSave: async () => {
      const data = readAssetForm();
      if (!data.name) { document.getElementById('f-asset-name')?.focus(); return; }
      await createAsset(data);
      closeSheet();
      renderAssets();
    }
  });
  setTimeout(() => document.getElementById('f-asset-name')?.focus(), 300);
}

function buildAssetForm(asset) {
  return `
    <div class="form-group"><label>Name</label><input type="text" id="f-asset-name" value="${esc(asset.name || '')}" placeholder="e.g. Mario Kart"></div>
    <div class="form-group"><label>Location</label><input type="text" id="f-asset-location" value="${esc(asset.location || '')}" placeholder="e.g. Main Floor"></div>
    <div class="form-group"><label>Category</label>
      <select id="f-asset-category">
        <option value="">— Select —</option>
        ${CATEGORIES.map(c => `<option value="${c}" ${asset.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Serial Number</label><input type="text" id="f-asset-serial" value="${esc(asset.serial_number || '')}" placeholder="Optional"></div>
    <div class="form-group"><label>Manufacturer</label><input type="text" id="f-asset-mfg" value="${esc(asset.manufacturer || '')}" placeholder="Optional"></div>
    <div class="form-group"><label>Model</label><input type="text" id="f-asset-model" value="${esc(asset.model || '')}" placeholder="Optional"></div>
    <div class="form-group"><label>Purchase Date</label><input type="date" id="f-asset-purchase" value="${asset.purchase_date || ''}"></div>
    <div class="form-group"><label>Warranty Expires</label><input type="date" id="f-asset-warranty" value="${asset.warranty_exp || ''}"></div>
    <div class="form-group"><label>Status</label>
      <select id="f-asset-status">
        <option value="ACTIVE" ${(asset.status || 'ACTIVE') === 'ACTIVE' ? 'selected' : ''}>Active</option>
        <option value="DOWN" ${asset.status === 'DOWN' ? 'selected' : ''}>Down</option>
        <option value="RETIRED" ${asset.status === 'RETIRED' ? 'selected' : ''}>Retired</option>
      </select>
    </div>
    <div class="form-group"><label>Notes</label><textarea id="f-asset-notes" placeholder="Additional info...">${esc(asset.notes || '')}</textarea></div>
  `;
}

function readAssetForm() {
  return {
    name: document.getElementById('f-asset-name')?.value.trim() || '',
    location: document.getElementById('f-asset-location')?.value.trim() || null,
    category: document.getElementById('f-asset-category')?.value || null,
    serial_number: document.getElementById('f-asset-serial')?.value.trim() || null,
    manufacturer: document.getElementById('f-asset-mfg')?.value.trim() || null,
    model: document.getElementById('f-asset-model')?.value.trim() || null,
    purchase_date: document.getElementById('f-asset-purchase')?.value || null,
    warranty_exp: document.getElementById('f-asset-warranty')?.value || null,
    status: document.getElementById('f-asset-status')?.value || 'ACTIVE',
    notes: document.getElementById('f-asset-notes')?.value.trim() || null,
  };
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

export function initAssets() {
  // Lightbox close
  const lb = document.getElementById('lightbox');
  if (lb) lb.addEventListener('click', () => lb.classList.remove('open'));
}
