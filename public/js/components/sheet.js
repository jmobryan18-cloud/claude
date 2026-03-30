let currentCallbacks = {};

export function openSheet({ title, badge, badgeType, viewContent, editContent, startInEdit, resolved, onSave, onResolve, onDelete, onOpen }) {
  const overlay = document.getElementById('sheet-overlay');
  const sheet = document.getElementById('sheet');
  const nameEl = document.getElementById('sheet-name');
  const badgeEl = document.getElementById('sheet-badge');
  const viewBody = document.getElementById('sheet-view-body');
  const editBody = document.getElementById('sheet-edit-body');
  const resolveBtn = document.getElementById('btn-resolve');
  const deleteBtn = document.getElementById('btn-delete');
  const editBtn = document.getElementById('btn-edit');

  nameEl.textContent = title;
  badgeEl.textContent = badge || '';

  // Badge styling
  badgeEl.className = badgeType === 'status'
    ? `status-badge ${(badge || 'active').toLowerCase()}`
    : 'priority-badge';

  // View content
  if (viewContent) viewBody.innerHTML = viewContent;
  if (editContent) editBody.innerHTML = editContent;

  // Resolve button
  if (onResolve) {
    resolveBtn.style.display = '';
    resolveBtn.textContent = resolved ? 'REOPEN' : 'MARK RESOLVED';
    resolveBtn.className = 'btn-resolve view-mode' + (resolved ? ' reopen' : '');
  } else {
    resolveBtn.style.display = 'none';
  }

  // Delete button
  deleteBtn.style.display = onDelete ? '' : 'none';

  // Edit button
  editBtn.style.display = (editContent && !startInEdit) ? '' : 'none';

  // Mode
  if (startInEdit) {
    sheet.classList.add('editing');
  } else {
    sheet.classList.remove('editing');
  }

  currentCallbacks = { onSave, onResolve, onDelete };
  overlay.classList.add('open');

  if (onOpen) onOpen();
}

export function closeSheet() {
  document.getElementById('sheet-overlay').classList.remove('open');
  document.getElementById('sheet').classList.remove('editing');
  currentCallbacks = {};
}

export function switchToEdit() {
  document.getElementById('sheet').classList.add('editing');
}

// Wire up sheet buttons on load
export function initSheet() {
  document.getElementById('sheet-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-overlay') closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });

  document.getElementById('btn-edit').addEventListener('click', switchToEdit);
  document.getElementById('btn-close').addEventListener('click', closeSheet);
  document.getElementById('btn-cancel').addEventListener('click', () => {
    const sheet = document.getElementById('sheet');
    if (sheet.classList.contains('editing') && !document.getElementById('sheet-view-body').innerHTML.trim()) {
      closeSheet(); // Was in new-item mode
    } else {
      sheet.classList.remove('editing');
    }
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    if (currentCallbacks.onSave) currentCallbacks.onSave();
  });
  document.getElementById('btn-resolve').addEventListener('click', () => {
    if (currentCallbacks.onResolve) currentCallbacks.onResolve();
  });
  document.getElementById('btn-delete').addEventListener('click', () => {
    if (currentCallbacks.onDelete) currentCallbacks.onDelete();
  });
}
