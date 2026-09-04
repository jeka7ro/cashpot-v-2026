// ==========================================
// MODUL CONFORMITATE ONJN - UI & LOGIC
// ==========================================

const ONJN_TABS = [
  { id: 'onjn-toate', label: 'Toate' },
  { id: 'onjn-central', label: 'ONJN Central' },
  { id: 'onjn-local', label: 'ONJN Local' },
  { id: 'onjn-controls', label: 'Controale' },
  { id: 'onjn-correspondence', label: 'Corespondență' },
  { id: 'onjn-commissions', label: 'Comisii' },
  { id: 'onjn-decisions', label: 'Decizii' }
];

let onjnFilters = {
  'onjn-toate': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-central': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-local': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-controls': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-correspondence': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-commissions': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-decisions': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' }
};

window.calculateSlots = function(textarea) {
    const val = textarea.value || '';
    const items = val.split(/[\s,]+/).filter(x => x.trim().length > 0);
    const count = items.length;
    const form = textarea.closest('form');
    const input = form ? form.querySelector('input[name="total_slots"]') : document.querySelector('input[name="total_slots"]');
    if (input) input.value = count;
};

window.updateOnjnLocDropdownLabel = function() {
    const checkboxes = document.querySelectorAll('input[name="location_ids"]:checked');
    const label = document.getElementById('onjn-loc-dropdown-label');
    if (!label) return;
    if (checkboxes.length === 0) {
        label.innerText = 'Selectează Locații...';
    } else if (checkboxes.length === 1) {
        label.innerText = checkboxes[0].nextSibling.nodeValue.trim();
    } else {
        label.innerText = checkboxes.length + ' locații selectate';
    }
};

window.handleOnjnSearch = function(tabId, val) {
    onjnFilters[tabId].search = val.toLowerCase();
    onjnFilters[tabId].page = 1;
    renderSpecificOnjnTab(tabId);
};

window.handleOnjnLimit = function(tabId, val) {
    onjnFilters[tabId].limit = parseInt(val);
    onjnFilters[tabId].page = 1;
    renderSpecificOnjnTab(tabId);
};

window.handleOnjnPage = function(tabId, dir) {
    onjnFilters[tabId].page += dir;
    renderSpecificOnjnTab(tabId);
};

window.handleOnjnSort = function(tabId, col) {
    if (onjnFilters[tabId].sortBy === col) {
        onjnFilters[tabId].sortDir = onjnFilters[tabId].sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        onjnFilters[tabId].sortBy = col;
        onjnFilters[tabId].sortDir = 'desc';
    }
    renderSpecificOnjnTab(tabId);
};

function renderSpecificOnjnTab(tabId) {
    if (tabId === 'onjn-toate') renderOnjnToate();
    if (tabId === 'onjn-central') renderOnjnCentral();
    if (tabId === 'onjn-local') renderOnjnLocal();
    if (tabId === 'onjn-controls') renderOnjnControls();
    if (tabId === 'onjn-correspondence') renderOnjnCorrespondence();
    if (tabId === 'onjn-decisions') renderOnjnDecisions();
}

