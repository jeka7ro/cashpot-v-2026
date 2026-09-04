import re
import os

filepath = 'onjn.js'
with open(filepath, 'r') as f:
    content = f.read()

# 1. Update ONJN_TABS
old_tabs = """const ONJN_TABS = [
  { id: 'onjn-central', label: 'ONJN Central' },
  { id: 'onjn-local', label: 'ONJN Local' },
  { id: 'onjn-controls', label: 'Controale' },
  { id: 'onjn-correspondence', label: 'Corespondență' },
  { id: 'onjn-decisions', label: 'Decizii (Registru)' }
];"""
new_tabs = """const ONJN_TABS = [
  { id: 'onjn-toate', label: 'Toate' },
  { id: 'onjn-central', label: 'ONJN Central' },
  { id: 'onjn-local', label: 'ONJN Local' },
  { id: 'onjn-controls', label: 'Controale' },
  { id: 'onjn-correspondence', label: 'Corespondență' },
  { id: 'onjn-decisions', label: 'Decizii' }
];

let onjnFilters = {
  'onjn-toate': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-central': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-local': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-controls': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-correspondence': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' },
  'onjn-decisions': { search: '', page: 1, limit: 15, sortBy: 'date', sortDir: 'desc' }
};

window.calculateSlots = function(val) {
    if (!val) return 0;
    const items = val.split(/[\\s,]+/).filter(x => x.trim().length > 0);
    const count = items.length;
    const input = document.querySelector('input[name="total_slots"]');
    if (input) input.value = count;
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
"""
content = content.replace(old_tabs, new_tabs)

# 2. Update getTableShellHTML
old_shell = """function getTableShellHTML(tbodyId, columnsHTML, addBtnText, addBtnAction) {
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
}"""

new_shell = """function getTableShellHTML(tabId, columnsHTML, addBtnText, addBtnAction) {
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
"""
content = content.replace(old_shell, new_shell)

# 3. Add renderOnjnToateShell and update initOnjnApp
init_app = """  renderOnjnCentralShell();
  renderOnjnLocalShell();
  renderOnjnControlsShell();
  renderOnjnCorrespondenceShell();
  renderOnjnDecisionsShell();"""
init_app_new = """  renderOnjnToateShell();\n""" + init_app
content = content.replace(init_app, init_app_new)

load_app = """    renderOnjnCentral();
    renderOnjnLocal();
    renderOnjnControls();
    renderOnjnCorrespondence();
    renderOnjnDecisions();"""
load_app_new = """    renderOnjnToate();\n""" + load_app
content = content.replace(load_app, load_app_new)

toate_shell = """
function renderOnjnToateShell() {
  const cols = `
    <th onclick="handleOnjnSort('onjn-toate', 'category')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Categorie ↕</th>
    <th onclick="handleOnjnSort('onjn-toate', 'number')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Număr ↕</th>
    <th onclick="handleOnjnSort('onjn-toate', 'date')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată ↕</th>
    <th onclick="handleOnjnSort('onjn-toate', 'type')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip ↕</th>
    <th onclick="handleOnjnSort('onjn-toate', 'status')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Status ↕</th>
    <th style="padding:12px; text-align:right; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Acțiuni</th>
  `;
  const el = document.getElementById('onjn-toate');
  if (el) el.innerHTML = getTableShellHTML('onjn-toate', cols, '', '');
}
"""
content = content.replace("function renderOnjnCentralShell() {", toate_shell + "\nfunction renderOnjnCentralShell() {")

# 4. Modify existing shells to pass tabId and add sortable headers
content = content.replace("getTableShellHTML('onjn-central-tbody'", "getTableShellHTML('onjn-central'")
content = content.replace("getTableShellHTML('onjn-local-tbody'", "getTableShellHTML('onjn-local'")
content = content.replace("getTableShellHTML('onjn-controls-tbody'", "getTableShellHTML('onjn-controls'")
content = content.replace("getTableShellHTML('onjn-correspondence-tbody'", "getTableShellHTML('onjn-correspondence'")
content = content.replace("getTableShellHTML('onjn-decisions-tbody'", "getTableShellHTML('onjn-decisions'")

# Add simple sort triggers to decizii shell
old_dec_shell = """    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Nr. / Dată Decizie</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată Comisie</th>
    <th style="padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip</th>"""
new_dec_shell = """    <th onclick="handleOnjnSort('onjn-decisions', 'decision_number')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Nr. / Dată Decizie ↕</th>
    <th onclick="handleOnjnSort('onjn-decisions', 'commission_date')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Dată Comisie ↕</th>
    <th onclick="handleOnjnSort('onjn-decisions', 'type')" style="cursor:pointer; padding:12px; text-align:left; border-bottom:1px solid var(--border); color:var(--muted); font-size:11px; text-transform:uppercase;">Tip ↕</th>"""
