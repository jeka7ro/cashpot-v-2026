// ==========================================
// MODUL CONFORMITATE ONJN - UI & LOGIC
// ==========================================

const ONJN_TABS = [
  { id: 'onjn-central', label: 'ONJN Central' },
  { id: 'onjn-local', label: 'ONJN Local' },
  { id: 'onjn-controls', label: 'Controale' },
  { id: 'onjn-correspondence', label: 'Corespondență' },
  { id: 'onjn-decisions', label: 'Decizii (Registru)' }
];

let onjnData = {
  commissions: [],
  decisions: [],
  notifications: [],
  controls: [],
  correspondence: []
};

// Initialize the ONJN UI when the script loads
window.initOnjnApp = function() {
  const root = document.getElementById('onjn-app-root');
  if(!root) return;

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
  renderOnjnCentralShell();
  renderOnjnLocalShell();
  renderOnjnControlsShell();
  renderOnjnCorrespondenceShell();
  renderOnjnDecisionsShell();

  // Fetch Data
  loadOnjnData();
}

function switchOnjnTab(tabId) {
  document.querySelectorAll('.onjn-tab-content').forEach(el => el.style.display = 'none');
  const target = document.getElementById(tabId);
  if(target) target.style.display = 'block';

  document.querySelectorAll('[id^="tab-btn-onjn-"]').forEach(btn => {
    if(btn.id === 'tab-btn-' + tabId) {
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

    renderOnjnCentral();
    renderOnjnLocal();
    renderOnjnControls();
    renderOnjnCorrespondence();
    renderOnjnDecisions();
    
  } catch (err) {
    console.error("Error loading ONJN data", err);
  }
}

// ==========================================
// HELPERS
// ==========================================

function getTableShellHTML(tbodyId, columnsHTML, addBtnText, addBtnAction) {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div style="position:relative;">
        <svg class="w-4 h-4 text-subtle" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); z-index:1; width:16px; height:16px; color:var(--muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input type="text" placeholder="Caută..." class="glass-input" style="padding-left:36px; padding-right:16px; border-radius:9999px; border:1px solid var(--border); background:var(--surface); height:36px; outline:none; font-size:13px; width:250px;">
      </div>
      <button class="btn btn-primary" style="background:var(--accent); color:white; padding:8px 16px; border:none; border-radius:12px; cursor:pointer; font-weight:600;" onclick="${addBtnAction}">+ ${addBtnText}</button>
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
            <select style="background:var(--surface); border:1px solid var(--border); border-radius:9999px; padding:2px 8px; outline:none; color:var(--text);">
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="9999">Toți</option>
            </select>
          </span>
          <span style="white-space:nowrap;">Total înregistrări: <strong id="${tbodyId}-count">0</strong></span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text);">
          <span style="white-space:nowrap;">Pagina 1 din 1</span>
          <button class="btn btn-icon btn-ghost" disabled style="background:transparent; border:none; cursor:not-allowed; opacity:0.5;">&lt;</button>
          <button class="btn btn-icon btn-ghost" disabled style="background:transparent; border:none; cursor:not-allowed; opacity:0.5;">&gt;</button>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// SHELLS (Initial empty structure)
// ==========================================

function renderOnjnCentralShell() {
  const cols = `
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Nr / Dată Notificare</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip Notificare</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată Transmitere</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-central').innerHTML = getTableShellHTML('onjn-central-tbody', cols, 'Adaugă Notificare', "openOnjnModal('notificare_central')");
}

function renderOnjnLocalShell() {
  const cols = `
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Nr / Dată Notificare</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip Notificare</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată Transmitere</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-local').innerHTML = getTableShellHTML('onjn-local-tbody', cols, 'Adaugă Notificare Locală', "openOnjnModal('notificare_local')");
}

function renderOnjnControlsShell() {
  const cols = `
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Proces Verbal</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Măsuri</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Status</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-controls').innerHTML = getTableShellHTML('onjn-controls-tbody', cols, 'Înregistrează Control', "openOnjnModal('control')");
}

function renderOnjnCorrespondenceShell() {
  const cols = `
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Subiect</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-correspondence').innerHTML = getTableShellHTML('onjn-correspondence-tbody', cols, 'Adaugă Corespondență', "openOnjnModal('corespondenta')");
}

function renderOnjnDecisionsShell() {
  const cols = `
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Nr. / Dată Decizie</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată Comisie</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Total Sloturi</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Locație(i)</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  document.getElementById('onjn-decisions').innerHTML = getTableShellHTML('onjn-decisions-tbody', cols, 'Adaugă Decizie', "openOnjnModal('decizie')");
}


// ==========================================
// RENDERERS (Fill data)
// ==========================================

function renderOnjnDecisions() {
  const tbody = document.getElementById('onjn-decisions-tbody');
  const countEl = document.getElementById('onjn-decisions-tbody-count');
  if(!tbody) return;

  if (!onjnData.decisions || onjnData.decisions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">Nu există decizii înregistrate.</td></tr>';
    if(countEl) countEl.innerText = '0';
    return;
  }

  if(countEl) countEl.innerText = onjnData.decisions.length;

  let trs = onjnData.decisions.map((d, index) => {
    return `
      <tr>
        <td style="text-align:center; color:var(--muted); font-size:13px;">${index + 1}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">
          <div style="font-weight:600;">${d.decision_number || '-'}</div>
          <div style="font-size:11px; color:var(--muted);">${d.decision_date || '-'}</div>
        </td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.commission_date || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.type || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border); font-weight:600;">${d.slots_count || 0}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.location_id || 'Multiple'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
          <button class="btn-ghost" style="padding:4px 8px; font-size:12px; color:var(--accent);">Detalii</button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = trs.join('');
}

function renderOnjnCentral() {
  const tbody = document.getElementById('onjn-central-tbody');
  const countEl = document.getElementById('onjn-central-tbody-count');
  if(!tbody) return;

  if (!onjnData.notifications || onjnData.notifications.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--muted);">Nu există notificări.</td></tr>';
    if(countEl) countEl.innerText = '0';
    return;
  }
  if(countEl) countEl.innerText = onjnData.notifications.length;

  let trs = onjnData.notifications.map((n, index) => `
    <tr>
      <td style="text-align:center; color:var(--muted); font-size:13px;">${index + 1}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">
        <div style="font-weight:600;">${n.notification_number || '-'}</div>
        <div style="font-size:11px; color:var(--muted);">${n.notification_date || '-'}</div>
      </td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${n.type || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${n.submission_date || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
        <button class="btn-ghost" style="padding:4px 8px; font-size:12px; color:var(--accent);">Vezi PDF</button>
      </td>
    </tr>
  `);
  tbody.innerHTML = trs.join('');
}