function processOnjnData(dataArray, tabId) {
    const f = onjnFilters[tabId];
    
    // Filter
    let filtered = dataArray;
    if (f.search) {
        filtered = filtered.filter(item => {
            const str = JSON.stringify(item).toLowerCase();
            return str.includes(f.search);
        });
    }
    
    // Sort
    filtered = filtered.sort((a, b) => {
        let valA = a[f.sortBy] || '';
        let valB = b[f.sortBy] || '';
        
        if (f.sortBy === 'date') {
           valA = a.date || a.decision_date || a.doc_date || a.pv_date || '';
           valB = b.date || b.decision_date || b.doc_date || b.pv_date || '';
        } else if (f.sortBy === 'number') {
           valA = a.number || a.decision_number || a.notification_number || a.document_number || a.pv_number || a.subject || '';
           valB = b.number || b.decision_number || b.notification_number || b.document_number || b.pv_number || b.subject || '';
        }
        
        if (valA < valB) return f.sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return f.sortDir === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / f.limit) || 1;
    if (f.page > totalPages) f.page = totalPages;
    if (f.page < 1) f.page = 1;
    
    const start = (f.page - 1) * f.limit;
    const end = start + f.limit;
    const paged = filtered.slice(start, end);
    
    // Update footer shell
    const countEl = document.getElementById(`${tabId}-tbody-count`);
    if (countEl) countEl.innerText = total;
    
    const pageEl = document.getElementById(`${tabId}-page-info`);
    if (pageEl) pageEl.innerText = `Pagina ${f.page} din ${totalPages}`;
    
    const btnPrev = document.getElementById(`${tabId}-btn-prev`);
    const btnNext = document.getElementById(`${tabId}-btn-next`);
    if (btnPrev) {
        btnPrev.disabled = f.page <= 1;
        btnPrev.style.opacity = f.page <= 1 ? '0.5' : '1';
        btnPrev.style.cursor = f.page <= 1 ? 'not-allowed' : 'pointer';
    }
    if (btnNext) {
        btnNext.disabled = f.page >= totalPages;
        btnNext.style.opacity = f.page >= totalPages ? '0.5' : '1';
        btnNext.style.cursor = f.page >= totalPages ? 'not-allowed' : 'pointer';
    }
    
    return paged;
}


let onjnData = {
  commissions: [],
  decisions: [],
  notifications: [],
  controls: [],
  correspondence: []
};

// Initialize the ONJN UI when the script loads
window.initOnjnApp = function () {
  const root = document.getElementById('onjn-app-root');
  if (!root) return;

  // Build the Header & Tabs
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div style="font-size:24px; font-weight:800; color:var(--text); letter-spacing:-0.5px;">Conformitate ONJN</div>
      <button onclick="loadOnjnData()" class="btn-ghost" style="padding:8px 16px; display:flex; align-items:center; gap:6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        Refresh Date
      </button>
    </div>

    <!-- TABS -->
    <div style="display:flex; gap:8px; margin-bottom:24px; border-bottom:1px solid var(--border); padding-bottom:12px; overflow-x:auto;">
  `;

  ONJN_TABS.forEach((tab, index) => {
    html += `
      <button id="tab-btn-${tab.id}" 
              onclick="switchOnjnTab('${tab.id}')"
              style="padding:10px 16px; border:none; background:${index === 0 ? 'var(--accent)' : 'transparent'}; 
                     color:${index === 0 ? '#fff' : 'var(--text)'}; border-radius:99px; font-size:14px; font-weight:600; cursor:pointer;
                     display:flex; align-items:center; gap:8px; transition:0.2s;">
        ${tab.label}
      </button>
    `;
  });

  html += `</div>`;

  // Build the View Containers
  ONJN_TABS.forEach((tab, index) => {
    html += `
      <div id="${tab.id}" class="onjn-tab-content" style="display:${index === 0 ? 'block' : 'none'};">
        <div style="text-align:center; padding:40px; color:var(--muted);">Se încarcă secțiunea ${tab.label}...</div>
      </div>
    `;
  });

  root.innerHTML = html;

  // Render initial shells
  renderOnjnToateShell();
  renderOnjnCentralShell();
  renderOnjnLocalShell();
  renderOnjnControlsShell();
  renderOnjnCorrespondenceShell();
  renderOnjnCommissionsShell();
  renderOnjnDecisionsShell();

  // Fetch Data
  loadOnjnData();
}

function switchOnjnTab(tabId) {
  document.querySelectorAll('.onjn-tab-content').forEach(el => el.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';

  document.querySelectorAll('[id^="tab-btn-onjn-"]').forEach(btn => {
    if (btn.id === 'tab-btn-' + tabId) {
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text)';
    }
  });
}

async function loadOnjnData() {
  try {
    const [decisions, comms, notifs, controls, corresp] = await Promise.all([
      fetch('/api/onjn/decisions').then(r => r.json()),
      fetch('/api/onjn/commissions').then(r => r.json()),
      fetch('/api/onjn/notifications').then(r => r.json()),
      fetch('/api/onjn/controls').then(r => r.json()),
      fetch('/api/onjn/correspondence').then(r => r.json())
    ]);

    onjnData = {
      decisions: decisions || [],
      commissions: comms || [],
      notifications: notifs || [],
      controls: controls || [],
      correspondence: corresp || []
    };

    renderOnjnToate();
    renderOnjnCentral();
    renderOnjnLocal();
    renderOnjnControls();
    renderOnjnCorrespondence();
    renderOnjnCommissions();
    renderOnjnDecisions();

  } catch (err) {
    console.error("Error loading ONJN data", err);
  }
}

// ==========================================
// HELPERS
// ==========================================

function getTableShellHTML(tabId, columnsHTML, addBtnText, addBtnAction) {
  const tbodyId = tabId + '-tbody';
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div style="position:relative;">
        <svg class="w-4 h-4 text-subtle" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); z-index:1; width:16px; height:16px; color:var(--muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input type="text" oninput="handleOnjnSearch('${tabId}', this.value)" placeholder="Caută..." class="glass-input" style="padding-left:36px; padding-right:16px; border-radius:9999px; border:1px solid var(--border); background:var(--surface); height:36px; outline:none; font-size:13px; width:250px;">
      </div>
      ${addBtnText ? `<button class="btn btn-primary" style="background:var(--accent); color:white; padding:8px 16px; border:none; border-radius:12px; cursor:pointer; font-weight:600;" onclick="${addBtnAction}">+ ${addBtnText}</button>` : ''}
    </div>
    <div class="table-container" style="background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow-x:auto;">
      <table class="data-table" style="width:100%; border-collapse:collapse;">
        <thead style="background:var(--surface2);">
          <tr>
            <th style="padding:12px; width:50px; text-align:center; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Nr.</th>
            ${columnsHTML}
          </tr>
        </thead>
        <tbody id="${tbodyId}">
          <tr><td colspan="10" style="text-align:center; padding:20px; color:var(--muted); font-size:13px;">Se încarcă...</td></tr>
        </tbody>
      </table>
      
      <div style="padding:12px 20px; border-top:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; background:var(--surface2);">
        <div style="display:flex; align-items:center; gap:16px; font-size:13px; color:var(--text);">
          <span style="white-space:nowrap;">
            Afișează&nbsp;
            <select onchange="handleOnjnLimit('${tabId}', this.value)" style="background:var(--surface); border:1px solid var(--border); border-radius:9999px; padding:2px 8px; outline:none; color:var(--text);">
              <option value="10">10</option>
              <option value="15" selected>15</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="9999">Toți</option>
            </select>
          </span>
          <span style="white-space:nowrap;">Total: <strong id="${tbodyId}-count">0</strong></span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text);">
          <span style="white-space:nowrap;" id="${tabId}-page-info">Pagina 1 din 1</span>
          <button id="${tabId}-btn-prev" onclick="handleOnjnPage('${tabId}', -1)" class="btn btn-icon btn-ghost" style="background:transparent; border:none; cursor:pointer;">&lt;</button>
          <button id="${tabId}-btn-next" onclick="handleOnjnPage('${tabId}', 1)" class="btn btn-icon btn-ghost" style="background:transparent; border:none; cursor:pointer;">&gt;</button>
        </div>
      </div>
    </div>
  `;
}


// ==========================================
// SHELLS (Initial empty structure)
// ==========================================


function renderOnjnToateShell() {
  const cols = `
    <th onclick="handleOnjnSort('onjn-toate', 'category')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Categorie ↕</th>
    <th onclick="handleOnjnSort('onjn-toate', 'number')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Număr ↕</th>
    <th onclick="handleOnjnSort('onjn-toate', 'date')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată ↕</th>
    <th onclick="handleOnjnSort('onjn-toate', 'type')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip ↕</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Total Sloturi</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Locații</th>
    <th onclick="handleOnjnSort('onjn-toate', 'status')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Status ↕</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  const el = document.getElementById('onjn-toate');
  if (el) el.innerHTML = getTableShellHTML('onjn-toate', cols, '', '');
}

function renderOnjnCentralShell() {
  const cols = `
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip Notificare</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Nr. Notificare</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Data Notificării</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-central').innerHTML = getTableShellHTML('onjn-central', cols, 'Adaugă Notificare', "openOnjnModal('notificare_central')");
}

function renderOnjnLocalShell() {
  const cols = `
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip Notificare</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Nr. Notificare</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Data Notificării</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-local').innerHTML = getTableShellHTML('onjn-local', cols, 'Adaugă Notificare Locală', "openOnjnModal('notificare_local')");
}

function renderOnjnControlsShell() {
  const cols = `
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Proces Verbal</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Măsuri</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Status</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-controls').innerHTML = getTableShellHTML('onjn-controls', cols, 'Înregistrează Control', "openOnjnModal('control')");
}

function renderOnjnCorrespondenceShell() {
  const cols = `
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Subiect</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-correspondence').innerHTML = getTableShellHTML('onjn-correspondence', cols, 'Adaugă Corespondență', "openOnjnModal('corespondenta')");
}

function renderOnjnCommissionsShell() {
  const cols = `
    <th onclick="handleOnjnSort('onjn-commissions', 'date')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată Comisie ↕</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-commissions').innerHTML = getTableShellHTML('onjn-commissions', cols, 'Adaugă Comisie', "openOnjnModal('comisie')");
}

function renderOnjnCommissions() {
  const tbody = document.getElementById('onjn-commissions-tbody');
  const countEl = document.getElementById('onjn-commissions-tbody-count');
  if (!tbody) return;

  const paged = processOnjnData(onjnData.commissions || [], 'onjn-commissions');
  if (paged.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--muted);">Nu există comisii înregistrate.</td></tr>';
    return;
  }

  let trs = paged.map((c, i) => {
    return `
      <tr style="transition:0.2s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">
        <td style="padding:12px; border-bottom:1px solid var(--border); font-weight:600;">${c.date || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${c.type || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button onclick="editOnjn('commissions', '${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); transition:0.2s;" onmouseover="this.style.borderColor='var(--text)'" onmouseout="this.style.borderColor='var(--border)'" title="Editează">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button onclick="deleteOnjn('commissions', '${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Șterge">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = trs.join('');
  if (countEl) countEl.innerText = onjnData.commissions.length;
}

function renderOnjnDecisionsShell() {
  const cols = `
    <th onclick="handleOnjnSort('onjn-decisions', 'decision_number')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Nr. / Dată Decizie ↕</th>
    <th onclick="handleOnjnSort('onjn-decisions', 'commission_date')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată Comisie ↕</th>
    <th onclick="handleOnjnSort('onjn-decisions', 'type')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip ↕</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Total Sloturi</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Locație(i)</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-decisions').innerHTML = getTableShellHTML('onjn-decisions', cols, 'Adaugă Decizie', "openOnjnModal('decizie')");
}


// ==========================================
// RENDERERS (Fill data)
// ==========================================


function getAllOnjnData() {
    let all = [];
    (onjnData.decisions || []).forEach(x => { all.push({...x, category: 'Decizie', _type: 'decisions', number: x.decision_number, date: x.decision_date}) });

    (onjnData.notifications || []).forEach(x => { all.push({...x, category: 'Notificare ' + (x.level||''), _type: 'notifications', number: x.notification_number, date: x.date}) });
    (onjnData.controls || []).forEach(x => { all.push({...x, category: 'Control', _type: 'controls', number: x.pv_number, date: x.pv_date, status: x.status}) });
    (onjnData.correspondence || []).forEach(x => { all.push({...x, category: 'Corespondență', _type: 'correspondence', number: x.subject, date: x.doc_date}) });
    return all;
}

function renderOnjnToate() {
  const tbody = document.getElementById('onjn-toate-tbody');
  if (!tbody) return;
  const all = getAllOnjnData();
  const paged = processOnjnData(all, 'onjn-toate');
  
  if (paged.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--muted);">Nu există rezultate.</td></tr>';
    return;
  }
  
  let trs = paged.map((d, i) => {
    const nr = (onjnFilters['onjn-toate'].page - 1) * onjnFilters['onjn-toate'].limit + i + 1;
    
    let locsHtml = '-';
    if (d.location_ids && Array.isArray(d.location_ids) && d.location_ids.length > 0) {
      if (d.location_ids.length > 2) {
         locsHtml = d.location_ids.length + ' locații';
      } else {
         locsHtml = d.location_ids.map(id => {
            const l = (window.filtersData && window.filtersData.locations || []).find(x => String(x.id) === String(id));
            return l ? l.name : id;
         }).join(', ');
      }
    }

    return `
      <tr>
        <td style="text-align:center; color:var(--muted); font-size:13px;">${nr}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border); font-weight:600;">${d.category || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.number || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.date || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.type || d.direction || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.total_slots !== undefined ? d.total_slots : (d.slots_count !== undefined ? d.slots_count : '-')}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${locsHtml}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.status || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button onclick="viewOnjnPdfs('${d._type}', '${d.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" title="Vezi PDF">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </button>
            <button onclick="editOnjn('${d._type}', '${d.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); transition:0.2s;" title="Modifică">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button onclick="deleteOnjn('${d._type}', '${d.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Șterge">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = trs.join('');
}

function renderOnjnDecisions() {
  const tbody = document.getElementById('onjn-decisions-tbody');
  const countEl = document.getElementById('onjn-decisions-tbody-count');
  if (!tbody) return;

  const paged = processOnjnData(onjnData.decisions || [], 'onjn-decisions');
  if (paged.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">Nu există decizii înregistrate.</td></tr>';
    return;
  }

  let trs = paged.map((d, i) => {
    const index = (onjnFilters['onjn-decisions'].page - 1) * onjnFilters['onjn-decisions'].limit + i;
    let locsHtml = '-';
    if (d.location_ids && Array.isArray(d.location_ids) && d.location_ids.length > 0) {
      if (d.location_ids.length > 2) {
         locsHtml = d.location_ids.length + ' locații';
      } else {
         locsHtml = d.location_ids.map(id => {
            const l = (window.filtersData && window.filtersData.locations || []).find(x => String(x.id) === String(id));
            return l ? l.name : id;
         }).join(', ');
      }
    }

    return `
      <tr style="cursor:pointer;" onclick="viewOnjnDecisionSlots('${d.id}')" title="Click pentru detalii complete aparate">
        <td style="text-align:center; color:var(--muted); font-size:13px;">${index + 1}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">
          <div style="font-weight:600; color:var(--accent);">${d.decision_number || '-'}</div>
          <div style="font-size:11px; color:var(--muted);">${d.decision_date || '-'}</div>
        </td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.commission_date || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.type || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border); font-weight:600;">${d.slots_count || d.total_slots || (d.slots_details ? d.slots_details.length : (d.slots ? d.slots.length : 0))}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${locsHtml}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button onclick="event.stopPropagation(); viewOnjnPdfs('decisions', '${d.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Vezi PDF">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </button>
            <button onclick="event.stopPropagation(); viewOnjnDecisionSlots('${d.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--accent); transition:0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'" title="Detalii Aparate">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
            <button onclick="event.stopPropagation(); editOnjn('decisions', '${d.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); transition:0.2s;" onmouseover="this.style.borderColor='var(--text)'" onmouseout="this.style.borderColor='var(--border)'" title="Modifică">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button onclick="event.stopPropagation(); deleteOnjn('decisions', '${d.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Șterge">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = trs.join('');
}

function renderOnjnCentral() {
  const tbody = document.getElementById('onjn-central-tbody');
  const countEl = document.getElementById('onjn-central-tbody-count');
  if (!tbody) return;

  if (!onjnData.notifications || onjnData.notifications.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--muted);">Nu există notificări.</td></tr>';
    if (countEl) countEl.innerText = '0';
    return;
  }
  if (countEl) countEl.innerText = onjnData.notifications.length;

  let trs = onjnData.notifications.map((n, index) => `
    <tr>
      <td style="text-align:center; color:var(--muted); font-size:13px;">${index + 1}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${n.type || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">
        <div style="font-weight:600;">${n.notification_number || '-'}</div>
        <div style="font-size:11px; color:var(--muted);">${n.notification_date || '-'}</div>
      </td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${n.date || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">
        ${n.commission_date ? `${n.commission_date} (${n.commission_type || 'Comisie'})` : '-'}
      </td>
      <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button onclick="viewOnjnPdfs('notifications', '${n.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Vezi PDF">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </button>
          <button onclick="editOnjn('notifications', '${n.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); transition:0.2s;" onmouseover="this.style.borderColor='var(--text)'" onmouseout="this.style.borderColor='var(--border)'" title="Modifică">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button onclick="deleteOnjn('notifications', '${n.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Șterge">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `);
  tbody.innerHTML = trs.join('');
}

function renderOnjnLocal() {
  const tbody = document.getElementById('onjn-local-tbody');
  const countEl = document.getElementById('onjn-local-tbody-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--muted);">Nu există notificări locale.</td></tr>';
  if (countEl) countEl.innerText = '0';
}

function renderOnjnControls() {
  const tbody = document.getElementById('onjn-controls-tbody');
  const countEl = document.getElementById('onjn-controls-tbody-count');
  if (!tbody) return;

  if (!onjnData.controls || onjnData.controls.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--muted);">Nu există controale.</td></tr>';
    if (countEl) countEl.innerText = '0';
    return;
  }
  if (countEl) countEl.innerText = onjnData.controls.length;

  let trs = onjnData.controls.map((c, index) => `
    <tr>
      <td style="text-align:center; color:var(--muted); font-size:13px;">${index + 1}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">
        <div style="font-weight:600;">${c.pv_number || '-'}</div>
        <div style="font-size:11px; color:var(--muted);">${c.control_date || '-'}</div>
      </td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.measures_imposed || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">
        ${c.commission_date ? `${c.commission_date} (${c.commission_type || 'Comisie'})` : '-'}
      </td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.status || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button onclick="viewOnjnPdfs('controls', '${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Vezi PDF">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </button>
          <button onclick="editOnjn('controls', '${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); transition:0.2s;" onmouseover="this.style.borderColor='var(--text)'" onmouseout="this.style.borderColor='var(--border)'" title="Modifică">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button onclick="deleteOnjn('controls', '${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Șterge">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `);
  tbody.innerHTML = trs.join('');
}

function renderOnjnCorrespondence() {
  const tbody = document.getElementById('onjn-correspondence-tbody');
  const countEl = document.getElementById('onjn-correspondence-tbody-count');
  if (!tbody) return;

  if (!onjnData.correspondence || onjnData.correspondence.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--muted);">Nu există corespondență.</td></tr>';
    if (countEl) countEl.innerText = '0';
    return;
  }
  if (countEl) countEl.innerText = onjnData.correspondence.length;

  let trs = onjnData.correspondence.map((c, index) => `
    <tr>
      <td style="text-align:center; color:var(--muted); font-size:13px;">${index + 1}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.doc_date || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.direction === 'IN' ? '<span style="color:var(--green); font-weight:700;">IN</span>' : '<span style="color:var(--red); font-weight:700;">OUT</span>'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.subject || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">
        ${c.commission_id ? (window.filtersData.commissions.find(com => com.id == c.commission_id)?.name || c.commission_id) : '-'}
      </td>
      <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button onclick="viewOnjnPdfs('correspondence', '${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Vezi PDF">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </button>
          <button onclick="editOnjn('correspondence', '${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); transition:0.2s;" onmouseover="this.style.borderColor='var(--text)'" onmouseout="this.style.borderColor='var(--border)'" title="Modifică">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button onclick="deleteOnjn('correspondence', '${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Șterge">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `);
  tbody.innerHTML = trs.join('');
}



// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
window.showOnjnToast = function (message) {
  const existing = document.getElementById('onjn-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'onjn-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--surface2, #1a2235);
    color: var(--text, #fff);
    padding: 12px 24px;
    border-radius: 8px;
    border: 1px solid var(--border, rgba(255,255,255,0.1));
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 999999;
    font-size: 13px;
    font-weight: 500;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--green, #10b981);">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  // trigger animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// ==========================================
// MODALS
// ==========================================

window.updateOnjnLocDropdownLabel = function() {
  const form = document.querySelector('#modal-onjn-dynamic form');
  if (!form) return;
  const checkboxes = form.querySelectorAll('input[name="location_ids"]:checked');
  const label = document.getElementById('onjn-loc-dropdown-label');
  if (!label) return;
  if (checkboxes.length === 0) {
    label.innerText = 'Selectează Locații...';
  } else if (checkboxes.length <= 2) {
    const names = Array.from(checkboxes).map(cb => cb.parentNode.innerText.trim());
    label.innerText = names.join(', ');
  } else {
    label.innerText = checkboxes.length + ' locații selectate';
  }
};

async function submitOnjnForm(event, type) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Se salvează...';
  }

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  delete data.file;

  const locCheckboxes = form.querySelectorAll('input[name="location_ids"]:checked');
  if (locCheckboxes.length > 0) {
    data.location_ids = Array.from(locCheckboxes).map(cb => parseInt(cb.value));
  } else {
    data.location_ids = [];
  }

  if (data.slots_list !== undefined) {
    data.slots = data.slots_list.split(/[\s,]+/).map(s => s.trim()).filter(s => s);
    delete data.slots_list;
  }
  if (data.excel_data) {
    try {
      data.excel_data = JSON.parse(data.excel_data);
    } catch(e) {
      data.excel_data = [];
    }
  }

  let endpoint = '';
  if (type === 'notificare_central' || type === 'notificare_local') endpoint = 'notifications';
  else if (type === 'control') endpoint = 'controls';
  else if (type === 'corespondenta') endpoint = 'correspondence';
  else if (type === 'decizie') endpoint = 'decisions';

  const isEdit = !!data.id;
  const method = isEdit ? 'PUT' : 'POST';
  const url = isEdit ? `/api/onjn/${endpoint}/${data.id}` : `/api/onjn/${endpoint}`;

  const res = await fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    const respData = await res.json();
    const targetId = isEdit ? data.id : respData.id;
    const fileInput = form.querySelector('input[type="file"]');
    if (fileInput && fileInput.files.length > 0 && targetId) {
      const fileData = new FormData();
      fileData.append('file', fileInput.files[0]);
      let entityType = type.replace('notificare_central', 'notification').replace('notificare_local', 'notification');
      if (entityType === 'decizie') entityType = 'decision';
      await fetch(`/api/onjn/documents/${entityType}/${targetId}`, {
        method: 'POST',
        body: fileData
      });
    }
    const modal = document.getElementById('modal-onjn-dynamic');
    if (modal) modal.remove();
    showOnjnToast('Datele au fost salvate cu succes!');
    loadOnjnData();
  } else {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Salvează';
    }
    showOnjnToast('Eroare la salvare!');
  }
}