content = content.replace(old_dec_shell, new_dec_shell)

# 5. Add Toate renderer
toate_render = """
function getAllOnjnData() {
    let all = [];
    (onjnData.decisions || []).forEach(x => { all.push({...x, category: 'Decizie', _type: 'decisions', number: x.decision_number, date: x.decision_date}) });
    (onjnData.commissions || []).forEach(x => { all.push({...x, category: 'Comisie', _type: 'commissions', number: x.document_number, date: x.date}) });
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
    return `
      <tr>
        <td style="text-align:center; color:var(--muted); font-size:13px;">${nr}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border); font-weight:600;">${d.category || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.number || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.date || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.type || d.direction || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border);">${d.status || '-'}</td>
        <td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button onclick="viewOnjnPdfs('${d._type}', '${d.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" title="Vezi PDF">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </button>
            <button onclick="editOnjn('${d._type}', '${d.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); transition:0.2s;" title="Modifică">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = trs.join('');
}
"""
content = content.replace("function renderOnjnDecisions() {", toate_render + "\nfunction renderOnjnDecisions() {")

# 6. Apply processOnjnData to Decisions
old_dec = """  if (!onjnData.decisions || onjnData.decisions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">Nu există decizii înregistrate.</td></tr>';
    if (countEl) countEl.innerText = '0';
    return;
  }

  if (countEl) countEl.innerText = onjnData.decisions.length;

  let trs = onjnData.decisions.map((d, index) => {"""
new_dec = """  const paged = processOnjnData(onjnData.decisions || [], 'onjn-decisions');
  if (paged.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">Nu există decizii înregistrate.</td></tr>';
    return;
  }

  let trs = paged.map((d, i) => {
    const index = (onjnFilters['onjn-decisions'].page - 1) * onjnFilters['onjn-decisions'].limit + i;"""
content = content.replace(old_dec, new_dec)


# 7. Modify Decizie Form
old_loc_select = """<select name="location_id" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text);" required>
            <option value="">Alege locația...</option>
            ${(window.locationsData || []).map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
          </select>"""
new_loc_select = """<div style="max-height:100px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; padding:8px; background:var(--surface2);">
            ${(window.locationsData || []).map(l => `<label style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:12px; cursor:pointer;"><input type="checkbox" name="location_ids" value="${l.id}"> ${l.name}</label>`).join('')}
          </div>"""
content = content.replace(old_loc_select, new_loc_select)

old_slots = """<textarea name="slots_list" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text); min-height:60px;" placeholder="ex: 12345, 67890"></textarea>"""
new_slots = """<textarea name="slots_list" oninput="calculateSlots(this.value)" class="glass-input" style="width:100%; box-sizing:border-box; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text); min-height:60px;" placeholder="ex: 12345, 67890"></textarea>"""
content = content.replace(old_slots, new_slots)

# 8. Modify submitOnjnForm to collect location_ids
submit_form_old = """  let formData = new FormData(event.target);
  let data = Object.fromEntries(formData.entries());"""
submit_form_new = """  let formData = new FormData(event.target);
  let data = Object.fromEntries(formData.entries());
  
  if (type === 'decizie') {
    const locBoxes = event.target.querySelectorAll('input[name="location_ids"]:checked');
    data.location_ids = Array.from(locBoxes).map(b => parseInt(b.value));
  }"""
content = content.replace(submit_form_old, submit_form_new)

# 9. Modify editOnjn to check location_ids
edit_onjn_old = """      const textarea = form.querySelector('[name="slots_list"]');
      if (textarea && item.slots) {
        textarea.value = item.slots.join(', ');
      }
    }, 100);"""
edit_onjn_new = """      const textarea = form.querySelector('[name="slots_list"]');
      if (textarea && item.slots) {
        textarea.value = item.slots.join(', ');
      }
      
      if (item.location_ids && Array.isArray(item.location_ids)) {
        item.location_ids.forEach(lid => {
          const cb = form.querySelector(`input[name="location_ids"][value="${lid}"]`);
          if (cb) cb.checked = true;
        });
      } else if (item.location_id) {
          const cb = form.querySelector(`input[name="location_ids"][value="${item.location_id}"]`);
          if (cb) cb.checked = true;
      }
    }, 100);"""
content = content.replace(edit_onjn_old, edit_onjn_new)

with open(filepath, 'w') as f:
    f.write(content)

print("Update completed.")
