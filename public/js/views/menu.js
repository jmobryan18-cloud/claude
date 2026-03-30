import { exportUrl, search } from '../api.js';
import { esc } from '../app.js';

export function renderMenu() {
  const board = document.getElementById('board-menu');
  board.innerHTML = `
    <div class="menu-item" id="menu-export-assets-csv">
      <div>
        <div class="menu-label">Export Assets (CSV)</div>
        <div class="menu-desc">Download all assets as spreadsheet</div>
      </div>
      <div class="menu-arrow">›</div>
    </div>
    <div class="menu-item" id="menu-export-issues-csv">
      <div>
        <div class="menu-label">Export Issues (CSV)</div>
        <div class="menu-desc">Download all issues as spreadsheet</div>
      </div>
      <div class="menu-arrow">›</div>
    </div>
    <div class="menu-item" id="menu-export-assets-json">
      <div>
        <div class="menu-label">Export Assets (JSON)</div>
        <div class="menu-desc">Download raw asset data</div>
      </div>
      <div class="menu-arrow">›</div>
    </div>
    <div class="menu-item" id="menu-export-issues-json">
      <div>
        <div class="menu-label">Export Issues (JSON)</div>
        <div class="menu-desc">Download raw issue data</div>
      </div>
      <div class="menu-arrow">›</div>
    </div>
    <div style="text-align:center;padding:30px 0;">
      <div style="font-family:'Share Tech Mono',monospace;font-size:0.6rem;color:var(--muted);letter-spacing:0.15em;">GATTITOWN ASSETS v1.0</div>
    </div>
  `;

  board.querySelector('#menu-export-assets-csv').addEventListener('click', () => {
    window.open(exportUrl('assets', 'csv'), '_blank');
  });
  board.querySelector('#menu-export-issues-csv').addEventListener('click', () => {
    window.open(exportUrl('issues', 'csv'), '_blank');
  });
  board.querySelector('#menu-export-assets-json').addEventListener('click', () => {
    window.open(exportUrl('assets', 'json'), '_blank');
  });
  board.querySelector('#menu-export-issues-json').addEventListener('click', () => {
    window.open(exportUrl('issues', 'json'), '_blank');
  });
}