window.deleteOnjn = async function(type, id) {
  const confirmed = await customConfirm('Ești sigur că vrei să ștergi această înregistrare?');
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/onjn/${type}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showOnjnToast('Înregistrarea a fost ștearsă.');
      loadOnjnData();
    } else {
      showOnjnToast('Eroare la ștergere!');
    }
  } catch (err) {
    showOnjnToast('Eroare conexiune.');
  }
};

window.editOnjn = function(type, id) {
  let item = null;
  if (type === 'notifications') item = onjnData.notifications.find(n => n.id === id);
  if (type === 'decisions') item = onjnData.decisions.find(n => n.id === id);
  if (type === 'controls') item = onjnData.controls.find(n => n.id === id);
  if (type === 'correspondence') item = onjnData.correspondence.find(n => n.id === id);
  if (type === 'commissions') item = onjnData.commissions.find(n => n.id === id);

  if (!item) return;

  let modalType = '';
  if (type === 'notifications') modalType = item.level === 'Central' ? 'notificare_central' : 'notificare_local';
  if (type === 'decisions') modalType = 'decizie';
  if (type === 'controls') modalType = 'control';
  if (type === 'correspondence') modalType = 'corespondenta';
  if (type === 'commissions') modalType = 'comisie';

  openOnjnModal(modalType);

  setTimeout(() => {
    const modal = document.getElementById('modal-onjn-dynamic');
    if (!modal) return;
    const form = modal.querySelector('form');
    if (!form) return;
    
    const idInput = document.createElement('input');
    idInput.type = 'hidden';
    idInput.name = 'id';
    idInput.value = item.id;
    form.appendChild(idInput);

    Object.keys(item).forEach(key => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input && input.type !== 'checkbox' && input.type !== 'radio' && input.type !== 'file') {
        if (input.type === 'date' && item[key]) {
          input.value = item[key].split('T')[0];
        } else {
          input.value = item[key] || '';
        }
      }
    });
    
    const textarea = form.querySelector('[name="slots_list"]');
    if (textarea && item.slots) {
      textarea.value = item.slots.join(', ');
    }

    if (item.location_ids && Array.isArray(item.location_ids)) {
      item.location_ids.forEach(locId => {
        const cb = form.querySelector(`input[name="location_ids"][value="${locId}"]`);
        if (cb) cb.checked = true;
      });
      if (typeof updateOnjnLocDropdownLabel === 'function') {
        updateOnjnLocDropdownLabel();
      }
    }

    if (type === 'decisions') {
      const hiddenExcel = form.querySelector('#hidden_excel_data');
      if (hiddenExcel && item.slots_details && item.slots_details.length > 0) {
        hiddenExcel.value = JSON.stringify(item.slots_details);
        const msg = form.querySelector('#excel_success_msg');
        if (msg) {
          msg.innerText = `✔ ${item.slots_details.length} aparate cu detalii complete salvate în decizie.`;
          msg.style.display = 'block';
        }
      }
      const totalInput = form.querySelector('input[name="total_slots"]');
      if (totalInput) {
        totalInput.value = item.total_slots || (item.slots_details ? item.slots_details.length : (item.slots ? item.slots.length : 0));
      }
    }

  }, 100);
};