function renderOnjnLocal() {
  const tbody = document.getElementById('onjn-local-tbody');
  const countEl = document.getElementById('onjn-local-tbody-count');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--muted);">Nu există notificări locale.</td></tr>';
  if(countEl) countEl.innerText = '0';
}

function renderOnjnControls() {
  const tbody = document.getElementById('onjn-controls-tbody');
  const countEl = document.getElementById('onjn-controls-tbody-count');
  if(!tbody) return;

  if (!onjnData.controls || onjnData.controls.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--muted);">Nu există controale.</td></tr>';
    if(countEl) countEl.innerText = '0';
    return;
  }
  if(countEl) countEl.innerText = onjnData.controls.length;

  let trs = onjnData.controls.map((c, index) => `
    <tr>
      <td style="text-align:center; color:var(--muted); font-size:13px;">${index + 1}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">
        <div style="font-weight:600;">${c.pv_number || '-'}</div>
        <div style="font-size:11px; color:var(--muted);">${c.control_date || '-'}</div>
      </td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.measures_imposed || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.status || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
        <button class="btn-ghost" style="padding:4px 8px; font-size:12px; color:var(--accent);">Detalii</button>
      </td>
    </tr>
  `);
  tbody.innerHTML = trs.join('');
}

function renderOnjnCorrespondence() {
  const tbody = document.getElementById('onjn-correspondence-tbody');
  const countEl = document.getElementById('onjn-correspondence-tbody-count');
  if(!tbody) return;

  if (!onjnData.correspondence || onjnData.correspondence.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--muted);">Nu există corespondență.</td></tr>';
    if(countEl) countEl.innerText = '0';
    return;
  }
  if(countEl) countEl.innerText = onjnData.correspondence.length;

  let trs = onjnData.correspondence.map((c, index) => `
    <tr>
      <td style="text-align:center; color:var(--muted); font-size:13px;">${index + 1}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.doc_date || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.direction === 'IN' ? 'Primit' : 'Trimis'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border);">${c.subject || '-'}</td>
      <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
        <button class="btn-ghost" style="padding:4px 8px; font-size:12px; color:var(--accent);">Vezi Document</button>
      </td>
    </tr>
  `);
  tbody.innerHTML = trs.join('');
}



// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
window.showOnjnToast = function(message) {
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

window.openOnjnModal = function(type) {
  let title = '';
  let formHtml = '';
  
  if (type === 'notificare_central') {
    title = 'Adaugă Notificare Centrală';
    formHtml = `
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Nr. / Dată Notificare</label>
        <input type="text" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Tip Notificare</label>
        <select class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
          <option value="">Alege...</option>
          <option value="Comisii">Comisii</option>
          <option value="Mutări">Mutări</option>
          <option value="Scoateri">Scoateri</option>
          <option value="Lista Jackpot">Lista Jackpot</option>
        </select>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Dată Transmitere</label>
        <input type="date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
    `;
  } else if (type === 'notificare_local') {
    title = 'Adaugă Notificare Locală';
    formHtml = `
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Nr. / Dată Notificare</label>
        <input type="text" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Tip Notificare</label>
        <input type="text" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Dată Transmitere</label>
        <input type="date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
    `;
  } else if (type === 'control') {
    title = 'Înregistrează Control';
    formHtml = `
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Proces Verbal</label>
        <input type="text" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Măsuri Impuse</label>
        <textarea class="glass-input" style="width:100%; box-sizing:border-box; height:80px; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required></textarea>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Status</label>
        <select class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
          <option value="Deschis">Deschis</option>
          <option value="Închis">Închis</option>
        </select>
      </div>
    `;
  } else if (type === 'corespondenta') {
    title = 'Adaugă Corespondență';
    formHtml = `
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Dată</label>
        <input type="date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Tip (IN/OUT)</label>
        <select class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
          <option value="IN">Primit (IN)</option>
          <option value="OUT">Trimis (OUT)</option>
        </select>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Subiect</label>
        <input type="text" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
      </div>
    `;
  } else if (type === 'decizie') {
    title = 'Adaugă Decizie';
    formHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Nr. Decizie</label>
          <input type="text" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Dată Decizie</label>
          <input type="date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Tip</label>
          <input type="text" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Dată Comisie</label>
          <input type="date" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 16px;">
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Total Sloturi</label>
          <input type="number" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
        </div>
        <div>
          <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); margin-bottom:6px;">Locație</label>
          <input type="text" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);">
        </div>
      </div>
    `;
  }

  let modalHtml = `
    <div class="settings-modal show" id="modal-onjn-dynamic" onclick="if(event.target===this) this.remove()">
      <div class="settings-panel" style="width:500px; max-width:95%;">
        <div class="settings-header">
          <div class="settings-title">${title}</div>
          <button class="settings-close" onclick="document.getElementById('modal-onjn-dynamic').remove()">×</button>
        </div>
        <div class="settings-body" style="padding:20px;">
          <form onsubmit="event.preventDefault(); document.getElementById('modal-onjn-dynamic').remove(); showOnjnToast('Datele au fost salvate cu succes!');">
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
  if(existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};