window.viewOnjnPdfs = async function(type, id) {
  try {
    let entityType = type.replace('notificare_central', 'notification').replace('notificare_local', 'notification');
    if (entityType === 'decizie') entityType = 'decision';
    if (entityType === 'decisions') entityType = 'decision';
    if (entityType === 'notifications') entityType = 'notification';
    if (entityType === 'controls') entityType = 'control';

    const res = await fetch(`/api/onjn/documents/${entityType}/${id}`);
    if (!res.ok) throw new Error('Eroare la preluare documente');
    const files = await res.json();

    if (!files || files.length === 0) {
      showOnjnToast('Nu există documente atașate pentru această înregistrare.');
      return;
    }

    files.forEach(f => {
      f.download_url = `/api/onjn/documents/${f.id}/download`;
    });

    window._currentPdfFiles = files;
    window._currentPdfIndex = 0;
    
    if (typeof updatePdfViewer === 'function') {
      updatePdfViewer();
      const modal = document.getElementById('pdf-viewer-modal');
      if (modal) modal.classList.add('show');
    }
  } catch(err) {
    showOnjnToast('Eroare la deschiderea PDF-ului.');
  }
};

window.openOnjnModal = function (type) {
  let title = '';
  let formHtml = '';

  if (type === 'notificare_central') {
    title = 'Adaugă Notificare Centrală';
    formHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Nr. Notificare</label>
          <input type="text" name="notification_number" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Data Notificării</label>
          <input type="date" name="date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Tip Notificare</label>
          <select name="type" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
            <option value="">Alege...</option>
            <option value="Comisii">Comisii</option>
            <option value="Mutări">Mutări</option>
            <option value="Scoateri">Scoateri</option>
            <option value="Lista Jackpot">Lista Jackpot</option>
            <option value="Decizii">Decizii</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Comisie (Opțional)</label>
          <select name="commission_id" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);">
            <option value="">Alege Comisia...</option>
            ${(onjnData.commissions || []).map(c => `<option value="${c.id}">${c.date} (${c.type || 'Comisie'})</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Atașează Fișier (Opțional)</label>
          <input type="file" name="file" style="width:100%; box-sizing:border-box; color:var(--text); font-size:12px; margin-top:4px;">
        </div>
      </div>
      <input type="hidden" name="level" value="Central">
    `;
  } else if (type === 'notificare_local') {
    title = 'Adaugă Notificare Locală';
    formHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Nr. Notificare</label>
          <input type="text" name="notification_number" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Data Notificării</label>
          <input type="date" name="date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Tip Notificare</label>
          <select name="type" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
            <option value="">Alege...</option>
            <option value="Comisii">Comisii</option>
            <option value="Mutări">Mutări</option>
            <option value="Scoateri">Scoateri</option>
            <option value="Lista Jackpot">Lista Jackpot</option>
            <option value="Decizii">Decizii</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Comisie (Opțional)</label>
          <select name="commission_id" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);">
            <option value="">Alege Comisia...</option>
            ${(onjnData.commissions || []).map(c => `<option value="${c.id}">${c.date} (${c.type || 'Comisie'})</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Atașează Fișier (Opțional)</label>
          <input type="file" name="file" style="width:100%; box-sizing:border-box; color:var(--text); font-size:12px; margin-top:4px;">
        </div>
      </div>
      <input type="hidden" name="level" value="Local">
    `;
  } else if (type === 'control') {
    title = 'Înregistrează Control';
    formHtml = `
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Proces Verbal</label>
        <input type="text" name="protocol_number" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Măsuri Impuse</label>
        <textarea name="measures_imposed" class="glass-input" style="width:100%; box-sizing:border-box; height:80px; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required></textarea>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Status</label>
          <select name="status" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
            <option value="Deschis">Deschis</option>
            <option value="Închis">Închis</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Comisie (Opțional)</label>
          <select name="commission_id" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);">
            <option value="">Alege Comisia...</option>
            ${(onjnData.commissions || []).map(c => `<option value="${c.id}">${c.date} (${c.type || 'Comisie'})</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Atașează Fișier (Opțional)</label>
          <input type="file" name="file" style="width:100%; box-sizing:border-box; color:var(--text); font-size:12px; margin-top:4px;">
        </div>
      </div>
    `;
  } else if (type === 'corespondenta') {
    title = 'Adaugă Corespondență';
    formHtml = `
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Dată</label>
        <input type="date" name="doc_date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Tip (IN/OUT)</label>
        <select name="direction" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
          <option value="IN">Primit (IN)</option>
          <option value="OUT">Trimis (OUT)</option>
        </select>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Subiect</label>
          <input type="text" name="subject" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Comisie (Opțional)</label>
          <select name="commission_id" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);">
            <option value="">Alege Comisia...</option>
            ${(onjnData.commissions || []).map(c => `<option value="${c.id}">${c.date} (${c.type || 'Comisie'})</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Atașează Fișier (Opțional)</label>
          <input type="file" name="file" style="width:100%; box-sizing:border-box; color:var(--text); font-size:12px; margin-top:4px;">
        </div>
      </div>
    `;
  } else if (type === 'comisie') {
    title = 'Adaugă Comisie';
    formHtml = `
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Dată Comisie</label>
        <input type="date" name="date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Tip Comisie</label>
        <select name="type" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
          <option value="Ordinară">Ordinară</option>
          <option value="Extraordinară">Extraordinară</option>
        </select>
      </div>
    `;
  } else if (type === 'decizie') {
    title = 'Adaugă Decizie';
    formHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Nr. Decizie</label>
          <input type="text" name="decision_number" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Dată Decizie</label>
          <input type="date" name="decision_date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Tip</label>
          <select name="type" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
            <option value="">Alege...</option>
            <option value="Adăugare">Adăugare</option>
            <option value="Mutare">Mutare</option>
            <option value="Scoatere">Scoatere</option>
            <option value="Comisie">Comisie</option>
            <option value="Alte">Alte</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Dată Comisie</label>
          <select name="commission_id" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);">
            <option value="">Alege Comisia...</option>
            ${(onjnData.commissions || []).map(c => `<option value="${c.id}">${c.date} (${c.type || 'Comisie'})</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Total Sloturi</label>
          <input type="number" name="total_slots" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Locație</label>
          <div style="position:relative; width:100%;">
            <div class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text); cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
              <span id="onjn-loc-dropdown-label" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Selectează Locații...</span>
              <span style="font-size:10px;">▼</span>
            </div>
            <div style="display:none; position:absolute; top:100%; left:0; right:0; max-height:200px; overflow-y:auto; background:var(--surface); border:1px solid var(--border); border-radius:8px; margin-top:4px; z-index:9999; box-shadow:0 10px 25px rgba(0,0,0,0.5); padding:8px;">
              ${((window.filtersData && window.filtersData.locations) || []).map(l => `
                <label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; border-radius:4px; font-size:12px; color:var(--text);" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">
                  <input type="checkbox" name="location_ids" value="${l.id}" onchange="updateOnjnLocDropdownLabel()"> ${l.name}
                </label>
              `).join('')}
            </div>
          </div>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Atașează Fișier</label>
          <input type="file" name="file" style="width:100%; box-sizing:border-box; color:var(--text); font-size:12px; margin-top:4px;">
        </div>
      </div>
      <div style="margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label style="font-size:11px; font-weight:700; color:var(--muted);">Serii Aparate (separate prin virgulă sau spațiu)</label>
          <label style="font-size:10px; font-weight:700; color:var(--accent); cursor:pointer; background:var(--surface2); padding:4px 8px; border-radius:4px; border:1px solid var(--border);">
            <input type="file" id="decision_excel_file" accept=".xlsx, .xls" style="display:none;" onchange="parseDecisionExcel(this)">
            + Încarcă Excel Aparate
          </label>
        </div>
        <textarea name="slots_list" id="slots_list_textarea" oninput="calculateSlots(this)" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text); min-height:60px;" placeholder="ex: 12345, 67890"></textarea>
        <div id="excel_success_msg" style="display:none; font-size:11px; color:var(--green); margin-top:4px;">✔ Tabel Excel încărcat. Detaliile vor fi salvate automat.</div>
        <input type="hidden" name="excel_data" id="hidden_excel_data">
      </div>
    `;
  }

  let modalHtml = `
    <div class="settings-modal show" id="modal-onjn-dynamic">
      <div class="settings-panel" style="width:500px; max-width:95%;">
        <div class="settings-header">
          <div class="settings-title">${title}</div>
          <button class="settings-close" onclick="document.getElementById('modal-onjn-dynamic').remove()">×</button>
        </div>
        <div class="settings-body" style="padding:20px;">
          <form onsubmit="submitOnjnForm(event, '${type}')">
            ${formHtml}
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
              <button type="button" class="btn-ghost" onclick="document.getElementById('modal-onjn-dynamic').remove()" style="padding:8px 16px; border-radius:12px;">Anulează</button>
              <button type="submit" class="btn-primary" style="background:var(--accent); color:white; padding:8px 24px; border:none; border-radius:12px; cursor:pointer; font-weight:600;">Salvează</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Remove existing if any
  const existing = document.getElementById('modal-onjn-dynamic');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.parseDecisionExcel = function(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        showOnjnToast('Fișierul Excel nu conține nicio foaie.');
        return;
      }
      
      let bestRows = [];

      const cleanStr = s => s !== undefined && s !== null 
        ? String(s).toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "")
        : "";

      for (let sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!rows || rows.length === 0) continue;

        let headerRowIdx = -1;
        let colMap = { producator: -1, tip_joc: -1, serie: -1, an_fab: -1, locatia: -1, nr_post: -1, nr: -1 };

        for (let r = 0; r < Math.min(rows.length, 30); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          
          let tempMap = { producator: -1, tip_joc: -1, serie: -1, an_fab: -1, locatia: -1, nr_post: -1, nr: -1 };
          let matches = 0;

          row.forEach((cell, cIdx) => {
            const cs = cleanStr(cell);
            if (!cs) return;
            if (cs.includes('producator')) { tempMap.producator = cIdx; matches++; }
            else if (cs.includes('tipjoc') || (cs.includes('tip') && cs.includes('joc')) || cs === 'joc' || cs === 'model') { tempMap.tip_joc = cIdx; matches++; }
            else if (cs.includes('serie')) { tempMap.serie = cIdx; matches += 2; }
            else if (cs.includes('anfab') || cs.includes('fabricatie') || cs === 'an') { tempMap.an_fab = cIdx; matches++; }
            else if (cs.includes('locat') || cs.includes('adresa') || cs.includes('sala')) { tempMap.locatia = cIdx; matches++; }
            else if (cs.includes('post') || cs.includes('nrpost')) { tempMap.nr_post = cIdx; matches++; }
            else if (cs === 'nr' || cs === 'nrcrt') { tempMap.nr = cIdx; }
          });

          if (tempMap.serie !== -1 || matches >= 2) {
            headerRowIdx = r;
            colMap = tempMap;
            break;
          }
        }

        // If no header found by keywords, try finding numeric series column
        if (headerRowIdx === -1 || colMap.serie === -1) {
          for (let r = 0; r < Math.min(rows.length, 15); r++) {
            const row = rows[r];
            if (!Array.isArray(row)) continue;
            row.forEach((cell, cIdx) => {
              const cs = String(cell).trim();
              if (/^\d{5,12}$/.test(cs) && colMap.serie === -1) {
                headerRowIdx = r > 0 ? r - 1 : 0;
                colMap.serie = cIdx;
              }
            });
            if (colMap.serie !== -1) break;
          }
        }

        if (headerRowIdx !== -1 && colMap.serie !== -1) {
          let sheetExtracted = [];
          for (let r = headerRowIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!Array.isArray(row)) continue;
            
            const rawSerie = colMap.serie !== -1 ? row[colMap.serie] : '';
            const serie = rawSerie !== undefined && rawSerie !== null ? String(rawSerie).trim() : '';
            
            if (!serie || serie.toLowerCase().includes('total') || serie.toLowerCase().includes('subtotal')) continue;

            sheetExtracted.push({
              serie: serie,
              slot_machine_id: serie,
              producator: colMap.producator !== -1 && row[colMap.producator] !== undefined ? String(row[colMap.producator]).trim() : '',
              tip_joc: colMap.tip_joc !== -1 && row[colMap.tip_joc] !== undefined ? String(row[colMap.tip_joc]).trim() : '',
              an_fab: colMap.an_fab !== -1 && row[colMap.an_fab] !== undefined ? String(row[colMap.an_fab]).trim() : '',
              locatia: colMap.locatia !== -1 && row[colMap.locatia] !== undefined ? String(row[colMap.locatia]).trim() : '',
              nr_post: colMap.nr_post !== -1 && row[colMap.nr_post] !== undefined ? String(row[colMap.nr_post]).trim() : '1'
            });
          }

          if (sheetExtracted.length > bestRows.length) {
            bestRows = sheetExtracted;
          }
        }
      }

      if (bestRows.length === 0) {
        showOnjnToast('Nu s-au găsit serii sau date de aparate în fișier!');
        return;
      }

      const series = bestRows.map(r => r.serie).filter(Boolean);
      
      const hiddenData = document.getElementById('hidden_excel_data');
      if (hiddenData) hiddenData.value = JSON.stringify(bestRows);

      const textarea = document.getElementById('slots_list_textarea');
      if (textarea) {
        textarea.value = series.join(', ');
        if (typeof calculateSlots === 'function') calculateSlots(textarea);
      }

      const form = textarea ? textarea.closest('form') : document.getElementById('modal-onjn-dynamic');
      if (form) {
        const totalInput = form.querySelector('input[name="total_slots"]');
        if (totalInput) totalInput.value = series.length;

        // Auto-detect and select locations from Excel
        const allLocs = (window.filtersData && window.filtersData.locations) || [];
        if (allLocs.length > 0) {
          const uniqueLocTexts = [...new Set(bestRows.map(r => r.locatia).filter(Boolean))];
          uniqueLocTexts.forEach(locText => {
            const cLoc = cleanStr(locText);
            allLocs.forEach(l => {
              const cName = cleanStr(l.name);
              const cCity = cleanStr(l.city);
              if ((cCity && cLoc.includes(cCity)) || (cName && cLoc.includes(cName)) || (cName && cLoc.includes(cName.replace('centru', '').replace('nord', '').trim()))) {
                const cb = form.querySelector(`input[name="location_ids"][value="${l.id}"]`);
                if (cb) cb.checked = true;
              }
            });
          });
          if (typeof updateOnjnLocDropdownLabel === 'function') {
            updateOnjnLocDropdownLabel();
          }
        }
      }

      const msg = document.getElementById('excel_success_msg');
      if (msg) {
        msg.innerText = `✔ ${series.length} aparate încărcate din Excel (cu detalii complete).`;
        msg.style.display = 'block';
      }

      showOnjnToast(`Excel parsat cu succes! S-au găsit ${series.length} aparate.`);
    } catch (err) {
      console.error(err);
      showOnjnToast('Eroare la parsarea fișierului Excel: ' + (err.message || err));
    }
  };
  reader.readAsArrayBuffer(file);
};

window.viewOnjnDecisionSlots = function(id) {
  const d = onjnData.decisions.find(x => x.id === id);
  if (!d) return;

  const rawList = (d.slots_details && d.slots_details.length > 0)
    ? d.slots_details
    : (d.slots || []).map(s => ({ slot_machine_id: s, producator: '', tip_joc: '', an_fab: '', locatia: '', nr_post: '-' }));

  window._currentDecisionSlotsList = rawList;
  const totalCount = rawList.length;

  window.renderDecisionSlotsRows = function(query) {
    const q = (query || '').toLowerCase().trim();
    const tbody = document.getElementById('decision-slots-tbody');
    const counterEl = document.getElementById('decision-slots-count-display');
    if (!tbody) return;

    const filtered = window._currentDecisionSlotsList.filter(s => {
      if (!q) return true;
      return (s.slot_machine_id && String(s.slot_machine_id).toLowerCase().includes(q)) ||
             (s.producator && String(s.producator).toLowerCase().includes(q)) ||
             (s.tip_joc && String(s.tip_joc).toLowerCase().includes(q)) ||
             (s.an_fab && String(s.an_fab).toLowerCase().includes(q)) ||
             (s.locatia && String(s.locatia).toLowerCase().includes(q)) ||
             (s.nr_post && String(s.nr_post).toLowerCase().includes(q));
    });

    if (counterEl) {
      counterEl.innerText = q ? `${filtered.length} din ${totalCount}` : `${totalCount}`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--muted);">Niciun aparat nu corespunde căutării.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((s, i) => `
      <tr onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'" style="transition:0.15s;">
        <td style="padding:10px 12px; border-bottom:1px solid var(--border); text-align:center; color:var(--muted);">${i+1}</td>
        <td style="padding:10px 12px; border-bottom:1px solid var(--border); font-weight:600;">${s.producator || '-'}</td>
        <td style="padding:10px 12px; border-bottom:1px solid var(--border);">${s.tip_joc || '-'}</td>
        <td style="padding:10px 12px; border-bottom:1px solid var(--border); font-weight:700; color:var(--accent); font-family:monospace; font-size:13px;">${s.slot_machine_id || '-'}</td>
        <td style="padding:10px 12px; border-bottom:1px solid var(--border);">${s.an_fab || '-'}</td>
        <td style="padding:10px 12px; border-bottom:1px solid var(--border);">${s.locatia || '-'}</td>
        <td style="padding:10px 12px; border-bottom:1px solid var(--border); text-align:center;">${s.nr_post || '-'}</td>
      </tr>
    `).join('');
  };

  let modalHtml = `
    <div class="settings-modal show" id="modal-onjn-decision-slots" style="z-index:999999;">
      <div class="settings-panel" style="width:1050px; max-width:96%;">
        <div class="settings-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="settings-title">Detalii Aparate - Decizie ${d.decision_number || 'N/A'}</div>
            <div style="background:rgba(99, 102, 241, 0.12); color:var(--accent); border:1px solid rgba(99, 102, 241, 0.25); padding:4px 12px; border-radius:16px; font-weight:700; font-size:12px; display:flex; align-items:center; gap:6px;">
              <span>Total Sloturi:</span>
              <span id="decision-slots-count-display">${totalCount}</span>
            </div>
          </div>
          <button class="settings-close" onclick="document.getElementById('modal-onjn-decision-slots').remove()">×</button>
        </div>
        <div class="settings-body" style="padding:20px; max-height:75vh; overflow-y:auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:16px; flex-wrap:wrap;">
            <div style="position:relative; width:340px; max-width:100%;">
              <input type="text" id="decision-slots-search" placeholder="Caută serie, producător, joc, locație..." class="glass-input" 
                     style="width:100%; box-sizing:border-box; padding:9px 12px 9px 36px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text); font-size:12px;"
                     oninput="renderDecisionSlotsRows(this.value)" autofocus>
              <svg style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); pointer-events:none;" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <div style="font-size:12px; color:var(--muted);">
              Data Decizie: <strong>${d.decision_date || '-'}</strong> | Tip: <strong>${d.type || '-'}</strong>
            </div>
          </div>

          <div style="border:1px solid var(--border); border-radius:8px; overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <thead>
                <tr style="background:var(--surface2);">
                  <th style="padding:12px; text-align:center; border-bottom:1px solid var(--border); color:var(--muted); width:50px;">Nr.</th>
                  <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted);">Producător</th>
                  <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted);">Tip Joc</th>
                  <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted);">Serie ap.</th>
                  <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); width:80px;">An Fab</th>
                  <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted);">Locația</th>
                  <th style="padding:12px; text-align:center; border-bottom:1px solid var(--border); color:var(--muted); width:80px;">Nr. Post</th>
                </tr>
              </thead>
              <tbody id="decision-slots-tbody">
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const existing = document.getElementById('modal-onjn-decision-slots');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  renderDecisionSlotsRows('');
};

