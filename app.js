
window.showAlert = function(text, title="Atenție") {
  document.getElementById("custom-alert-title").innerText = title;
  document.getElementById("custom-alert-text").innerText = text;
  document.getElementById("custom-alert-modal").classList.add("show");
};

window.showConfirm = function(text, callback) {
  document.getElementById("custom-confirm-text").innerText = text;
  const btn = document.getElementById("custom-confirm-btn");
  btn.onclick = () => {
    document.getElementById("custom-confirm-modal").classList.remove("show");
    if (callback) callback();
  };
  document.getElementById("custom-confirm-modal").classList.add("show");
};

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5050' : '';
let trendChart=null,pieChart=null,barChart=null,cabChart=null;
let filtersData={},dailyData={},calViewDate=new Date();
window.globalTooltipTimer = null;
let EUR_RATE=5.0;
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#d946ef'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v,d=0){if(v==null)return'—';const n=parseFloat(v);if(isNaN(n))return v;return new Intl.NumberFormat('ro-RO',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);}
function fmtE(v){return fmt(v/EUR_RATE,2)+' €';}
function fmtK(v){return fmt(v,0);}
function pill(v){const c=v>=3?'pill-green':v>0?'pill-blue':'pill-red';return`<span class="pill ${c}">${fmt(v,2)}%</span>`;}
function bonusCost(v){const c=v<=1?'bonus-cost-low':v<=2?'bonus-cost-mid':'bonus-cost-high';return`<span class="bonus-cost ${c}">${fmt(v,1)}%</span>`;}
function getProviderLogo(name) {
  const n = (name||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let domain = '';
  if(n.includes('egt') || n.includes('amusnet')) domain = 'amusnet.com';
  else if(n.includes('novomatic')) domain = 'novomatic.com';
  else if(n.includes('interblock')) domain = 'interblockgaming.com';
  else if(n.includes('casino technology') || n.includes('ct')) domain = 'ctgaming.com';
  else if(n.includes('alfastreet')) domain = 'alfastreet.si';
  else if(n.includes('pragmatic')) domain = 'pragmaticplay.com';
  else if(n.includes('apex')) domain = 'apex-gaming.com';
  
  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  }
  return 'https://ui-avatars.com/api/?name='+encodeURIComponent(name)+'&background=random&color=fff&rounded=true';
}
function bar(v,max){const w=Math.min(100,max?(Math.abs(v)/max)*100:0);const bg=v<0?'var(--red)':'var(--accent)';return`<div class="pct-bar" style="justify-content:flex-end"><div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${bg}"></div></div></div>`;}

window.formatNumberInput = function(e) {
    let val = e.target.value.replace(/[^0-9,]/g, '');
    if (!val) { e.target.value = ''; return; }
    let parts = val.split(',');
    let intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (parts.length > 1) e.target.value = intPart + ',' + parts[1].substring(0, 2);
    else e.target.value = intPart;
};

window.formatNumberValue = function(num) {
    if (num === null || num === undefined) return '';
    let parts = num.toString().split('.');
    let intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (parts.length > 1) return intPart + ',' + parts[1].substring(0, 2);
    return intPart;
};

window.parseNumberInput = function(str) {
    if (!str) return 0;
    str = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(str) || 0;
};

function getGameThumbnail(name, id) {
  return 'slot_icon.png';
}

function gameThumbUrl(name, id) {
  return 'slot_icon.png';
}

// Top 10 Games card loader for dashboard
async function loadTop10Games() {
  const el = document.getElementById('top10-games-body');
  if (!el) return;
  try {
    const {s, e} = getPeriod();
    const data = await api(`/api/multigame?start=${s}&end=${e}${locParam()}`);
    if (!data || !data.length) { el.innerHTML = '<div style="color:var(--muted);padding:16px;font-size:11px">Nu există date</div>'; return; }
    const top10 = data.slice(0, 10);
    const maxBet = Math.max(...top10.map(r => r.bet || 0));
    el.innerHTML = top10.map((r, i) => {
      const thumb = gameThumbUrl(r.game, r.game_id);
      const isNeg = (r.ggr || 0) < 0;
      const ggrC = isNeg ? '#ef4444' : '#10b981';
      const barW = maxBet > 0 ? Math.round((r.bet || 0) / maxBet * 100) : 0;
      return `
        <div style="flex-shrink:0; width:280px; height:120px; display:flex; align-items:center; gap:12px; padding:10px; border-radius:12px; background:var(--surface2); border:1px solid rgba(255,255,255,0.05); scroll-snap-align: start; cursor:pointer;" onclick="openGameDetails('${(cleanGameName(r.game)||'').replace(/'/g,"\\'")}', '${r.game_id||''}')">
          <div style="position:relative; height:100px; width:100px; flex-shrink:0;">
            <img src="${thumb}" referrerpolicy="no-referrer" alt="" loading="lazy"
              style="width:100%; height:100%; object-fit:contain; border-radius:8px; background:var(--surface); border:1px solid rgba(255,255,255,0.1);"
              onerror="this.src='slot_icon.png'; this.style.opacity='0.3'">
          </div>
          <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:space-between; height:100%; padding:2px 0;">
            <div style="font-size:10px; color:var(--muted); font-weight:600; display:flex; justify-content:space-between;">
              <span>LOCUL ${i+1}</span>
              <span style="color:${ggrC};" title="GGR">GGR: ${fmt(r.ggr)}</span>
            </div>
            <div style="font-size:13px; font-weight:800; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${cleanGameName(r.game)}">${cleanGameName(r.game) || 'Necunoscut'}</div>
            <div style="font-size:10px; color:var(--muted);"><i class="fas fa-desktop"></i> ${r.aparate} aparate</div>
            <div style="font-size:14px; font-weight:900; color:var(--yellow);">${fmt(r.bet)} <span style="font-size:10px;">RON BET</span></div>
          </div>
        </div>`;
    }).join('');
  } catch(e) { console.error('loadTop10Games:', e); }
}

// Render Top 3 Games as large circular avatars at the top of Multigame page
function renderTop3Avatars(data) {
  const el = document.getElementById('mg-top-avatars');
  if (!el) return;
  if (!data || !data.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  
  const top3 = data.slice(0, 3);
  el.innerHTML = top3.map((r, i) => {
    const thumb = gameThumbUrl(r.game, r.game_id);
    const color = i === 0 ? '#eab308' : i === 1 ? '#cbd5e1' : '#cd7f32'; // Gold, Silver, Bronze
    return `
      <div class="kpi-card" style="flex:1; display:flex; align-items:center; gap:16px; padding:16px; min-width:240px; position:relative; overflow:hidden;">
        <div style="position:absolute; top:-10px; right:-10px; font-size:60px; font-weight:900; color:var(--accent); opacity:0.05; pointer-events:none;">${i+1}</div>
        <img src="${thumb}" referrerpolicy="no-referrer" alt="" 
          style="width:64px; height:64px; border-radius:50%; object-fit:cover; border:3px solid ${color}; background:var(--surface2);"
          onerror="this.style.opacity='0.3'">
        <div style="flex:1; min-width:0;">
          <div style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Top ${i+1} Performer</div>
          <div style="font-size:14px; font-weight:800; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px; cursor:pointer; text-decoration:underline;" onclick="openGameDetails('${(cleanGameName(r.game)||'').replace(/'/g,"\\'")}', '${r.game_id||''}')">${cleanGameName(r.game)}</div>
          <div style="display:flex; gap:12px; align-items:baseline;">
            <span style="font-size:12px; font-weight:700; color:var(--accent);">${fmt(r.ggr)} RON</span>
            <span style="font-size:10px; color:var(--muted);">${r.aparate} aparate</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function cellCls(v,max){if(!max)return'';const p=v/max;if(v<0)return p<-0.6?'cell-neg-3':p<-0.3?'cell-neg-2':'cell-neg-1';return p>0.7?'cell-pos-3':p>0.35?'cell-pos-2':p>0.1?'cell-pos-1':'';}
function cleanGameName(name) {
  if (!name) return name;
  if (name.length % 2 === 0) {
    const half = name.length / 2;
    if (name.substring(0, half) === name.substring(half)) return name.substring(0, half);
  }
  return name;
}
let _loaderTimeout = null;
function showLoader(v){
  document.getElementById('loader').classList.toggle('show', v);
  clearTimeout(_loaderTimeout);
  if (v) _loaderTimeout = setTimeout(() => { document.getElementById('loader').classList.remove('show'); }, 10000);
}
function round2(v){return Math.round(v*100)/100;}
function getExcluded(){try{return JSON.parse(localStorage.getItem('excluded_locs')||'[]');}catch{return[];}}
function locParam() {
  const gLoc = document.getElementById('global-loc-select');
  if (gLoc && gLoc.value !== 'all') return '&loc_ids=' + gLoc.value;
  const ex=getExcluded();
  const active=(filtersData.locations||[]).filter(l=>!ex.includes(String(l.id))).map(l=>l.id);
  return active.length?'&loc_ids='+active.join(','):'';
}
window.reloadCurrentView = function() {
  const hash = window.location.hash || '#dashboard';
  const { s, e } = getPeriod();

  if (hash === '#rapoarte') {
    // Don't auto-load anything
    return;
  }

  if (hash.startsWith('#rapoarte/ore')) { loadKPI(s,e); loadHourlyReport(); }
  else if (hash.startsWith('#rapoarte/hh')) { loadKPI(s,e); loadHhReport(); }
  else if (hash.startsWith('#rapoarte/marketing')) { loadKPI(s,e); loadMarketingReport(); }
  else if (hash.startsWith('#rapoarte/clienti')) { loadKPI(s,e); loadClientiReport(); }
  else if (hash.startsWith('#rapoarte/retentie')) { loadKPI(s,e); loadRetentionReport(); }
  else if (hash.startsWith('#rapoarte/cashout')) { loadKPI(s,e); loadRapoarteCashout(); }
  else if (hash.startsWith('#rapoarte/lunare')) { loadKPI(s,e); loadLunareReport(); }
  else if (hash.startsWith('#rapoarte/cheltuieli') || hash === '#cheltuieli' || hash.startsWith('#cheltuieli/')) {
    if (s && e) loadKPI(s, e).catch(console.error);
    window.loadExpensesReport();
  }
  else if (hash === '#pl' || hash.startsWith('#pl/')) {
    loadPLData();
  }
  else if (hash.startsWith('#rapoarte/multigame')) {
    loadKPI(s,e);
    window.loadMultigameReport ? loadMultigameReport() : loadMultigame();
  }
  else if (hash.startsWith('#locatie/')) {
    const parts = hash.split('?');
    const locId = parts[0].replace('#locatie/', '');
    const searchParams = new URLSearchParams(parts[1] || '');
    const locName = searchParams.get('name') || 'Locație';
    loadLocationDetails(locId, locName);
  }
  else if (hash.startsWith('#admin/sloturi')) loadAdminSloturi();
  else if (hash === '#admin-floorplan') loadAdminFloorplan();
  else if (hash === '#floorplan') loadGlobalFloorplan();
  else if (hash.startsWith('#live')) { /* live se gestioneaza prin hashchange */ }
  else if (hash === '#pos') loadPosReport();
  else if (hash.startsWith('#analiza')) {
    loadKPI(s,e).catch(console.error);
    const parts = hash.split('/');
    const tab = parts[1] || 'landing';
    loadAnaliza(tab);
  }
  else loadAll();
};

window.loadAnaliza = function(tab) {
  const viewAnaliza = document.getElementById('view-analiza');

  // Highlight sidebar active item
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .sub-item').forEach(el => el.classList.remove('active'));
  const parentMenu = document.querySelector('a[href="#analiza"]');
  if (parentMenu) parentMenu.classList.add('active');
  const activeSub = document.querySelector(`a[href="#analiza/${tab}"]`);
  if (activeSub) activeSub.classList.add('active');

  // Ensure subnav is open
  const subnav = document.getElementById('subnav-analiza');
  if (subnav) subnav.style.display = 'block';

  // Hide all rep-pages inside view-analiza, show the active one
  if (viewAnaliza) {
    viewAnaliza.querySelectorAll('.rep-page').forEach(el => el.style.display = 'none');
    const activePage = document.getElementById('analiza-' + tab);
    if (activePage) {
      activePage.style.display = 'block';
      if (tab === 'rtp') {
        if (typeof window.loadAnalizaRtpData === 'function') {
          window.loadAnalizaRtpData();
        }
      } else if (tab === 'resets') {
        if (typeof window.loadAnalizaResetsData === 'function') {
          window.loadAnalizaResetsData();
        }
      }
    } else {
      document.getElementById('analiza-landing').style.display = 'block';
    }
  }
};
async function api(path, options = {}) {
  const r = await fetch(API + path, options);
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const t = await r.text(); if(t) msg += ': ' + t.substring(0, 200); } catch(_){}
    throw new Error(msg);
  }
  try {
    return await r.json();
  } catch(e) {
    throw new Error('Raspuns invalid de la server (non-JSON). Poate timeout pe query.');
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────
const savedLimit = localStorage.getItem('tableLimit') || 20;
const dLimit = savedLimit === 'all' ? 'all' : parseInt(savedLimit, 10);
const tableStates = {
  locatii: { page: 1, limit: 'all', rows: [] },
  contracts: { page: 1, limit: 10, tbody: 'contracts-tbody', pagination: 'pg-contracts', rows: [] },
  provideri: { page: 1, limit: 'all', rows: [] },
  tipuri: { page: 1, limit: dLimit, rows: [] },
  cabinete: { page: 1, limit: dLimit, rows: [] },
  aparate: { page: 1, limit: dLimit, rows: [] },
  clienti: { page: 1, limit: dLimit, rows: [] },
  'rep-hourly': { page: 1, limit: dLimit, rows: [] },
  'rep-clienti': { page: 1, limit: dLimit, rows: [] },
  'hh-players': { page: 1, limit: dLimit, rows: [] },
  'rep-lunare': { page: 1, limit: dLimit, rows: [] },
  pos: { page: 1, limit: 50, rows: [] },
  'fixed-expenses': { page: 1, limit: dLimit, rows: [] },
  'analiza-rtp': { page: 1, limit: dLimit, rows: [] },
  'analiza-resets': { page: 1, limit: dLimit, rows: [] }
};

function renderTablePaginated(key) {
  const st = tableStates[key];
  if(!st) return;
  const tbody = document.getElementById('body-' + key);
  const pgWrap = document.getElementById('pg-' + key);
  
  const dataRows = st.filteredRows || st.rows;
  
  // Attach sort listeners to TH elements if not already done
  let thead = null;
  if (tbody && tbody.closest('table')) {
    thead = tbody.closest('table').querySelector('thead');
  }
  if (thead && !thead.dataset.sortAttached) {
    thead.querySelectorAll('th').forEach((th, idx) => {
      th.style.cursor = 'pointer';
      th.title = 'Click to sort';
      th.addEventListener('click', () => sortTable(key, idx, th));
    });
    thead.dataset.sortAttached = 'true';
  }
  
  // Restore visual arrows on initial load if sorting is applied from localStorage
  if (thead && st.sortCol === undefined) {
      const savedCol = localStorage.getItem(`sort_${key}_col`);
      const savedDir = localStorage.getItem(`sort_${key}_dir`);
      if (savedCol !== null) {
          const ths = thead.querySelectorAll('th');
          if (ths[parseInt(savedCol, 10)]) {
             ths.forEach(t => t.textContent = t.textContent.replace(/ [▼▲]$/, ''));
             ths[parseInt(savedCol, 10)].textContent += savedDir === 'desc' ? ' ▼' : ' ▲';
          }
      }
  }


  
  let rowsToRender = st.filteredRows || st.rows;
  
  if (st.sortCol === undefined) {
      const savedCol = localStorage.getItem(`sort_${key}_col`);
      const savedDir = localStorage.getItem(`sort_${key}_dir`);
      if (savedCol !== null) {
          st.sortCol = parseInt(savedCol, 10);
          st.sortDir = savedDir || 'desc';
      }
  }

  if (st.sortCol !== undefined) {
    if (!st.parsedRows || st._parsedRowsRef !== rowsToRender) {
      st.parsedRows = rowsToRender.map(html => {
        const tr = document.createElement('tr');
        tr.innerHTML = html;
        return {
          html: html,
          cells: Array.from(tr.querySelectorAll('td')).map(td => {
            let txt = td.textContent.trim();
            let cln = txt.replace(/RON|€|%|▲|▼|\s/gi, '').replace(/\./g, '').replace(',', '.');
            let num = parseFloat(cln);
            return isNaN(num) ? txt : num;
          })
        };
      });
      st._parsedRowsRef = rowsToRender;
    }
    
    st.parsedRows.sort((a, b) => {
      let valA = a.cells[st.sortCol];
      let valB = b.cells[st.sortCol];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return st.sortDir === 'asc' ? valA - valB : valB - valA;
      }
      valA = String(valA||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      valB = String(valB||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return st.sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    
    rowsToRender = st.parsedRows.map(r => r.html);
  } else {
    st.parsedRows = null; // Reset cache if no sort
  }

  if (st.limit === 'all' || rowsToRender.length <= st.limit) {
    tbody.innerHTML = rowsToRender.join('');
  } else {
    const start = (st.page - 1) * st.limit;
    const end = start + parseInt(st.limit);
    tbody.innerHTML = rowsToRender.slice(start, end).join('');
  }
  
  if(pgWrap) {
    pgWrap.style.display = 'flex';
    const totalRecords = rowsToRender.length;
    const totalPages = st.limit === 'all' ? 1 : Math.ceil(totalRecords / st.limit) || 1;
    
    pgWrap.innerHTML = `
      <div class="pg-controls" style="gap:12px; align-items:center;">
        <span class="pg-info" style="font-size:12px; font-weight:700; color:var(--text); padding-right:12px; border-right:1px solid var(--border);">Total: ${totalRecords} rezultate</span>
        <span class="pg-info" style="font-size:12px; padding-left:4px;">Afișează</span>
        <select onchange="changeLimit('${key}', this.value)" class="glass-select" style="padding:4px 30px 4px 12px; font-size:12px; background-color: transparent;">
          <option value="10" ${st.limit==10?'selected':''}>10</option>
          <option value="15" ${st.limit==15?'selected':''}>15</option>
          <option value="20" ${st.limit==20?'selected':''}>20</option>
          <option value="25" ${st.limit==25?'selected':''}>25</option>
          <option value="50" ${st.limit==50?'selected':''}>50</option>
          <option value="all" ${st.limit==='all'?'selected':''}>Toți</option>
        </select>
      </div>
      <div class="pg-controls" style="gap:8px;">
        <span class="pg-info" style="margin-right:8px; font-size:12px;">Pagina ${st.page} din ${totalPages}</span>
        <button class="btn-pg" onclick="changePage('${key}', -1)" ${st.page<=1?'disabled':''} style="border-radius:var(--radius-full);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <button class="btn-pg" onclick="changePage('${key}', 1)" ${st.page>=totalPages?'disabled':''} style="border-radius:var(--radius-full);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    `;
  }
}

window.exportToExcel = function(key) {
  const tbody = document.getElementById('body-' + key);
  const table = tbody ? tbody.closest('table') : null;
  if (!table) return;
  
  // Clone the table to inject all rows and remove ignore elements
  const cloneTable = table.cloneNode(true);
  const cloneTbody = cloneTable.querySelector('tbody');
  
  // Try to use the full data from tableStates if available
  const st = tableStates[key];
  if (st && cloneTbody) {
    let rowsToRender = st.filteredRows || st.rows;
    if (st.parsedRows) {
        rowsToRender = st.parsedRows.map(r => r.html);
    }
    cloneTbody.innerHTML = rowsToRender ? rowsToRender.join('') : '';
  }

  // Attach to DOM temporarily so SheetJS can parse innerHTML/rows properly
  cloneTable.style.position = 'absolute';
  cloneTable.style.left = '-9999px';
  cloneTable.style.top = '-9999px';
  document.body.appendChild(cloneTable);

  const wb = XLSX.utils.table_to_book(cloneTable, { sheet: "Data", raw: true });
  XLSX.writeFile(wb, `Export_${key}_${new Date().toISOString().split('T')[0]}.xlsx`);

  document.body.removeChild(cloneTable);
};

window.sortTable = function(key, colIndex, th) {
  const st = tableStates[key];
  if (!st) return;
  
  // Toggle sort direction
  if (st.sortCol === colIndex) {
    st.sortDir = st.sortDir === 'desc' ? 'asc' : 'desc';
  } else {
    st.sortCol = colIndex;
    st.sortDir = 'desc'; // Default to desc since most are metrics
  }
  
  localStorage.setItem(`sort_${key}_col`, st.sortCol);
  localStorage.setItem(`sort_${key}_dir`, st.sortDir);
  
  // Update visual indicators
  const tbody = document.getElementById('body-' + key);
  const thead = tbody && tbody.closest('table') ? tbody.closest('table').querySelector('thead') : null;
  if(thead) {
    thead.querySelectorAll('th').forEach(t => t.textContent = t.textContent.replace(/ [▼▲]$/, ''));
  }
  th.textContent += st.sortDir === 'desc' ? ' ▼' : ' ▲';
  
  st.page = 1;
  renderTablePaginated(key);
};

window.changeLimit = function(key, limit) {
  const newLimit = limit === 'all' ? 'all' : parseInt(limit);
  localStorage.setItem('tableLimit', limit);
  for (let k in tableStates) {
    if (k === key || (tableStates[k].limit !== 'all' && k !== 'locatii' && k !== 'provideri')) {
        tableStates[k].limit = newLimit;
        tableStates[k].page = 1;
        if (k !== key) renderTablePaginated(k);
    }
  }
  renderTablePaginated(key);
};
window.changePage = function(key, dir) {
  const st = tableStates[key];
  const max = st.limit === 'all' ? 1 : Math.ceil(st.rows.length / st.limit);
  st.page += dir;
  if(st.page < 1) st.page = 1;
  if(st.page > max) st.page = max;
  renderTablePaginated(key);
};

// ─── BNR Rate ─────────────────────────────────────────────────────────────────
async function loadBNR(){
  try{
    const d=await api('/api/eur_rate');
    EUR_RATE=d.rate||5.0;
    const bnrEl = document.getElementById('bnr-rate-val');
    if (bnrEl) bnrEl.textContent=EUR_RATE.toFixed(4);
    const ngrEurEl = document.getElementById('v-ngr-eur');
    if (ngrEurEl) ngrEurEl.textContent='curs BNR '+EUR_RATE.toFixed(4);
  }catch(e){}
}


function applyPreset(p){
  const today=new Date(); let s,e;
  if(p==='today'){s=new Date(today);e=new Date(today);}
  else if(p==='yesterday'){s=new Date(today);s.setDate(today.getDate()-1);e=new Date(today);e.setDate(today.getDate()-1);}
  else if(p==='month'){s=new Date(today.getFullYear(),today.getMonth(),1);e=new Date(today);}
  else if(p==='prev_month'){s=new Date(today.getFullYear(),today.getMonth()-1,1);e=new Date(today.getFullYear(),today.getMonth(),0);}
  else if(p==='q'){
    const q = Math.floor(today.getMonth() / 3);
    s = new Date(today.getFullYear(), q * 3, 1);
    e = new Date(today);
  }
  else if(p==='30d'){e=new Date(today);s=new Date(today);s.setDate(today.getDate()-29);}
  else if(p==='ytd'){s=new Date(today.getFullYear(),0,1);e=new Date(today);}
  const yMd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  
  const finalS = yMd(s);
  const finalE = yMd(e);
  
  document.getElementById('native-date-start').value=finalS;
  document.getElementById('native-date-end').value=finalE;
  document.getElementById('date-start').value=finalS;
  document.getElementById('date-end').value=finalE;
  document.getElementById('tl-range-display').textContent=`${finalS} ➔ ${finalE}`;
  
  localStorage.setItem('cp2_preset', p);
  localStorage.setItem('cp2_start', finalS);
  localStorage.setItem('cp2_end', finalE);
}

function autoSetTrend() {
  const s = document.getElementById('date-start').value;
  const e = document.getElementById('date-end').value;
  const toggles = document.querySelectorAll('.chart-toggles .settings-btn');
  if (!toggles || toggles.length < 3) return;
  
  if (s === e) {
    setTrendGroup('hour', toggles[0]);
  } else {
    const dStart = new Date(s);
    const dEnd = new Date(e);
    const diffDays = (dEnd - dStart) / (1000 * 60 * 60 * 24);
    if (diffDays > 31) {
      setTrendGroup('month', toggles[2]);
    } else {
      setTrendGroup('day', toggles[1]);
    }
  }
}

document.querySelectorAll('.preset-btn').forEach(btn=>{
  if (btn.id === 'btn-month-multi') return;
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');applyPreset(btn.dataset.preset);
    const ms = document.getElementById('mobile-preset-select');
    if (ms) ms.value = btn.dataset.preset;
    autoSetTrend();
    reloadCurrentView();
    const modal = document.getElementById('mobile-period-modal');
    if (modal) modal.classList.remove('show');
  });
});

const mobileSelect = document.getElementById('mobile-preset-select');
if (mobileSelect) {
  mobileSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    document.querySelectorAll('.preset-btn').forEach(b=>{
      b.classList.toggle('active', b.dataset.preset === val);
    });
    applyPreset(val);
    autoSetTrend();
    reloadCurrentView();
  });
}

window.toggleMonthMulti = function(e) {
  e.stopPropagation();
  const dd = document.getElementById('dropdown-month-multi');
  const btn = document.getElementById('btn-month-multi');
  if (dd.style.display === 'none' || !dd.style.display) {
    const rect = btn.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.left = rect.left + 'px';
    dd.style.display = 'flex';
  } else {
    dd.style.display = 'none';
  }
};

document.addEventListener('click', (e) => {
  const container = document.getElementById('multi-month-container');
  const dd = document.getElementById('dropdown-month-multi');
  if (container && dd && !container.contains(e.target)) {
    dd.style.display = 'none';
  }
});

let selectedMultiMonths = [];

window.updateMultiMonthSelection = function() {
  document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
  const btn = document.getElementById('btn-month-multi');
  if(btn) btn.classList.add('active');
  
  const checkboxes = document.querySelectorAll('.month-checkbox:checked');
  selectedMultiMonths = Array.from(checkboxes).map(cb => cb.value);
  
  if (selectedMultiMonths.length === 0) return;
  
  // Find min start and max end dates from selected months
  let minDate = new Date('2099-01-01');
  let maxDate = new Date('2000-01-01');
  const today = new Date();
  
  selectedMultiMonths.forEach(val => {
    const [y, m] = val.split('-');
    const s = new Date(y, parseInt(m)-1, 1);
    let e = new Date(y, parseInt(m), 0);
    if (e > today) e = today;
    
    if (s < minDate) minDate = s;
    if (e > maxDate) maxDate = e;
  });
  
  const yMd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  
  document.getElementById('native-date-start').value = yMd(minDate);
  document.getElementById('native-date-end').value = yMd(maxDate);
  document.getElementById('date-start').value = yMd(minDate);
  document.getElementById('date-end').value = yMd(maxDate);
  document.getElementById('tl-range-display').textContent = `${yMd(minDate)} ➔ ${yMd(maxDate)}`;
  
  autoSetTrend();
  reloadCurrentView();
  const modal = document.getElementById('mobile-period-modal');
  if (modal) modal.classList.remove('show');
};

function populateMonthDropdown() {
  const dd = document.getElementById('dropdown-month-multi');
  if (!dd) return;
  dd.innerHTML = '';
  
  // Update parent dropdown to not clip the button
  dd.style.overflowY = 'visible';
  dd.style.maxHeight = 'none';
  
  const scrollArea = document.createElement('div');
  scrollArea.style.maxHeight = '240px';
  scrollArea.style.overflowY = 'auto';
  scrollArea.style.display = 'flex';
  scrollArea.style.flexDirection = 'column';
  scrollArea.style.gap = '4px';
  
  const today = new Date();
  const MO_RO=['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
  
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${d.getMonth()}`;
    const lbl = `${MO_RO[d.getMonth()]} ${d.getFullYear()}`;
    
    const wrapper = document.createElement('label');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.padding = '8px 12px';
    wrapper.style.cursor = 'pointer';
    wrapper.style.borderRadius = '6px';
    wrapper.style.fontSize = '12px';
    wrapper.onmouseover = () => wrapper.style.background = 'rgba(255,255,255,0.05)';
    wrapper.onmouseout = () => wrapper.style.background = 'transparent';
    
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'month-checkbox';
    cb.value = val;
    cb.style.marginRight = '10px';
    // Removed immediate onchange to prevent constant reloading
    
    wrapper.appendChild(cb);
    wrapper.appendChild(document.createTextNode(lbl));
    scrollArea.appendChild(wrapper);
  }
  
  dd.appendChild(scrollArea);
  
  // Add Apply Button
  const btnWrapper = document.createElement('div');
  btnWrapper.style.marginTop = '8px';
  btnWrapper.style.paddingTop = '8px';
  btnWrapper.style.borderTop = '1px solid var(--border)';
  btnWrapper.style.display = 'flex';
  btnWrapper.style.justifyContent = 'flex-end';
  
  const applyBtn = document.createElement('button');
  applyBtn.textContent = 'Aplică';
  applyBtn.className = 'btn-primary';
  applyBtn.style.padding = '6px 16px';
  applyBtn.style.fontSize = '13px';
  applyBtn.style.fontWeight = 'bold';
  applyBtn.style.borderRadius = '6px';
  applyBtn.onclick = (e) => {
    e.stopPropagation();
    updateMultiMonthSelection();
    dd.style.display = 'none';
  };
  
  btnWrapper.appendChild(applyBtn);
  dd.appendChild(btnWrapper);
}
populateMonthDropdown();

['native-date-start','native-date-end'].forEach(id=>{
  document.getElementById(id).addEventListener('change', ()=>{
    document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
    const s = document.getElementById('native-date-start').value;
    const e = document.getElementById('native-date-end').value;
    if(s && e) {
      document.getElementById('date-start').value = s;
      document.getElementById('date-end').value = e;
      document.getElementById('tl-range-display').textContent=`${s} ➔ ${e}`;
      localStorage.setItem('cp2_start', s);
      localStorage.setItem('cp2_end', e);
      localStorage.removeItem('cp2_preset');
      autoSetTrend();
      reloadCurrentView();
    }
  });
});

// ─── Calendar ─────────────────────────────────────────────────────────────────
const MO_RO=['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const DA_RO=['Lun','Mar','Mie','Joi','Vin','Sâm','Dum'];

let dailyMonthData = {};
let hourlyDayData = {};

function renderMonthCalendar(){
  const y=calViewDate.getFullYear(),m=calViewDate.getMonth();
  document.getElementById('cal-title').textContent=`${MO_RO[m]} ${y}`;
  const grid=document.getElementById('calendar-grid');grid.innerHTML='';
  grid.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
  DA_RO.forEach(d=>{const h=document.createElement('div');h.className='cal-day-header';h.textContent=d;grid.appendChild(h);});
  const first=new Date(y,m,1),last=new Date(y,m+1,0),today=new Date();
  let off=first.getDay()-1;if(off<0)off=6;
  let sumIn = 0, countIn = 0;
  const vals = [];
  for(let d=1;d<=last.getDate();d++){const k=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;if(dailyMonthData[k]!==undefined){vals.push(dailyMonthData[k].ggr); if(dailyMonthData[k].tin > 0) { sumIn += dailyMonthData[k].tin; countIn++; } }}
  const maxV=Math.max(...vals.filter(v=>v>0),1),minV=Math.min(...vals.filter(v=>v<0),-1);
  const avgIn = countIn > 0 ? sumIn / countIn : 1;
  for(let i=0;i<off;i++){const e=document.createElement('div');e.className='cal-day empty';grid.appendChild(e);}
  for(let d=1;d<=last.getDate();d++){
    const k=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const row=dailyMonthData[k];
    const ggr=row?.ggr;
    const cell=document.createElement('div');
    const isT=today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===d;
    cell.className='cal-day'+(isT?' today':'')+(row===undefined?' cal-no-data':'');
    if(row!==undefined){
      const inten=ggr>=0?Math.min(1,ggr/maxV):Math.min(1,Math.abs(ggr)/Math.abs(minV));
      const alpha=(0.15+inten*0.5).toFixed(2);
      cell.style.background=ggr>=0?`rgba(16,185,129,${alpha})`:`rgba(239,68,68,${alpha})`;
      cell.style.cursor='pointer';
      cell.onclick=() => {
        document.getElementById('native-date-start').value = k;
        document.getElementById('native-date-end').value = k;
        document.getElementById('date-start').value = k;
        document.getElementById('date-end').value = k;
        document.getElementById('tl-range-display').textContent=`${k} ➔ ${k}`;
        autoSetTrend();
        reloadCurrentView();
      };
      let inPct = countIn > 0 && row.tin > 0 ? ((row.tin / avgIn) - 1) * 100 : 0;
      let inArr = inPct >= 0 ? '↑' : '↓';
      let inColor = inPct >= 0 ? 'var(--success)' : 'var(--danger)';
      
      cell.innerHTML=`<div class="cal-day-num">${d}</div><div class="cal-day-val">${fmtK(ggr)}</div>`+
        `<div class="cal-day-metrics">IN: ${fmtK(row.tin)} <span style="color:${inColor}; font-size:9px;">${inArr}${Math.abs(inPct).toFixed(1)}%</span><br>BET:${fmtK(row.bet)} &bull; HH:${fmtK(row.hh)}</div>`+
        `<div class="cal-analyze-btn" title="Vezi Analiza Zilei" onclick="event.stopPropagation(); window.openDayAnalysis('${k}');">📈</div>`;
      
      let htmlTip = `
        <div class="tt-header">${k}</div>
        <div class="tt-row"><span class="tt-label">Total IN</span><span class="tt-val">${fmt(row.tin)}</span></div>
        <div class="tt-row"><span class="tt-label">GGR</span><span class="tt-val ${ggr>=0?'pos':'neg'}">${fmt(ggr)}</span></div>
        <div class="tt-row"><span class="tt-label">Cheltuieli</span><span class="tt-val hl">${fmt(row.exp)}</span></div>
        <div class="tt-row"><span class="tt-label">Total BET</span><span class="tt-val">${fmt(row.bet)}</span></div>
      `;
      if(row.locs && row.locs.length > 1) {
        htmlTip += `<div class="tt-divider"></div><div class="tt-loc-title" style="margin-bottom:4px">Detalii pe Sali</div>`;
        htmlTip += `<table style="width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed">`;
        htmlTip += `<tr style="color:var(--text);border-bottom:1px solid var(--border);font-weight:700">`;
        htmlTip += `<th style="text-align:left;padding-bottom:4px;width:38%">Sala</th><th style="text-align:right;padding-bottom:4px;width:22%">IN</th><th style="text-align:right;padding-bottom:4px;width:22%">GGR</th><th style="text-align:right;padding-bottom:4px;width:18%">HH</th></tr>`;
        row.locs.forEach(l => {
          htmlTip += `<tr><td style="padding:3px 0;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${l.locatie}">${l.locatie}</td><td style="text-align:right;padding:3px 0;color:var(--text)">${fmtK(l.in)}</td><td style="text-align:right;padding:3px 0" class="tt-val ${l.ggr>=0?'pos':'neg'}">${fmtK(l.ggr)}</td><td style="text-align:right;padding:3px 0" class="tt-val hl">${l.hh>0?fmtK(l.hh):'—'}</td></tr>`;
        });
        htmlTip += `</table>`;
      }
      htmlTip += `<div style="margin-top:12px;"><button class="btn" style="width:100%; justify-content:center; padding:6px; font-size:11px; background:var(--accent); color:#fff; border:none; border-radius:6px; cursor:pointer;" onclick="window.openDayAnalysis('${k}');">📈 Vezi Analiza Zilei</button></div>`;
      const _showTooltip = () => {
        clearTimeout(window.globalTooltipTimer);
        let tt = document.getElementById('global-tooltip');
        if (!tt) { tt = document.createElement('div'); tt.id = 'global-tooltip'; tt.className = 'custom-tooltip'; document.body.appendChild(tt); }
        tt.innerHTML = htmlTip;
        tt.style.display = 'block';
        const rect = cell.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - 140;
        let top = rect.bottom + 10 + window.scrollY;
        if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
        if (left < 10) left = 10;
        tt.style.left = left + 'px'; tt.style.top = top + 'px';
        // Allow hovering over the tooltip itself without it disappearing
        tt.onmouseenter = () => clearTimeout(window.globalTooltipTimer);
        tt.onmouseleave = () => { window.globalTooltipTimer = setTimeout(() => { tt.style.display = 'none'; }, 400); };
      };
      const _hideTooltip = () => { window.globalTooltipTimer = setTimeout(() => { const tt = document.getElementById('global-tooltip'); if (tt) tt.style.display = 'none'; }, 400); };
      cell.addEventListener('mouseenter', _showTooltip);
      cell.addEventListener('mouseleave', _hideTooltip);
    } else {
      cell.innerHTML=`<div class="cal-day-num">${d}</div>`;
      cell.style.cursor='pointer';
      cell.onclick=() => {
        document.getElementById('native-date-start').value = k; document.getElementById('native-date-end').value = k;
        document.getElementById('date-start').value = k; document.getElementById('date-end').value = k;
        document.getElementById('tl-range-display').textContent=`${k} ➔ ${k}`; autoSetTrend(); loadAll();
      };
    }
    grid.appendChild(cell);
  }
}

function renderHourCalendar(selectedDate) {
  document.getElementById('cal-hour-title').textContent = `Evoluție Orară - ${selectedDate}`;
  const grid=document.getElementById('calendar-hour-grid');grid.innerHTML='';
  grid.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
  let emptyHeaders = '';
  for(let i=0; i<7; i++) emptyHeaders += '<div class="cal-day-header" style="visibility:hidden;">&nbsp;</div>';
  grid.innerHTML = emptyHeaders;
  const opHours = [];
  for(let i=8; i<24; i++) opHours.push(`${String(i).padStart(2,'0')}:00`);
  for(let i=0; i<8; i++) opHours.push(`${String(i).padStart(2,'0')}:00`);
  const vals=[]; let sumIn = 0, countIn = 0;
  opHours.forEach(k => { if(hourlyDayData[k]!==undefined) { vals.push(hourlyDayData[k].ggr); if(hourlyDayData[k].tin > 0) { sumIn += hourlyDayData[k].tin; countIn++; } } });
  const maxV=Math.max(...vals.filter(v=>v>0),1),minV=Math.min(...vals.filter(v=>v<0),-1);
  const avgIn = countIn > 0 ? sumIn / countIn : 1;
  opHours.forEach(k => {
    const row=hourlyDayData[k]; const ggr=row?.ggr; const cell=document.createElement('div');
    cell.className='cal-day'+(row===undefined?' cal-no-data':'');
    if(row!==undefined){
      const inten=ggr>=0?Math.min(1,ggr/maxV):Math.min(1,Math.abs(ggr)/Math.abs(minV));
      const alpha=(0.15+inten*0.5).toFixed(2);
      cell.style.background=ggr>=0?`rgba(16,185,129,${alpha})`:`rgba(239,68,68,${alpha})`;
      let inPct = countIn > 0 && row.tin > 0 ? ((row.tin / avgIn) - 1) * 100 : 0;
      let inArr = inPct >= 0 ? '↑' : '↓';
      let inColor = inPct >= 0 ? 'var(--success)' : 'var(--danger)';
      cell.innerHTML=`<div class="cal-day-num">${k}</div><div class="cal-day-val">${fmtK(ggr)}</div>`+
        `<div class="cal-day-metrics">IN: ${fmtK(row.tin)} <span style="color:${inColor}; font-size:9px;">${inArr}${Math.abs(inPct).toFixed(1)}%</span><br>BET:${fmtK(row.bet)} &bull; HH:${fmtK(row.hh)}</div>`;
      let htmlTip = `<div class="tt-header">${selectedDate} ${k}</div><div class="tt-row"><span class="tt-label">GGR</span><span class="tt-val ${ggr>=0?'pos':'neg'}">${fmt(ggr)}</span></div><div class="tt-row"><span class="tt-label">Total IN</span><span class="tt-val">${fmt(row.tin)}</span></div><div class="tt-row"><span class="tt-label">Total BET</span><span class="tt-val">${fmt(row.bet)}</span></div><div class="tt-row"><span class="tt-label">Happy Hour</span><span class="tt-val hl">${fmt(row.hh)}</span></div>`;
      if (row.locs && row.locs.length) {
        htmlTip += `<div class="tt-divider"></div><table style="width:100%; border-collapse:collapse; font-size:10px; table-layout:fixed;"><tr style="color:var(--text); font-weight:700; border-bottom:1px solid var(--border);"><th style="text-align:left; padding-bottom:4px; width:40%;">Locație</th><th style="text-align:right; padding-bottom:4px; width:25%;">GGR</th><th style="text-align:right; padding-bottom:4px; width:15%;">IN</th><th style="text-align:right; padding-bottom:4px; width:20%;">HH</th></tr>`;
        row.locs.forEach(l => { htmlTip += `<tr><td style="padding:4px 0; color:var(--text); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${l.locatie}">${l.locatie}</td><td style="text-align:right; padding:4px 0;" class="tt-val ${l.ggr>=0?'pos':'neg'}">${fmtK(l.ggr)}</td><td style="text-align:right; padding:4px 0; color:var(--text);">${fmtK(l.in)}</td><td style="text-align:right; padding:4px 0;" class="tt-val hl">${fmtK(l.hh)}</td></tr>`; });
        htmlTip += `</table>`;
      }
      const _showHourTooltip = () => {
        clearTimeout(window.globalTooltipTimer);
        let tt = document.getElementById('global-tooltip'); 
        if (!tt) { tt = document.createElement('div'); tt.id = 'global-tooltip'; tt.className = 'custom-tooltip'; document.body.appendChild(tt); }
        tt.innerHTML = htmlTip; 
        tt.style.display = 'block'; 
        const rect = cell.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - 140; 
        let top = rect.bottom + 10 + window.scrollY;
        if (left + 280 > window.innerWidth) left = window.innerWidth - 290; 
        if (left < 10) left = 10;
        tt.style.left = left + 'px'; 
        tt.style.top = top + 'px';
        tt.onmouseenter = () => clearTimeout(window.globalTooltipTimer);
        tt.onmouseleave = () => { window.globalTooltipTimer = setTimeout(() => { tt.style.display = 'none'; }, 400); };
      };
      const _hideHourTooltip = () => { window.globalTooltipTimer = setTimeout(() => { const tt = document.getElementById('global-tooltip'); if (tt) tt.style.display = 'none'; }, 400); };
      
      cell.addEventListener('mouseenter', _showHourTooltip);
      cell.addEventListener('mouseleave', _hideHourTooltip);
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => {
        window.openHourAnalysis(selectedDate, k);
      });
    } else { cell.innerHTML=`<div class="cal-day-num">${k}</div>`; }
    grid.appendChild(cell);
  });
  
  // Pad with empty cells to match the exact number of rows as the Month Calendar
  const y = calViewDate.getFullYear(), m = calViewDate.getMonth();
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  let off = first.getDay() - 1; if(off < 0) off = 6;
  const totalMonthCells = off + last.getDate();
  const numRows = Math.ceil(totalMonthCells / 7);
  const targetHourCells = numRows * 7;
  for(let i=24; i<targetHourCells; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }
}

async function updateMonthCalendarData(y, m) {
  const mStart = `${y}-${String(m+1).padStart(2,'0')}-01`;
  const lastDay = new Date(y, m+1, 0).getDate();
  const mEnd = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  
  const [dMonth, dExp] = await Promise.all([
    api(`/api/daily?res=day&start=${mStart}&end=${mEnd}${locParam()}`),
    api(`/api/reports/expenses?start=${mStart}&end=${mEnd}${locParam()}`)
  ]);
  
  const expByDate = {};
  if (dExp) {
    dExp.forEach(ex => {
      expByDate[ex.date] = (expByDate[ex.date] || 0) + ex.amount;
    });
  }

  dailyMonthData = {};
  let maxValidDate = '0000-00-00';
  dMonth.forEach(r => { 
    const exp = expByDate[r.date] || 0;
    dailyMonthData[r.date] = {ggr: r.ggr, raw_ggr: r.ggr, exp: exp, tin:r.total_in, hh:r.hh, bet:r.bet||0, locs:r.loc_details||[]}; 
    if (r.date > maxValidDate && r.total_in > 0) { maxValidDate = r.date; }
  });
  return maxValidDate;
}

async function loadCalendars(s,e){
  const d = new Date(e);
  calViewDate = new Date(d.getFullYear(), d.getMonth(), 1);
  dailyMonthData = {};
  hourlyDayData = {};
  renderMonthCalendar();
  renderHourCalendar(e);

  const maxValidDate = await updateMonthCalendarData(d.getFullYear(), d.getMonth());
  
  let lastDataDate = e;
  if (s !== e && maxValidDate !== '0000-00-00' && maxValidDate <= e) {
    lastDataDate = maxValidDate;
  }
  
  const dHour = await api(`/api/daily?res=hour&start=${lastDataDate}&end=${lastDataDate}${locParam()}`);
  hourlyDayData = {};
  dHour.forEach(r => { hourlyDayData[r.date] = {ggr:r.ggr, tin:r.total_in, hh:r.hh, bet:r.bet||0, locs: r.loc_details||[]}; });

  calViewDate = new Date(d.getFullYear(), d.getMonth(), 1);
  renderMonthCalendar();
  renderHourCalendar(lastDataDate);
}
document.getElementById('cal-prev').addEventListener('click', async ()=>{
  let m=calViewDate.getMonth()-1;let y=calViewDate.getFullYear();
  if(m<0){m=11;y--;}
  calViewDate=new Date(y,m,1);
  await updateMonthCalendarData(y, m);
  renderMonthCalendar();
});
document.getElementById('cal-next').addEventListener('click', async ()=>{
  let m=calViewDate.getMonth()+1;let y=calViewDate.getFullYear();
  if(m>11){m=0;y++;}
  calViewDate=new Date(y,m,1);
  await updateMonthCalendarData(y, m);
  renderMonthCalendar();
});

// ─── Drill-down ───────────────────────────────────────────────────────────────
function drillTo(field,val,label){
  // Switch to Aparate tab
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-aparate').classList.add('active');
  document.querySelectorAll('.tab')[4].classList.add('active');
  // Set filter
  if(field==='provider'){const s=document.getElementById('f-prov');for(let o of s.options){if(o.textContent===label){s.value=o.value;break;}}}
  if(field==='cabinet'){const s=document.getElementById('f-cab');for(let o of s.options){if(o.textContent===label){s.value=o.value;break;}}}
  if(field==='location'){
    window.location.hash = `#locatie/${val}?name=${encodeURIComponent(label)}`;
    return;
  }
  loadMachines();
}

// ─── LOCATION DETAILS PAGE ──────────────────────────────────────────────────
let _locDetailChart = null;

let _prevActiveView = 'view-dashboard';

// ==================== CHELTUIELI FIXE ====================
window.loadFixedExpenses = async function() {
  const monthInput = document.getElementById('fixed-exp-month');
  if (!monthInput.value) {
    const now = new Date();
    monthInput.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2, '0');
  }
  const month = monthInput.value;
  try {
    const data = await api('/api/expenses/fixed?month=' + month);
    window._fixedExpenses = data;
    renderFixedExpenses();
  } catch(e) {
    console.error(e);
  }
}

window.renderFixedExpenses = function() {
  const tbody = document.getElementById('body-fixed-expenses');
  if(!tbody) return;
  
  if(!window._fixedExpenses || window._fixedExpenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--muted); padding:24px;">Nu există cheltuieli recurente pentru această lună.</td></tr>`;
    document.getElementById('fixed-expenses-total').innerText = '0.00';
    document.getElementById('pg-fixed-expenses').innerHTML = '';
    return;
  }
  
  let rowsHtml = [];
  let totalRon = 0;
  
  window._fixedExpenses.forEach((r, idx) => {
    totalRon += (r.total_ron || 0);
    rowsHtml.push(`<tr>
      <td style="color:var(--muted); font-weight:600;">${idx + 1}</td>
      <td>${r.expense_date}</td>
      <td>${r.department_name || '-'}</td>
      <td>
        ${r.type_name || '-'}
        ${r.details ? `<div style="font-size:10px; color:var(--muted); margin-top:2px;">${r.details}</div>` : ''}
      </td>
      <td>${r.location_name || 'Toate (Proporțional)'}</td>
      <td class="num">${fmt(r.quantity)}</td>
      <td class="num">${fmt(r.unit_value, 2)}</td>
      <td>${r.currency}</td>
      <td class="num" style="font-weight:700; color:var(--accent);">${fmt(r.total_ron || 0, 2)}</td>
      <td style="text-align:center;">
        <button class="btn-ghost" style="color:var(--accent); padding:4px;" onclick="editFixedExpense('${r.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
        <button class="btn-ghost" style="color:var(--red); padding:4px;" onclick="deleteFixedExpense('${r.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      </td>
    </tr>`);
  });
  
  tableStates['fixed-expenses'].rows = rowsHtml;
  document.getElementById('fixed-expenses-total').innerText = fmt(totalRon, 2);
  
  // Refresh pagination & display
  renderTablePaginated('fixed-expenses');
}

window.deleteFixedExpense = async function(id) {
  if(!confirm('Sigur ștergi această cheltuială?')) return;
  try {
    await api(`/api/expenses/fixed/${id}`, { method: 'DELETE' });
    loadFixedExpenses();
    showAlert('Cheltuiala a fost ștearsă', 'Succes');
  } catch(e) {
    showAlert('Eroare la ștergere: ' + (e.message || ''), 'Eroare');
  }
}

window.editFixedExpense = function(id) {
  const r = window._fixedExpenses.find(x => x.id === id);
  if (r) {
    openFixedExpenseModal(r);
  }
}

window.openFixedExpenseModal = async function(editData = null) {
  document.getElementById('modal-fixed-expense').classList.add('show');
  
  if (editData && editData.id) {
    window.editingFixedExpenseId = editData.id;
    document.getElementById('fx-date').value = editData.expense_date;
    document.getElementById('fx-qty').value = editData.quantity;
    document.getElementById('fx-val').value = editData.unit_value;
    document.getElementById('fx-currency').value = editData.currency;
    document.getElementById('fx-eur').value = editData.eur_rate || '';
    if (document.getElementById('fx-details')) document.getElementById('fx-details').value = editData.details || '';
    if (document.getElementById('fx-recurring')) {
      document.getElementById('fx-recurring').checked = editData.is_recurring;
    }
  } else {
    window.editingFixedExpenseId = null;
    document.getElementById('fx-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('fx-qty').value = 1;
    document.getElementById('fx-val').value = '';
    document.getElementById('fx-currency').value = 'RON';
    document.getElementById('fx-eur').value = '';
    if (document.getElementById('fx-details')) document.getElementById('fx-details').value = '';
    if (document.getElementById('fx-recurring')) {
      document.getElementById('fx-recurring').checked = true;
    }
  }
  
  toggleFxEur();
  calcFixedTotal();
  
  // Load deps and types from expense_form_data
  try {
    const data = await api('/api/admin/expense_form_data?date=' + document.getElementById('fx-date').value);
    window._expenseTypes = data.types || [];
    
    let depHtml = '<option value="">Alege Departament...</option>';
    data.departments.forEach(d => {
       depHtml += `<option value="${d.id}" ${editData && editData.department_id === d.id ? 'selected' : ''}>${d.name}</option>`;
    });
    document.getElementById('fx-dep').innerHTML = depHtml;
    
    let locHtml = '';
    const hiddenLocs = ['Depozit', 'Ploiesti (centru)', 'Focsani'];
    data.locations.forEach(l => {
        if (hiddenLocs.includes(l.name)) return;
        let slotsHtml = l.slots > 0 ? `<span style="color:var(--accent); font-weight:700;">(${l.slots} sloturi)</span>` : '';
        const isChecked = editData && editData.location_ids && editData.location_ids.includes(l.id) ? 'checked' : '';
        locHtml += `<label style="display:flex; align-items:center; gap:6px; font-size:12px;">
                      <input type="checkbox" name="fx-loc-checkbox" value="${l.id}" ${isChecked}> 
                      ${l.name} ${slotsHtml}
                    </label>`;
    });
    document.getElementById('fx-locs-container').innerHTML = locHtml;
    document.getElementById('fx-loc-all').checked = false;
    
    filterFixedExpenseTypes();
    if (editData && editData.id) {
      setTimeout(() => {
        document.getElementById('fx-type').value = editData.type_id;
      }, 50);
    }
  } catch(e) {
    console.error(e);
  }
}

window.toggleAllFxLocs = function(cb) {
  const cbs = document.querySelectorAll('input[name="fx-loc-checkbox"]');
  cbs.forEach(c => c.checked = cb.checked);
}

window.filterFixedExpenseTypes = function() {
  const depId = document.getElementById('fx-dep').value;
  let typeHtml = '<option value="">Alege Categorie...</option>';
  if(window._expenseTypes) {
    const filtered = window._expenseTypes.filter(t => t.department_id === depId);
    filtered.forEach(t => typeHtml += `<option value="${t.id}">${t.name}</option>`);
  }
  document.getElementById('fx-type').innerHTML = typeHtml;
}

window.toggleFxEur = function() {
  const curr = document.getElementById('fx-currency').value;
  document.getElementById('fx-eur-container').style.display = (curr === 'EUR') ? 'block' : 'none';
}

window.calcFixedTotal = function() {
  const qty = parseFloat(document.getElementById('fx-qty').value) || 0;
  const val = parseFloat(document.getElementById('fx-val').value) || 0;
  const curr = document.getElementById('fx-currency').value;
  const rate = (curr === 'EUR') ? (parseFloat(document.getElementById('fx-eur').value) || 0) : 1;
  const tot = qty * val * rate;
  document.getElementById('fx-total-display').innerText = fmt(tot, 2) + ' RON';
}

window.saveFixedExpense = async function() {
    const selectedLocs = Array.from(document.querySelectorAll('input[name="fx-loc-checkbox"]:checked')).map(cb => cb.value);
    
    const payload = {
      expense_date: document.getElementById('fx-date').value,
      location_ids: selectedLocs.length > 0 ? selectedLocs : null,
    department_id: document.getElementById('fx-dep').value,
    type_id: document.getElementById('fx-type').value,
    quantity: parseFloat(document.getElementById('fx-qty').value),
    unit_value: parseFloat(document.getElementById('fx-val').value),
    currency: document.getElementById('fx-currency').value,
    eur_rate: parseFloat(document.getElementById('fx-eur').value) || null,
    is_recurring: document.getElementById('fx-recurring') ? document.getElementById('fx-recurring').checked : true,
    details: document.getElementById('fx-details') ? document.getElementById('fx-details').value : null
  };
  
  if(!payload.expense_date || !payload.department_id || !payload.type_id || !payload.quantity || !payload.unit_value) {
    return showAlert('Completează toate câmpurile obligatorii!', 'Eroare');
  }
  if(payload.currency === 'EUR' && !payload.eur_rate) {
    return showAlert('Cursul EUR este obligatoriu!', 'Eroare');
  }
  
  const isEdit = !!window.editingFixedExpenseId;
  const method = isEdit ? 'PUT' : 'POST';
  const url = isEdit ? `/api/expenses/fixed/${window.editingFixedExpenseId}` : `/api/expenses/fixed`;
  
  try {
    await api(url, {
      method: method,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    document.getElementById('modal-fixed-expense').classList.remove('show');
    showAlert('Cheltuială salvată cu succes!', 'Succes');
    loadFixedExpenses();
    
    // De asemenea, dacă suntem pe vreun tab de expenses, dăm reload ca să prindă datele din server
    if (window.fetchExpenses) window.fetchExpenses();
  } catch(e) {
    showAlert('Eroare la salvare: ' + (e.message || ''), 'Eroare');
  }
}


async function loadLocationDetails(locId, locName) {
  // Save current view and show loc detail
  const activeView = document.querySelector('.view-panel.active');
  if (activeView && activeView.id !== 'view-loc-detail') {
    _prevActiveView = activeView.id;
  }
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('view-loc-detail').classList.add('active');

  document.getElementById('ld-title').textContent = locName;
  const{s,e}=getPeriod();
  if(!s||!e) return;
  showLoader(true);

  try {
    const sDate = new Date(s);
    const eDate = new Date(e);
    const days = Math.round((eDate - sDate) / 86400000) + 1;
    const ps = new Date(sDate.getFullYear(), sDate.getMonth() - 1, sDate.getDate());
    const pe = new Date(ps.getTime() + (days - 1) * 86400000);
    const prevS = ps.toISOString().split('T')[0];
    const prevE = pe.toISOString().split('T')[0];

    // Fetch KPI + daily trend + machines specifically for this location
    const [kpiData, dailyData, machData, prevKpiData] = await Promise.all([
      api(`/api/kpi?start=${s}&end=${e}&loc_ids=${locId}`),
      api(`/api/daily?res=day&start=${s}&end=${e}&loc_ids=${locId}`),
      api(`/api/machines?start=${s}&end=${e}&loc_ids=${locId}`),
      api(`/api/kpi?start=${prevS}&end=${prevE}&loc_ids=${locId}`).catch(()=>({}))
    ]);

    // 1. KPI
    const d = kpiData;
    const pd = prevKpiData || {};
    const tIn = d.total_in||0, tGgr = d.ggr||0, jp = d.jackpot||0, hh = d.hh||0, cb = d.cashback||0;
    const hold = tIn>0 ? (tGgr/tIn)*100 : 0;
    const expenses = jp + hh + cb;
    const mkt = d.marketing || expenses;
    const bet = d.bet||0;
    const bonusCostPct = bet>0 ? (mkt/bet)*100 : 0;
    const holdCls = hold < 15 ? 'var(--red)' : hold > 25 ? 'var(--green)' : 'var(--text)';

    const pIn = pd.total_in||0;
    const pGgr = pd.ggr||0;
    const pExp = (pd.jackpot||0) + (pd.hh||0) + (pd.cashback||0);
    const pMkt = pd.marketing||0;
    
    const diffIn = pIn ? ((tIn - pIn)/pIn)*100 : 0;
    const diffGgr = pGgr ? ((tGgr - pGgr)/Math.abs(pGgr))*100 : 0;
    const diffExp = pExp ? ((expenses - pExp)/pExp)*100 : 0;
    const diffMkt = pMkt ? ((mkt - pMkt)/pMkt)*100 : 0;
    
    const dCls = v => v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--muted)';
    const renderDiff = (v, prevAmt) => {
      if (!prevAmt && v === 0) return '';
      return `<span style="color:${dCls(v)}; font-size:11px; font-weight:700;">
        ${v > 0 ? '+' : ''}${v.toFixed(1)}% <span style="color:var(--muted); font-weight:400;">(${fmt(prevAmt)})</span>
      </span>`;
    };

    document.getElementById('ld-buc').textContent = machData.length;
    document.getElementById('ld-kpi-row').innerHTML = `
      <div class="kpi-card" style="padding:16px;">
        <div class="kpi-label">Total IN</div>
        <div class="kpi-value" style="font-size:20px; display:flex; align-items:baseline; gap:8px;">${fmt(tIn)} ${renderDiff(diffIn, pIn)}</div>
        <div class="kpi-sub">AVG/zi: <strong>${fmt(d.avg_in_zi||0)} RON</strong></div>
      </div>
      <div class="kpi-card" style="padding:16px;">
        <div class="kpi-label">GGR</div>
        <div class="kpi-value" style="font-size:20px; display:flex; align-items:baseline; gap:8px;">${fmt(tGgr)} ${renderDiff(diffGgr, pGgr)}</div>
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <div class="kpi-sub">Hold: <strong style="color:${holdCls}">${hold.toFixed(2)}%</strong></div>
          <div class="kpi-sub">AVG/zi: <strong>${fmt(d.avg_ggr_zi||0)} RON</strong></div>
        </div>
      </div>
      <div class="kpi-card" style="padding:16px; border-left:4px solid var(--red);">
        <div class="kpi-label">Cheltuieli (JP+HH+CB)</div>
        <div class="kpi-value" style="font-size:20px; color:var(--red); display:flex; align-items:baseline; gap:8px;">${fmt(expenses)} ${renderDiff(diffExp, pExp)}</div>
        <div class="kpi-sub">AVG/zi: <strong>${fmt(expenses / Math.max(1, d.nr_zile||1))} RON</strong></div>
      </div>
      <div class="kpi-card" style="padding:16px; border-left:4px solid var(--purple);">
        <div class="kpi-label">Marketing</div>
        <div class="kpi-value" style="font-size:20px; color:var(--purple); display:flex; align-items:baseline; gap:8px;">${fmt(mkt)} ${renderDiff(diffMkt, pMkt)}</div>
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <div class="kpi-sub">Bonus Cost: <strong>${bonusCostPct.toFixed(2)}%</strong></div>
          <div class="kpi-sub">AVG/zi: <strong>${fmt(mkt / Math.max(1, d.nr_zile||1))} RON</strong></div>
        </div>
      </div>
      <div class="kpi-card ld-kpi-games" style="padding:16px;">
        <div class="kpi-label">Games</div>
        <div class="kpi-value" style="font-size:20px;">${fmt(d.games)}</div>
        <div class="kpi-sub">Bet Mediu: <strong>${(bet / Math.max(1, d.games||1)).toFixed(4)} RON</strong></div>
      </div>
    `;

    // 2. Trend Chart & Calendar
    renderLocDetailChart(dailyData);
    renderLocDetailFloorplan(locId, machData);
    renderLocDetailCalendar(locId, e);
    renderLocDetailMachines(machData);
    updateLocDetailPeriodLabel();

  } catch (err) {
    console.error('Error loading location details', err);
  } finally {
    showLoader(false);
  }
}

function closeLocDetail() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.hash = '#dashboard';
  }
}

// Deschide modalul de perioadă din pagina de locație (mobil)
window.openMobilePeriodFromLocDetail = function() {
  const modal = document.getElementById('mobile-period-modal');
  if (modal) modal.classList.add('show');
};

// Actualizeaza eticheta perioadei pe butonul din loc-detail
function updateLocDetailPeriodLabel() {
  const btn = document.getElementById('ld-period-label');
  if (!btn) return;
  const { s, e } = getPeriod();
  if (s && e) {
    const fmtD = d => d ? d.slice(5).replace('-', '.') : '';
    btn.textContent = `${fmtD(s)} – ${fmtD(e)}`;
  }
}

// Smart switch vizualizare din bara de jos mobil
window.mobileSwitchView = function(tabKey) {
  const modal = document.getElementById('mobile-filter-modal');
  if (modal) modal.classList.remove('show');

  const hash = window.location.hash || '';
  if (hash.startsWith('#locatie/') || hash.startsWith('#admin') || hash.startsWith('#live')) {
    window.location.hash = '#dashboard';
    setTimeout(() => switchToTab(tabKey), 350);
  } else {
    switchToTab(tabKey);
  }
};

function switchToTab(tabKey) {
  const tab = document.querySelector(`.tab[onclick*="${tabKey}"]`);
  if (tab) {
    tab.click();
  } else {
    if (typeof window.switchTab === 'function') window.switchTab(tabKey);
  }
  const sel = document.getElementById('mobile-view-select');
  if (sel) sel.value = tabKey;
}

// Populeaza butoanele de locatii in filter modal
window.populateMobileLocSwitch = function() {
  const container = document.getElementById('mobile-loc-buttons');
  if (!container) return;

  const rows = (tableStates && tableStates.locatii && tableStates.locatii.rows && tableStates.locatii.rows.length)
    ? tableStates.locatii.rows : null;

  if (rows) {
    _renderLocButtons(container, rows);
  } else {
    // Daca nu avem date inca, ia din API
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px;">Se încarcă...</div>';
    const { s, e } = getPeriod();
    fetch(`${API}/locations?start=${s}&end=${e}`)
      .then(r => r.json())
      .then(data => {
        if (tableStates && tableStates.locatii) tableStates.locatii.rows = data;
        _renderLocButtons(container, data);
      })
      .catch(() => {
        container.innerHTML = '<div style="font-size:12px;color:var(--red);text-align:center;padding:8px;">Eroare la încărcare</div>';
      });
  }
};

function _renderLocButtons(container, rows) {
  if (!rows || !rows.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px;">Nicio locație disponibilă</div>';
    return;
  }
  const curHash = window.location.hash || '';
  const curLocId = curHash.startsWith('#locatie/') ? curHash.split('?')[0].replace('#locatie/', '') : '';

  container.innerHTML = '';
  rows.forEach(r => {
    const locId = String(r.loc_id || r.id || '');
    const locName = r.locatie || r.name || '—';
    if (!locId) return;
    const isCurrent = locId === String(curLocId);
    const btn = document.createElement('button');
    btn.style.cssText = `width:100%; padding:10px 14px; border-radius:10px; border:1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}; background:${isCurrent ? 'var(--accent)' : 'var(--surface2)'}; color:${isCurrent ? '#fff' : 'var(--text)'}; font-size:13px; font-weight:${isCurrent ? '700' : '500'}; text-align:left; cursor:pointer;`;
    btn.textContent = locName;
    btn.onclick = () => window.mobileSwitchLocation(locId, locName);
    container.appendChild(btn);
  });
}

// Salt rapid la alta locatie
window.mobileSwitchLocation = function(locId, locName) {
  if (!locId) return;
  document.getElementById('mobile-filter-modal')?.classList.remove('show');
  window.location.hash = `#locatie/${locId}?name=${encodeURIComponent(locName || locId)}`;
};

// Populeaza la deschiderea filter modal
document.addEventListener('DOMContentLoaded', () => {
  const filterBtn = document.querySelector('.bot-nav-btn[onclick*="mobile-filter-modal"]');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => setTimeout(window.populateMobileLocSwitch, 50));
  }
});

function renderLocDetailChart(data) {
  const ctx = document.getElementById('ld-daily-chart').getContext('2d');
  if (_locDetailChart) _locDetailChart.destroy();
  if (!data || data.length === 0) return;

  const labels = data.map(r => r.date);
  const totalIn = data.map(r => r.total_in || 0);
  const ggr = data.map(r => r.ggr || 0);

  _locDetailChart = new Chart(ctx, {
    plugins: [window.ChartDataLabels],
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Total IN',
          data: totalIn,
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          yAxisID: 'y',
          order: 2,
          datalabels: { display: false }
        },
        {
          label: 'GGR',
          data: ggr,
          type: 'line',
          borderColor: '#2563eb', // Strong blue
          backgroundColor: '#2563eb',
          borderWidth: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#2563eb',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: false,
          tension: 0.3, // smooth curve
          yAxisID: 'y1',
          order: 1,
          datalabels: {
            display: true,
            align: 'top',
            anchor: 'end',
            offset: 4,
            color: '#1e293b',
            font: { weight: 'bold', size: 10, family: 'Inter' },
            formatter: function(val) {
              return fmtK(val);
            }
          }
        },
        {
          label: 'Marketing',
          data: data.map(r => r.marketing || 0),
          type: 'line',
          borderColor: '#a855f7', // Purple
          backgroundColor: '#a855f7',
          borderWidth: 2,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#a855f7',
          pointBorderWidth: 2,
          pointRadius: 3,
          fill: false,
          tension: 0.3,
          yAxisID: 'y1',
          order: 0,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
        tooltip: {
          callbacks: { label: c => c.dataset.label + ': ' + fmt(c.raw) }
        },
        datalabels: {} // handled per dataset
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { 
          type: 'linear', display: true, position: 'left',
          grid: { color: 'rgba(0,0,0,0.05)' }, 
          ticks: { font: { size: 10 }, callback: v => fmtK(v) } 
        },
        y1: { 
          type: 'linear', display: true, position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10 }, callback: v => fmtK(v) }
        }
      }
    }
  });
}

let _locMachData = [];
let _locMachFiltered = [];
let _locMachPage = 1;
let _locMachPerPage = 15;

window.changeLocMachPerPage = function(val) {
  _locMachPerPage = parseInt(val);
  _locMachPage = 1;
  renderLocDetailMachinesPaginated();
}

window.filterLocMach = function() {
  const term = (document.getElementById('ld-mach-search')?.value || '').toLowerCase();
  if (!term) {
    _locMachFiltered = [..._locMachData];
  } else {
    _locMachFiltered = _locMachData.filter(d => 
      (d.cabinet||'').toLowerCase().includes(term) ||
      (d.provider||'').toLowerCase().includes(term) ||
      (d.tip_slot||'').toLowerCase().includes(term) ||
      (d.serial_nr||'').toLowerCase().includes(term)
    );
  }
  _locMachPage = 1;
  renderLocDetailMachinesPaginated();
}

function renderLocDetailMachines(data) {
  if (data) _locMachData = [...data].sort((a,b) => (b.ggr||0) - (a.ggr||0));
  _locMachFiltered = [..._locMachData];
  
  // Populate Top/Bottom
  const isMobile = window.innerWidth <= 600;
  const defaultLimit = isMobile ? '5' : '10';
  const storedLimit = localStorage.getItem('locDetailTopLimit') || defaultLimit;
  const selectEl = document.getElementById('ld-top-limit');
  if (selectEl) selectEl.value = storedLimit;
  const topLimit = parseInt(storedLimit);

  const top10 = _locMachData.slice(0, topLimit);
  const bottom10 = [..._locMachData].reverse().slice(0, topLimit);
  
  const renderMiniRow = (r) => {
    let rawDetails = r.hp_details || '';
    return `
    <tr>
      <td style="padding-left:16px;">
        <div style="font-weight:600; color:var(--text);">${r.cabinet||'—'}</div>
        <div style="font-size:10px; color:var(--muted);">${r.serial_nr||''}</div>
      </td>
      <td>${r.provider||'—'}</td>
      <td class="num">${pill(r.hold_pct)}</td>
      <td class="num" style="font-weight:600; color:${(r.ggr||0)>=0 ? 'var(--green)' : 'var(--red)'};">${fmt(r.ggr)}</td>
      <td class="num" style="color:var(--text); font-weight:bold; cursor:${r.hp_details ? 'pointer' : 'default'};" data-hp="${rawDetails}" onmouseenter="window.showGlobalHpTooltip(this)" onmouseleave="window.hideGlobalHpTooltip()">
        ${r.handpays||0}
      </td>
    </tr>
    `;
  };
  
  const topBody = document.getElementById('ld-top-machines-body');
  const bottomBody = document.getElementById('ld-bottom-machines-body');
  if (topBody) topBody.innerHTML = top10.length ? top10.map(renderMiniRow).join('') : '<tr><td colspan="5" style="text-align:center;padding:10px;">Fără date</td></tr>';
  if (bottomBody) bottomBody.innerHTML = bottom10.length ? bottom10.map(renderMiniRow).join('') : '<tr><td colspan="5" style="text-align:center;padding:10px;">Fără date</td></tr>';

  _locMachPage = 1;
  renderLocDetailMachinesPaginated();
}

function renderLocDetailMachinesPaginated() {
  const tbody = document.getElementById('ld-machines-body');
  const tfoot = document.getElementById('ld-machines-foot');
  tbody.innerHTML = '';
  
  document.getElementById('ld-table-title').textContent = `Aparate în locație (${_locMachFiltered.length})`;

  if (!_locMachFiltered.length) {
    tfoot.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted)">Niciun aparat găsit</td></tr>`;
    document.getElementById('ld-machines-info').textContent = 'Arată 0 din 0 rânduri';
    document.getElementById('ld-machines-pages').innerHTML = '';
    return;
  }
  
  let tIn=0, tGgr=0, tJp=0, tGames=0, tMkt=0, tBet=0;
  _locMachFiltered.forEach(r => {
    tIn += +r.total_in||0; tGgr += +r.ggr||0; tJp += +r.jackpot||0; 
    tGames += +r.games||0; tMkt += +r.marketing||0; tBet += +r.bet||0;
  });

  const start = (_locMachPage - 1) * _locMachPerPage;
  const end = start + _locMachPerPage;
  const pageData = _locMachFiltered.slice(start, end);

  const maxAbsGgr = Math.max(1, ..._locMachFiltered.map(x=>Math.abs(x.ggr||0)));

  pageData.forEach((r, idx) => {
    const i = start + idx;
    const bPct = +r.bet>0 ? (+r.marketing/(+r.bet))*100 : 0;
    const cc = cellCls(+r.ggr||0, maxAbsGgr);

    tbody.innerHTML += `<tr>
      <td class="ld-mob-hide" style="text-align:center; color:var(--muted); font-size:11px">${i+1}</td>
      <td>
        <strong class="ld-desk-hide" style="color:var(--accent); display:block; margin-bottom:2px;">${r.tip_slot||r.cabinet||'—'}</strong>
        <strong class="ld-mob-hide" style="color:var(--accent)">${r.cabinet||'—'}</strong>
        <div style="font-size:9px;color:var(--muted);line-height:1.4;margin-top:2px"><span class="ld-desk-hide">${r.cabinet||''} · </span>SN: ${r.serial_nr||'—'}</div>
      </td>
      <td class="ld-mob-hide">${r.provider||'—'}</td>
      <td class="ld-mob-hide">${r.tip_slot||'—'}</td>
      <td class="num">${fmt(r.total_in)}</td>
      <td class="num">${fmt(r.bet)}</td>
      <td class="num ${cc}">${fmt(r.ggr)}</td>
      <td class="num">${pill(r.hold_pct)}</td>
      <td class="num">${fmt(r.jackpot)}</td>
      <td class="num ld-mob-hide">${fmt(r.games)}</td>
      <td class="num ld-mob-hide">${bonusCost(bPct)}</td>
    </tr>`;
  });

  const avgHold = tIn>0 ? (tGgr/tIn)*100 : 0;
  const avgBonus = tBet>0 ? (tMkt/tBet)*100 : 0;

  tfoot.innerHTML = `<tr style="font-weight:800; background:var(--surface2);">
    <td class="ld-mob-hide"></td>
    <td>TOTAL</td>
    <td class="ld-mob-hide"></td>
    <td class="ld-mob-hide"></td>
    <td class="num">${fmt(tIn)}</td>
    <td class="num">${fmt(tBet)}</td>
    <td class="num">${fmt(tGgr)}</td>
    <td class="num">${pill(avgHold)}</td>
    <td class="num">${fmt(tJp)}</td>
    <td class="num ld-mob-hide">${fmt(tGames)}</td>
    <td class="num ld-mob-hide">${bonusCost(avgBonus)}</td>
  </tr>`;
  const totalPages = Math.ceil(_locMachData.length / _locMachPerPage);
  document.getElementById('ld-machines-info').textContent = `Arată ${start + 1} - ${Math.min(end, _locMachData.length)} din ${_locMachData.length} rânduri`;
  
  let pagesHtml = '';
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7) {
      if (p !== 1 && p !== totalPages && Math.abs(p - _locMachPage) > 2) {
        if (p === 2 || p === totalPages - 1) pagesHtml += `<span style="padding:4px">...</span>`;
        continue;
      }
    }
    const act = p === _locMachPage ? 'background:var(--accent);color:#fff;border-color:var(--accent)' : 'background:transparent;color:var(--text)';
    pagesHtml += `<button class="cal-nav" style="${act};font-size:12px;padding:4px 10px;border-radius:4px" onclick="_locMachPage=${p};renderLocDetailMachinesPaginated()">${p}</button>`;
  }
  document.getElementById('ld-machines-pages').innerHTML = pagesHtml;
}

let _locMachSortCol = 'ggr';
let _locMachSortAsc = false;
window.sortLocMach = function(col) {
  if (_locMachSortCol === col) {
    _locMachSortAsc = !_locMachSortAsc;
  } else {
    _locMachSortCol = col;
    _locMachSortAsc = false;
  }
  _locMachData.sort((a,b) => {
    let va = a[col], vb = b[col];
    if (col === 'hold_pct') {
      va = a.total_in > 0 ? (a.ggr/a.total_in) : 0;
      vb = b.total_in > 0 ? (b.ggr/b.total_in) : 0;
    }
    if (typeof va === 'string') return _locMachSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _locMachSortAsc ? (va||0) - (vb||0) : (vb||0) - (va||0);
  });
  _locMachPage = 1;
  renderLocDetailMachinesPaginated();
}

window.exportLocMachExcel = function() {
  if (!_locMachData.length) return;
  const csv = [
    ['Nr.', 'Cabinet', 'Provider', 'Tip Joc', 'Total IN', 'Bet', 'GGR', 'Hold%', 'Jackpot', 'Games', 'Bonus Cost Pct'].join(',')
  ];
  _locMachData.forEach((r, i) => {
    const hold = r.total_in > 0 ? ((r.ggr/r.total_in)*100).toFixed(2) : 0;
    const bp = r.bet > 0 ? ((r.marketing/r.bet)*100).toFixed(2) : 0;
    csv.push([
      i+1, 
      `"${r.cabinet||''}"`, 
      `"${r.provider||''}"`, 
      `"${r.tip_slot||''}"`, 
      r.total_in||0, 
      r.bet||0, 
      r.ggr||0, 
      hold, 
      r.jackpot||0, 
      r.games||0, 
      bp
    ].join(','));
  });
  const blob = new Blob([csv.join('\\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Aparate_Locatie_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

window.goToMultigame = function(mix) {
  window.location.hash = '#rapoarte/multigame';
  const mixInput = document.getElementById('mg-filter-mix');
  const activeMix = document.getElementById('mg-active-mix');
  if(mixInput && activeMix) {
    mixInput.value = mix;
    activeMix.textContent = 'Mix: ' + mix + ' ✕';
    activeMix.style.display = 'inline-block';
  }
  loadMultigame();
};

// ─── Settings ─────────────────────────────────────────────────────────────────
function openSettings(showExpenses){
  // Always show expenses config for Super Admin (merged into one button)
  const expSection = document.getElementById('settings-exp-section');
  const expGrid = document.getElementById('settings-exp-grid');
  const show = currentUser && currentUser.role === 'Super Admin';
  if (expSection) expSection.style.display = show ? '' : 'none';
  if (expGrid) expGrid.style.display = show ? 'grid' : 'none';
  if (show) setTimeout(() => loadExpensesConfig(), 50);

  const ex=getExcluded(),list=document.getElementById('settings-locations-list');
  list.innerHTML='';
  (filtersData.locations||[]).forEach(l=>{
    const on=!ex.includes(String(l.id));
    list.innerHTML+=`<label style="display:inline-flex; align-items:center; gap:8px; padding:6px 14px; border-radius:9999px; border:1px solid ${on ? 'var(--accent)' : 'var(--border)'}; background:${on ? 'color-mix(in srgb,var(--accent) 12%,transparent)' : 'var(--surface2)'}; cursor:pointer; font-size:12px; color:var(--text); transition:all .2s;" onclick="this.style.border='1px solid '+(this.querySelector('input').checked?'var(--border)':'var(--accent)');this.style.background=(this.querySelector('input').checked?'var(--surface2)':'color-mix(in srgb,var(--accent) 12%,transparent)');">
      <input type="checkbox" id="lt-${l.id}" ${on?'checked':''} style="display:none;">
      <span>${l.name}</span>
    </label>`;
  });
  document.getElementById('settings-modal').classList.add('show');
}
window.openExpensesSettings = function() {
  if (!currentUser || currentUser.role !== 'Super Admin') return;
  openSettings(true);
}
function closeSettings(){document.getElementById('settings-modal').classList.remove('show');}
function closeSettingsOutside(e){if(e.target===document.getElementById('settings-modal'))closeSettings();}
async function saveSettings(){
  const ex=[];
  document.querySelectorAll('#settings-locations-list input[type="checkbox"]').forEach(c => {
    if(!c.checked) {
      ex.push(c.id.replace('lt-',''));
    }
  });
  localStorage.setItem('excluded_locs',JSON.stringify(ex));
  
  if (window.saveExpensesConfig) {
    await window.saveExpensesConfig();
  }
  
  closeSettings();
  loadFilters().then(() => loadAll());
}

// ─── Period & Trends ────────────────────────────────────────────────────────
function sanitizeDateStr(dStr) {
  if (!dStr) return dStr;
  let y, m, d;
  if (dStr.includes('.')) {
    const p = dStr.split('.');
    d = parseInt(p[0], 10);
    m = parseInt(p[1], 10);
    y = parseInt(p[2], 10);
  } else {
    const p = dStr.split('-');
    y = parseInt(p[0], 10);
    m = parseInt(p[1], 10);
    d = parseInt(p[2], 10);
  }
  if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
    if (m < 1) m = 1;
    if (m > 12) m = 12;
    let lastDay = new Date(y, m, 0).getDate();
    if (d < 1) d = 1;
    if (d > lastDay) d = lastDay;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  const today = new Date();
  return today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
}

function getPeriod(){
  return {
    s: sanitizeDateStr(document.getElementById('date-start').value),
    e: sanitizeDateStr(document.getElementById('date-end').value)
  };
}
function getCompDates(s, e) {
  const dStart = new Date(s);
  const dEnd = new Date(e);
  const today = new Date();
  const isCurrentMonth = dStart.getFullYear() === today.getFullYear() && dStart.getMonth() === today.getMonth();
  if (isCurrentMonth) {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (yesterday >= dStart) {
      const diffDays = yesterday.getDate();
      const ce1 = yesterday.toISOString().split('T')[0];
      const cs2 = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
      const ce2 = new Date(today.getFullYear(), today.getMonth() - 1, diffDays).toISOString().split('T')[0];
      return { ce1, cs2, ce2 };
    }
  } else {
    const cs2 = new Date(dStart.getFullYear(), dStart.getMonth() - 1, 1).toISOString().split('T')[0];
    const cEnd = new Date(dStart.getFullYear(), dStart.getMonth() - 1, dEnd.getDate());
    const ce2 = cEnd.toISOString().split('T')[0];
    return { ce1: e, cs2, ce2 };
  }
  return null;
}
function tBadge(curr, prev) {
  if (!prev || prev <= 0) return '';
  const pct = ((curr - prev) / prev) * 100;
  const c = pct >= 0 ? 'up' : 'down';
  const a = pct >= 0 ? '↑' : '↓';
  return `<span style="margin-left:6px; display:inline-block; vertical-align:middle;"><span class="kpi-trend ${c}" style="font-size:9px; padding:2px 4px;">${a}${Math.abs(pct).toFixed(1)}%</span></span>`;
}
// ─── API Loaders ──────────────────────────────────────────────────────────────
async function loadFilters(){
  filtersData=await api('/api/filters');
  const ex=getExcluded();
  const fs=document.getElementById('global-loc-select');
  
  let perms = { locations: [] };
  if (window.currentUser && currentUser.role !== 'Super Admin' && currentUser.permissions) {
    try { perms = JSON.parse(currentUser.permissions); } catch(e) {}
  }

  if(fs) {
    if (perms.locations && perms.locations.length > 0) {
      fs.innerHTML = ''; // No "Toate locațiile" if restricted
    } else {
      fs.innerHTML = '<option value="all">Toate locațiile</option>';
    }
  }
  
  const repLunareLoc = document.getElementById('rep-lunare-loc');
  if (repLunareLoc) {
    repLunareLoc.innerHTML = '';
  }
  
  (filtersData.locations||[]).forEach(l=>{
    if(!ex.includes(String(l.id))) {
      if (perms.locations && perms.locations.length > 0 && !perms.locations.includes(l.id)) return;
      if (fs) fs.innerHTML+=`<option value="${l.id}">${l.name}</option>`;
      if (repLunareLoc) repLunareLoc.innerHTML+=`<label style="display:flex; align-items:center; gap:8px; font-size:12px; padding:6px 8px; cursor:pointer; border-radius:8px; transition:background 0.2s; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'"><input type="checkbox" class="lunare-loc-cb" value="${l.id}" onchange="updateLocSelectText()"> ${l.name}</label>`;
    }
  });
  
  const rp=document.getElementById('rep-prov-select');
  const fp=document.getElementById('f-prov');
  if(fp) fp.innerHTML = '<option value="all">Toți providerii</option>';
  if(rp) rp.innerHTML = '<option value="all">Toți providerii</option>';
  
  // Populate multigame provider/cabinet filters
  const mgProv = document.getElementById('mg-filter-provider');
  const mgCab  = document.getElementById('mg-filter-cabinet');
  if (mgProv) {
    mgProv.innerHTML = '<option value="">Toti producatorii</option>' +
      (filtersData.providers||[]).map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  }
  if (mgCab) {
    mgCab.innerHTML = '<option value="">Toate cabinetele</option>' +
      (filtersData.cabinets||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  }
  (filtersData.providers||[]).forEach(p=>{
    if(fp) fp.innerHTML+=`<option value="${p.id}">${p.name}</option>`;
    if(rp) rp.innerHTML+=`<option value="${p.id}">${p.name}</option>`;
  });
  
  const fc=document.getElementById('f-cab');
  if(fc) fc.innerHTML = '<option value="all">Toate cabinetele</option>';
  (filtersData.cabinets||[]).forEach(c=>{
    if(fc) fc.innerHTML+=`<option value="${c.id}">${c.name}</option>`;
  });
}

async function loadKPI(s,e){
  const dStart = new Date(s);
  const dEnd = new Date(e);
  const today = new Date();
  const isCurrentMonth = dStart.getFullYear() === today.getFullYear() && dStart.getMonth() === today.getMonth();
  
  let promises = [api(`/api/kpi?start=${s}&end=${e}${locParam()}`)];
  let hasComp = false;

  if (isCurrentMonth) {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (yesterday >= dStart) {
      const diffDays = yesterday.getDate();
      const ce1 = yesterday.toISOString().split('T')[0];
      const cs2 = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
      const ce2 = new Date(today.getFullYear(), today.getMonth() - 1, diffDays).toISOString().split('T')[0];
      promises.push(api(`/api/kpi?start=${s}&end=${ce1}${locParam()}`));
      promises.push(api(`/api/kpi?start=${cs2}&end=${ce2}${locParam()}`));
      hasComp = true;
    }
  } else {
    const cs2 = new Date(dStart.getFullYear(), dStart.getMonth() - 1, 1).toISOString().split('T')[0];
    const cEnd = new Date(dStart.getFullYear(), dStart.getMonth() - 1, dEnd.getDate());
    const ce2 = cEnd.toISOString().split('T')[0];
    promises.push(api(`/api/kpi?start=${s}&end=${e}${locParam()}`)); // dummy currExcl
    promises.push(api(`/api/kpi?start=${cs2}&end=${ce2}${locParam()}`));
    hasComp = true;
  }

  const results = await Promise.all(promises);
  const d = results[0];
  const currExcl = hasComp ? results[1] : d;
  const comp = hasComp ? results[2] : null;

  document.getElementById('v-in').textContent=fmt(d.total_in)+' RON';
  document.getElementById('v-in-day').textContent='AVG/zi: '+fmt(d.avg_in_zi)+' RON';
  document.getElementById('v-ggr').textContent=fmt(d.ggr)+' RON';
  document.getElementById('v-hold').textContent='Hold: '+fmt(d.hold_pct,2)+'%';
  const ggrDayEl = document.getElementById('v-ggr-day');
  if(ggrDayEl) ggrDayEl.textContent = 'AVG/zi: ' + fmt(d.avg_ggr_zi) + ' RON';

  const marketingCost = d.marketing || ((d.jackpot || 0) + (d.hh || 0) + (d.cashback || 0));
  const ngrCalculated = (d.ggr || 0) - marketingCost;

  const ngrEl = document.getElementById('v-ngr');
  if (ngrEl) ngrEl.textContent = fmt(ngrCalculated) + ' RON';
  const ngrDayEl = document.getElementById('v-ngr-day');
  if (ngrDayEl) ngrDayEl.textContent = 'AVG/zi: ' + fmt(d.nr_zile ? ngrCalculated/d.nr_zile : 0) + ' RON';

  const profitEl = document.getElementById('v-profit');
  if (profitEl) {
    profitEl.textContent = fmt(d.net_profit) + ' RON';
    profitEl.style.color = d.net_profit >= 0 ? 'var(--green)' : 'var(--red)';
  }
  const expEl = document.getElementById('v-expenses');
  if (expEl) {
    expEl.textContent = 'Cheltuieli: ' + fmt(d.expenses) + ' RON';
  }
  const vMkt = document.getElementById('v-marketing');
  if (vMkt) {
    vMkt.textContent = fmt(marketingCost) + ' RON';
    vMkt.style.color = 'var(--purple)'; 
  }
  
  const vMktMonth = document.getElementById('v-marketing-month');
  if (vMktMonth && s && e) {
    const diffDays = (new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24);
    const months = Math.max(1, diffDays / 30.44);
    vMktMonth.textContent = 'AVG/lună: ' + fmt(marketingCost / months) + ' RON';
  }

  const vBonusPct = document.getElementById('v-bonus-pct');
  if (vBonusPct) {
    if (d.bet > 0) {
      vBonusPct.textContent = 'Bonus cost: ' + fmt((Math.abs(marketingCost) / d.bet) * 100, 2) + '% din bet';
    } else {
      vBonusPct.textContent = 'Bonus cost: 0% din bet';
    }
  }
  
  const vOnlyExp = document.getElementById('v-only-expenses');
  if(vOnlyExp) vOnlyExp.textContent = fmt(d.expenses) + ' RON';
  
  const vExpMonth = document.getElementById('v-expenses-month');
  if(vExpMonth && s && e) {
    const diffDays = Math.max(0, (new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24));
    const days = Math.max(1, diffDays + 1);
    vExpMonth.textContent = 'AVG/zi: ' + fmt(d.expenses / days) + ' RON';
  }
  const vOnlyProf = document.getElementById('v-only-profit');
  if(vOnlyProf) {
    vOnlyProf.textContent = 'Profit Net: ' + fmt(d.net_profit) + ' RON';
    vOnlyProf.style.color = d.net_profit >= 0 ? 'var(--green)' : 'var(--red)';
  }
  document.getElementById('v-games').textContent=fmt(d.games);
  document.getElementById('v-betgame').textContent='Bet/Game: '+fmt(d.avg_bet_game,2);
  document.getElementById('v-ap').textContent=d.aparate;
  document.getElementById('v-ap-day').textContent='Drop/ap/zi: '+fmt(d.avg_in_ap_zi)+' RON';

  
  const renderTrend = (id, curr, prev, daysText) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!prev || prev <= 0) { el.style.display='none'; return; }
    const pct = ((curr - prev) / prev) * 100;
    el.style.display = 'inline-block';
    el.className = 'kpi-trend ' + (pct >= 0 ? 'up' : 'down');
    el.innerHTML = (pct >= 0 ? '↑ ' : '↓ ') + Math.abs(pct).toFixed(1) + `% <span style="font-size:9px; font-weight:500; opacity:0.8; margin-left:4px;">vs ${daysText}</span>`;
    el.title = `Comparativ cu perioada anterioară (fără ziua de azi)`;
  };
  const daysText = isCurrentMonth ? `luna ant. (1-${new Date().getDate()-1})` : 'luna ant.';
  renderTrend('t-in', currExcl?.total_in, comp?.total_in, daysText);
  renderTrend('t-ggr', currExcl?.ggr, comp?.ggr, daysText);

  if (currExcl && comp) {
    const currExclMkt = (currExcl.jackpot || 0) + (currExcl.hh || 0) + (currExcl.cashback || 0);
    const compMkt = (comp.jackpot || 0) + (comp.hh || 0) + (comp.cashback || 0);
    const currExclNgr = (currExcl.ggr || 0) + currExclMkt;
    const compNgr = (comp.ggr || 0) + compMkt;

    renderTrend('t-ngr', currExclNgr, compNgr, daysText);
    renderTrend('t-marketing', currExclMkt, compMkt, daysText);
    renderTrend('t-profit', currExcl.net_profit, comp.net_profit, daysText);
    renderTrend('t-expenses', currExcl.expenses, comp.expenses, daysText);
  }
}

let currentTrendGroup = 'day';
window.setTrendGroup = function(g, btn) {
  document.querySelectorAll('.chart-toggles .settings-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  currentTrendGroup = g;
  const s = document.getElementById('date-start').value;
  const e = document.getElementById('date-end').value;
  loadTrend(s, e);
};

async function loadTrend(s,e){
  const resParam = currentTrendGroup === 'hour' ? '&resolution=hour' : '&resolution=day';
  let data=await api(`/api/trend?start=${s}&end=${e}${locParam()}${resParam}`);
  const todayStr = new Date().toISOString().split('T')[0];
  if (currentTrendGroup !== 'hour') {
    data = data.filter(r => r.luna !== todayStr);
  }

  let groupedData = {};
  data.forEach(r => {
    let key = r.luna; // 'YYYY-MM-DD' or 'YYYY-MM-DD HH:00:00'
    if (currentTrendGroup === 'month') {
      const parts = r.luna.split('-');
      key = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : key;
    } else if (currentTrendGroup === 'year') {
      key = r.luna.split('-')[0];
    }
    if (!groupedData[key]) groupedData[key] = { luna: key, total_in: 0, ggr: 0, hh: 0, bet: 0 };
    groupedData[key].total_in += (+r.total_in || 0);
    groupedData[key].ggr      += (+r.ggr || 0);
    groupedData[key].hh       += (+r.hh || 0);
    groupedData[key].bet      += (+r.bet || 0);
  });
  
  const finalData = Object.values(groupedData).sort((a,b) => a.luna.localeCompare(b.luna));

  const formatLabel = (ds) => {
    if(!ds) return ds;
    if (currentTrendGroup === 'hour') {
      const pts = ds.split(' ');
      if(pts.length === 2) {
        return `${pts[1].substring(0, 5)}`; // Just "14:00"
      }
      return ds;
    }
    const parts = ds.split('-');
    const mo = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
    if(parts.length===3 && currentTrendGroup === 'day') {
      return `${parts[2]} ${mo[parseInt(parts[1],10)-1]}`;
    } else if (parts.length===2 && currentTrendGroup === 'month') {
      return `${mo[parseInt(parts[1],10)-1]} '${parts[0].slice(-2)}`;
    }
    return ds;
  };

  if(trendChart)trendChart.destroy();
  const isMobile = window.innerWidth <= 600;
  trendChart=new Chart(document.getElementById('trend-chart').getContext('2d'),{
    plugins: [window.ChartDataLabels],
    data:{
      labels:finalData.map(r=>formatLabel(r.luna)),
      datasets:[
        {type:'bar',label:'Total IN',data:finalData.map(r=>r.total_in),
          hidden: isMobile,
          backgroundColor:'rgba(99,102,241,.55)',
          hoverBackgroundColor:'rgba(99,102,241,.85)',
          borderColor:'rgba(99,102,241,.8)',
          borderWidth:0,
          borderRadius:4,
          borderSkipped:false,
          yAxisID:'y1',
          datalabels:{
            display: true,
            anchor:'end', align:'end',
            color:'rgba(199,202,255,.9)',
            font:{size:9,weight:'700'},
            formatter: v => v >= 1000000 ? (v/1000000).toFixed(2)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v,
            padding:{bottom:2}
          }},
        {type:'bar',label:'BET',data:finalData.map(r=>r.bet),
          hidden: isMobile,
          backgroundColor:'rgba(245,158,11,.35)',
          hoverBackgroundColor:'rgba(245,158,11,.65)',
          borderWidth:0, borderRadius:3, borderSkipped:false,
          yAxisID:'y3',
          datalabels:{
            display: true, anchor:'start', align:'end',
            color:'rgba(251,191,36,.85)',
            font:{size:8,weight:'600'},
            formatter: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v,
          }},
        {type:'line',label:'GGR',data:finalData.map(r=>r.ggr),
          borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.15)',
          tension:.4,fill:true,pointRadius:0,pointHoverRadius:6,
          borderWidth:2,yAxisID:'y2',
          datalabels:{display:false}},
        {type:'line',label:'HH (Happy Hour)',data:finalData.map(r=>r.hh),
          borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,.15)',
          tension:.4,fill:true,pointRadius:0,pointHoverRadius:6,
          borderWidth:2,yAxisID:'y2',
          datalabels:{display:false}}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{
          labels:{
            color:'#94a3b8',
            font:{size:11},
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8
          }
        },
        datalabels:{
          display: false  // default off; each dataset overrides
        }
      },
      scales:{
        x:{
          ticks:{color:'#64748b', maxRotation: 0, autoSkip: true, maxTicksLimit: 12},
          grid:{color:'rgba(255,255,255,.04)'}
        },
        y1:{position:'left', display: !isMobile,
          ticks:{color:'#6366f1',callback:v=>v>=1000000?(v/1000000).toFixed(1)+'M':(v/1000).toFixed(0)+'k'},
          grid:{color:'rgba(255,255,255,.04)'},
          title:{display:true,text:'Total IN (RON)',color:'#6366f1',font:{size:10}}},
        y2:{position:'right', display: !isMobile,
          ticks:{color:'#10b981',callback:v=>(v/1000).toFixed(0)+'k'},
          grid:{display:false},
          title:{display:true,text:'GGR (RON)',color:'#10b981',font:{size:10}}},
        y3:{position:'right', display:false,
          grid:{display:false}}
      }
    }
  });
}

async function loadLocations(s,e){
  const c = getCompDates(s, e);
  let promises = [api(`/api/locations?start=${s}&end=${e}${locParam()}`)];
  if (c) promises.push(api(`/api/locations?start=${c.cs2}&end=${c.ce2}${locParam()}`));
  if (c) promises.push(api(`/api/locations?start=${s}&end=${c.ce1}${locParam()}`));
  const res = await Promise.all(promises);
  const data = res[0], prevData = c ? res[1] : [], currExclData = c ? res[2] : data;

  let tIn=0,tGgr=0,tJp=0,tHh=0,tCb=0,tGm=0,tMkt=0,tBet=0,tClientiCard=0,tClientiTotal=0,tChelt=0,tPos=0;
  data.forEach(r => tGgr += +r.ggr||0);
  const maxG=Math.max(1,...data.map(r=>Math.abs(parseFloat(r.ggr||0))));
  tableStates.locatii.rows=data.map((r, i)=>{
    tIn+=+r.total_in||0;tJp+=+r.jackpot||0;tHh+=+r.hh||0;
    tCb+=+r.cashback||0;tGm+=+r.games||0;tMkt+=+r.marketing||0;tBet+=+r.bet||0;
    tClientiCard+=+(r.clienti_card||0); tClientiTotal+=+(r.clienti_total||0);
    tChelt+=+(r.cheltuieli||0); tPos+=+(r.pos||0);
    const cc=cellCls(+r.ggr||0,maxG);
    const prev = prevData.find(x => x.id === r.id);
    const currE = currExclData.find(x => x.id === r.id);
    const inB = c ? tBadge(currE?.total_in, prev?.total_in) : '';
    const ggrB = c ? tBadge(currE?.ggr, prev?.ggr) : '';
    
    const betB = c ? tBadge(currE?.bet, prev?.bet) : '';
    return`<tr>
      <td style="text-align:center; color:var(--muted); font-size:11px">${i+1}</td>
      <td style="text-align:center">${r.buc}</td>
      <td><span class="drill-link" onclick="drillTo('location',${r.id},'${(r.locatie||'').replace(/'/g,"\\'")}')">${r.locatie||'—'}</span></td>
      <td class="mobile-show-cell num" style="display:none;">${fmt(r.total_in)}${inB}</td>
      <td class="mobile-hide num" style="font-weight:bold;">${fmt(r.total_in)}${inB}</td>
      <td class="num">${fmt(r.bet)}${betB}</td>
      <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
      <td class="num" style="color:var(--accent); font-weight:bold;">${fmt(r.pos||0)}</td>
      <td class="num" style="color:var(--red)">${fmt(r.cheltuieli||0)}</td>
      <td style="text-align:center">${r.zile}</td>
      <td class="num">${fmt(r.jackpot)}</td><td class="num">${fmt(r.hh)}</td><td class="num">${fmt(r.cashback)}</td><td class="num">${fmt(r.roata||0)}</td><td class="num" style="color:var(--blue)">${fmt(r.raffles||0)}</td>
      <td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td><td class="num">${fmt(r.games)}</td>
    </tr>`;
  });
  renderTablePaginated('locatii');

  let prevTIn=0, prevTGgr=0, currETIn=0, currETGgr=0;
  prevData.forEach(r => { prevTIn += +r.total_in||0; prevTGgr += +r.ggr||0; });
  currExclData.forEach(r => { currETIn += +r.total_in||0; currETGgr += +r.ggr||0; });
  const totalInBadge = c ? tBadge(currETIn, prevTIn) : '';
  const totalGgrBadge = c ? tBadge(currETGgr, prevTGgr) : '';

  const avgHold = tIn > 0 ? (tGgr / tIn) * 100 : 0;
  const avgBonusCost=tBet>0?round2(tMkt/tBet*100):0;
  const totalBuc = data.reduce((sum, r) => sum + (+r.buc||0), 0);
  const tRoata = data.reduce((sum, r) => sum + (+r.roata||0), 0);
  const tRaffles = data.reduce((sum, r) => sum + (+r.raffles||0), 0);
  
  const elCard = document.getElementById('v-clienti-card');
  const elTot = document.getElementById('v-clienti-total');
  if (elCard) elCard.textContent = tClientiCard;
  if (elTot) elTot.textContent = tClientiTotal;
  
  document.getElementById('foot-locatii').innerHTML=`<tr style="font-weight:700">
    <td style="text-align:center; color:var(--muted)">—</td>
    <td style="text-align:center">${totalBuc}</td>
    <td>TOTAL / MEDIE</td>
    <td class="mobile-show-cell num" style="display:none;">${fmt(tIn)}${totalInBadge}</td>
    <td class="mobile-hide num" style="font-weight:bold;">${fmt(tIn)}${totalInBadge}</td>
    <td class="num">${fmt(tBet)}${c ? tBadge(currExclData.reduce((s,x)=>s+(x.bet||0),0), prevData.reduce((s,x)=>s+(x.bet||0),0)) : ''}</td>
    <td class="num">${fmt(tGgr)}${totalGgrBadge}</td>
    <td class="num" style="color:var(--accent); font-weight:bold;">${fmt(tPos)}</td>
    <td class="num" style="color:var(--red)">${fmt(tChelt)}</td>
    <td style="text-align:center">—</td>
    <td class="num">${fmt(tJp)}</td>
    <td class="num">${fmt(tHh)}</td>
    <td class="num">${fmt(tCb)}</td>
    <td class="num">${fmt(tRoata)}</td>
    <td class="num" style="color:var(--blue)">${fmt(tRaffles)}</td>
    <td class="num">${pill(avgHold)}</td>
    <td class="num">${bonusCost(avgBonusCost)}</td>
    <td class="num">${fmt(tGm)}</td>
  </tr>`;

  if(pieChart)pieChart.destroy();
  // Include negative GGR using absolute values, colored distinctly
  const pieData=data.filter(r=>Math.abs(+r.ggr)>0);
  pieChart=new Chart(document.getElementById('loc-pie').getContext('2d'),{
    type:'doughnut',
    data:{
      labels:pieData.map(r=>r.locatie),
      datasets:[{
        data:pieData.map(r=>Math.abs(r.ggr)),
        backgroundColor:pieData.map((r,i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth:0
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{position:'bottom',labels:{color:Chart.defaults.color,font:{size:10},boxWidth:10}},
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 11 },
          formatter: (value, ctx) => {
            let sum = 0;
            let dataArr = ctx.chart.data.datasets[0].data;
            dataArr.map(data => { sum += data; });
            let percentage = (value*100 / sum).toFixed(1)+"%";
            return (value*100 / sum) > 3 ? percentage : null;
          }
        }
      },
      cutout:'65%'
    },
    plugins: [window.ChartDataLabels]
  });
}


async function loadProviders(s,e){
  const c = getCompDates(s, e);
  let promises = [api(`/api/providers?start=${s}&end=${e}${locParam()}`)];
  if (c) promises.push(api(`/api/providers?start=${c.cs2}&end=${c.ce2}${locParam()}`));
  if (c) promises.push(api(`/api/providers?start=${s}&end=${c.ce1}${locParam()}`));
  const res = await Promise.all(promises);
  const data = res[0], prevData = c ? res[1] : [], currExclData = c ? res[2] : data;

  const maxG=Math.max(1,...data.map(r=>+r.ggr||0));
  tableStates.provideri.rows=data.map((r, i)=>{
    const cc=cellCls(+r.ggr||0,maxG);
    const prev = prevData.find(x => x.id === r.id);
    const currE = currExclData.find(x => x.id === r.id);
    const inB = c ? tBadge(currE?.total_in, prev?.total_in) : '';
    const ggrB = c ? tBadge(currE?.ggr, prev?.ggr) : '';
    const betB = c ? tBadge(currE?.bet, prev?.bet) : '';
    return`<tr>
      <td>${i+1}</td>
      <td><span class="drill-link" onclick="drillTo('provider',${r.id},'${(r.provider||'').replace(/'/g,"\\'")}')"><img src="${getProviderLogo(r.provider)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(r.provider||'P')}&background=random&color=fff&rounded=true'" class="prov-logo" alt="icon"> ${r.provider||'—'}</span></td>
      <td>${r.buc}</td><td>${r.zile}</td>
      <td class="mobile-show-cell num" style="display:none;">${fmt(r.total_in)}${inB}</td>
      <td class="mobile-hide num" style="font-weight:bold;">${fmt(r.total_in)}${inB}</td>
      <td class="num">${fmt(r.bet)}${betB}</td>
      <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
      <td class="num">${fmt(r.jackpot)}</td><td class="num">${fmt(r.cashback)}</td><td class="num">${fmt(r.roata||0)}</td><td class="num" style="color:var(--blue)">${fmt(r.raffles||0)}</td>
      <td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td><td class="num">${fmt(r.games)}</td>
    </tr>`;
  });
  renderTablePaginated('provideri');
  const container = document.getElementById('prov-bar-container');
  if(!container) return;
  if(data.length === 0) { container.innerHTML = '<div style="color:var(--muted); font-size:12px; text-align:center; padding-top:20px;">Fără date</div>'; return; }
  
  const absMax = Math.max(...data.map(r => Math.abs(+r.ggr || 0)));
  let html = '<div style="display:flex; flex-direction:column; gap:12px; padding-top:8px;">';
  data.forEach((r, i) => {
    const val = +r.ggr || 0;
    const isNeg = val < 0;
    const wRaw = absMax > 0 ? (Math.abs(val) / absMax) : 0;
    const w = Math.pow(wRaw, 0.35) * 100; // Stronger flattening so differences aren't as jarring
    const finalW = Math.max(8, w); // minimum 8% width
    const color = isNeg ? 'var(--red)' : CHART_COLORS[i % CHART_COLORS.length];
    
    html += `
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width: 100px; display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <img src="${getProviderLogo(r.provider)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(r.provider||'P')}&background=random&color=fff&rounded=true'" style="width:20px; height:20px; border-radius:50%; object-fit:contain; background:var(--surface);">
          <span style="font-size:11px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.provider || 'Necunoscut'}</span>
        </div>
        <div style="flex:1; display:flex; align-items:center; gap:8px;">
          <div style="flex:1; background:var(--surface); height:8px; border-radius:4px; overflow:hidden; display:flex; justify-content:${isNeg ? 'flex-end' : 'flex-start'};">
            <div style="width:${finalW}%; background:${color}; height:100%; border-radius:4px;"></div>
          </div>
          <span style="font-size:11px; font-weight:700; color:${color}; min-width:60px; white-space:nowrap; text-align:${isNeg ? 'left' : 'right'};">${fmtK(val)}</span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

async function loadTypes(s,e){
  const c = getCompDates(s, e);
  let promises = [api(`/api/types?start=${s}&end=${e}${locParam()}`)];
  if (c) promises.push(api(`/api/types?start=${c.cs2}&end=${c.ce2}${locParam()}`));
  if (c) promises.push(api(`/api/types?start=${s}&end=${c.ce1}${locParam()}`));
  const res = await Promise.all(promises);
  const data = res[0], prevData = c ? res[1] : [], currExclData = c ? res[2] : data;

  const maxG=Math.max(1,...data.map(r=>+r.ggr||0));
  tableStates.tipuri.rows=data.map((r, i)=>{
    const cc=cellCls(+r.ggr||0,maxG);
    const prev = prevData.find(x => x.tip_slot === r.tip_slot && x.cabinet === r.cabinet);
    const currE = currExclData.find(x => x.tip_slot === r.tip_slot && x.cabinet === r.cabinet);
    const inB = c ? tBadge(currE?.total_in, prev?.total_in) : '';
    const ggrB = c ? tBadge(currE?.ggr, prev?.ggr) : '';
    const betB = c ? tBadge(currE?.bet, prev?.bet) : '';
    return`<tr>
      <td>${i+1}</td>
      <td><strong>${r.provider||'—'}</strong></td><td>${r.cabinet||'—'}</td><td><img src="/slot_icon.png" class="slot-icon" alt="icon"> ${r.tip_slot||'—'}</td><td>${r.buc}</td>
      <td class="mobile-show-cell num" style="display:none;">${fmt(r.total_in)}${inB}</td>
      <td class="mobile-hide num" style="font-weight:bold;">${fmt(r.total_in)}${inB}</td>
      <td class="num">${fmt(r.bet)}${betB}</td>
      <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
      <td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td><td class="num">${fmt(r.games)}</td>
    </tr>`;
  });
  renderTablePaginated('tipuri');
}

async function loadCabinets(s,e){
  const c = getCompDates(s, e);
  let promises = [api(`/api/cabinets?start=${s}&end=${e}${locParam()}`)];
  if (c) promises.push(api(`/api/cabinets?start=${c.cs2}&end=${c.ce2}${locParam()}`));
  if (c) promises.push(api(`/api/cabinets?start=${s}&end=${c.ce1}${locParam()}`));
  const res = await Promise.all(promises);
  const data = res[0], prevData = c ? res[1] : [], currExclData = c ? res[2] : data;

  const maxG=Math.max(1,...data.map(r=>+r.ggr||0));
  tableStates.cabinete.rows=data.map((r, i)=>{
    const cc=cellCls(+r.ggr||0,maxG);
    const prev = prevData.find(x => x.cabinet === r.cabinet);
    const currE = currExclData.find(x => x.cabinet === r.cabinet);
    const inB = c ? tBadge(currE?.total_in, prev?.total_in) : '';
    const ggrB = c ? tBadge(currE?.ggr, prev?.ggr) : '';
    const betB = c ? tBadge(currE?.bet, prev?.bet) : '';
    return`<tr>
      <td>${i+1}</td>
      <td><strong>${r.provider||'Necunoscut'}</strong></td><td><span class="drill-link" onclick="drillTo('cabinet',0,'${(r.cabinet||'').replace(/'/g,"\\'")}')"><img src="/slot_icon.png" class="slot-icon" alt="icon"> ${r.cabinet||'—'}</span></td>
      <td>${r.buc}</td>
      <td class="mobile-show-cell num" style="display:none;">${fmt(r.total_in)}${inB}</td>
      <td class="mobile-hide num" style="font-weight:bold;">${fmt(r.total_in)}${inB}</td>
      <td class="num">${fmt(r.bet)}${betB}</td>
      <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
      <td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td><td class="num">${fmt(r.games)}</td>
    </tr>`;
  });
  renderTablePaginated('cabinete');
}

async function loadMachines(){
  const{s,e}=getPeriod();
  const gLoc = document.getElementById('global-loc-select');
  const loc = (gLoc && gLoc.value !== 'all') ? gLoc.value : '';
  const prov=document.getElementById('f-prov').value;
  const cab=document.getElementById('f-cab').value;
  const lp=loc?'&location_id='+loc:locParam();
  showLoader(true);
  try{
    const c = getCompDates(s, e);
    let promises = [api(`/api/machines?start=${s}&end=${e}${lp}&provider_id=${prov}&cabinet_id=${cab}`)];
    if (c) promises.push(api(`/api/machines?start=${c.cs2}&end=${c.ce2}${lp}&provider_id=${prov}&cabinet_id=${cab}`));
    if (c) promises.push(api(`/api/machines?start=${s}&end=${c.ce1}${lp}&provider_id=${prov}&cabinet_id=${cab}`));
    const res = await Promise.all(promises);
    const data = res[0], prevData = c ? res[1] : [], currExclData = c ? res[2] : data;

    document.getElementById('machines-count').textContent=data.length+' aparate';
    const maxG=Math.max(1,...data.map(r=>+r.ggr||0));
    tableStates.aparate.rows=data.map((r, i)=>{
      const cc=cellCls(+r.ggr||0,maxG);
      const prev = prevData.find(x => x.serial_nr === r.serial_nr);
      const currE = currExclData.find(x => x.serial_nr === r.serial_nr);
      const inB = c ? tBadge(currE?.total_in, prev?.total_in) : '';
      const ggrB = c ? tBadge(currE?.ggr, prev?.ggr) : '';
      const thumb = gameThumbUrl(r.last_game_name || r.game_name, r.game_id);
      const betB = c ? tBadge(currE?.bet, prev?.bet) : '';
      return`<tr>
        <td>${i+1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="openGameDetails('${(r.last_game_name || r.game_name || '').replace(/'/g,"\\'")}')">
            <img src="${thumb}" referrerpolicy="no-referrer" style="width:24px; height:24px; border-radius:50%; object-fit:cover; background:var(--surface2);" onerror="this.style.display='none'">
            <span>${r.serial_nr||'—'}</span>
          </div>
        </td>
        <td><strong>${r.provider||'—'}</strong></td><td>${r.cabinet||'—'}</td>
        <td><span class="drill-link" onclick="goToMultigame('${(r.mix||'').replace(/'/g,"\\'")}')">${r.mix||'—'}</span></td>
        <td>${r.locatie||'—'}</td><td>${r.zile}</td>
        <td class="mobile-show-cell num" style="display:none;">${fmt(r.total_in)}${inB}</td>
        <td class="mobile-hide num" style="font-weight:bold;">${fmt(r.total_in)}${inB}</td><td class="num">${fmt(r.in_zi)}</td>
        <td class="num">${fmt(r.bet)}${betB}</td>
        <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
        <td class="num">${fmt(r.jackpot)}</td><td class="num">${fmt(r.hh)}</td><td class="num">${fmt(r.cashback)}</td>
        <td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td><td class="num">${fmt(r.games)}</td>
      </tr>`;
    });
    renderTablePaginated('aparate');
  }finally{showLoader(false);}
}

function switchTab(name,btn){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if(btn)btn.classList.add('active');
  // Clear search when switching tabs
  const searchEl = document.getElementById('dash-table-search');
  const countEl  = document.getElementById('dash-search-count');
  if (searchEl) searchEl.value = '';
  if (countEl)  { countEl.style.display = 'none'; countEl.textContent = ''; }
  // Reset any hidden rows
  document.querySelectorAll('.tab-panel tbody tr').forEach(r => r.style.display = '');
}

window.filterDashTables = function() {
  const q = (document.getElementById('dash-table-search')?.value || '').toLowerCase().trim();
  const countEl = document.getElementById('dash-search-count');
  
  const dashKeys = ['locatii', 'provideri', 'tipuri', 'cabinete', 'aparate', 'clienti'];
  let totalVisible = 0;
  
  dashKeys.forEach(key => {
    const st = tableStates[key];
    if (!st) return;
    
    if (!q) {
      st.filteredRows = null;
    } else {
      const temp = document.createElement('div');
      st.filteredRows = st.rows.filter(rStr => {
        temp.innerHTML = rStr;
        return temp.textContent.toLowerCase().includes(q);
      });
      totalVisible += st.filteredRows.length;
    }
    st.page = 1;
    renderTablePaginated(key);
  });

  if (!q) {
    if (countEl) { countEl.style.display = 'none'; countEl.textContent = ''; }
  } else {
    if (countEl) {
      countEl.textContent = totalVisible;
      countEl.style.display = totalVisible > 0 ? 'block' : 'none';
      countEl.style.color = totalVisible === 0 ? 'var(--red)' : 'var(--muted)';
    }
  }
};


function getLocName(id) {
  if (!filtersData || !filtersData.locations) return id;
  const l = filtersData.locations.find(x => String(x.id) === String(id));
  return l ? l.name : id;
}

async function loadDashClienti(s, e) {
  try {
    const res = await api(`/api/reports/clients?start=${s}&end=${e}${locParam()}`);
    if (res.error) throw new Error(res.error);
    const data = res.data || [];
    
    let grouped = {};
    data.forEach(r => {
      const pName = `${r.first_name || ''} ${r.last_name || ''}`;
      if (!grouped[pName]) {
        grouped[pName] = {
           name: pName,
           last_session: r.date_time,
           location_id: r.location_id,
           cabinets: new Set(),
           games: new Set(),
           bet: 0,
           ggr: 0,
           sessions_count: 0
        };
      }
      let g = grouped[pName];
      if (r.date_time > g.last_session) {
         g.last_session = r.date_time;
         g.location_id = r.location_id; 
      }
      if (r.cabinets && r.cabinets !== 'N/A') {
         r.cabinets.split(', ').forEach(c => g.cabinets.add(c));
      }
      if (r.games && r.games !== 'N/A') {
         r.games.split(', ').forEach(gm => g.games.add(gm));
      }
      g.bet += r.bet;
      g.ggr += r.ggr;
      g.sessions_count += 1;
    });

    window._dashClientiRaw = Object.values(grouped);
    if (!window._dashClientiSortField) {
       window._dashClientiSortField = 'sessions_count';
       window._dashClientiSortAsc = false;
    }

    const totalBet = window._dashClientiRaw.reduce((a,b)=>a+b.bet,0);
    const totalGgr = window._dashClientiRaw.reduce((a,b)=>a+b.ggr,0);
    const cGgr = totalGgr >= 0 ? 'var(--green)' : 'var(--red)';
    document.getElementById('foot-clienti').innerHTML = `
      <tr>
        <td colspan="8" style="font-weight:bold; text-align:right;">TOTAL</td>
        <td class="num" style="font-weight:bold;">${fmt(totalBet)}</td>
        <td class="num" style="font-weight:bold; color:${cGgr};">${fmt(totalGgr)}</td>
      </tr>
    `;

    window.renderDashClientiTable();
  } catch(e) {
    console.error('Eroare loadDashClienti', e);
  }
}

window.renderDashClientiTable = function() {
  if (!window._dashClientiRaw) return;
  const data = [...window._dashClientiRaw];
  const field = window._dashClientiSortField;
  const asc = window._dashClientiSortAsc;

  data.sort((a, b) => {
    let va = a[field], vb = b[field];
    if (typeof va === 'string') return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return asc ? va - vb : vb - va;
  });

  tableStates['clienti'].rows = data.map((r, i) => {
    const ggrColor = r.ggr >= 0 ? 'var(--green)' : 'var(--red)';
    const cabs = r.cabinets.size > 0 ? Array.from(r.cabinets).join(', ') : '-';
    const gams = r.games.size > 0 ? Array.from(r.games).join(', ') : '-';
    return `<tr>
      <td>${i+1}</td><td style="font-weight:600; color:var(--text);">${r.name}</td>
      <td class="num" style="font-weight:600; color:var(--blue);">${r.sessions_count}</td>
      <td><span style="background:var(--surface2); padding:2px 6px; border-radius:4px; font-size:10px;">${r.last_session}</span></td>
      <td style="color:var(--muted);">${getLocName(r.location_id)}</td>
      <td style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${cabs}">${cabs}</td>
      <td style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${gams}">${gams}</td>
      <td class="num">${fmt(r.bet)}</td>
      <td class="num" style="color:${ggrColor}; font-weight:700;">${fmt(r.ggr)}</td>
    </tr>`;
  });

  renderTablePaginated('clienti');

  document.querySelectorAll('#tab-clienti thead th').forEach(th => {
    th.textContent = th.textContent.replace(' ▲','').replace(' ▼','');
  });
  const h = document.getElementById('th-clienti-' + field);
  if (h) h.textContent += asc ? ' ▲' : ' ▼';
};

window.sortDashClienti = function(field) {
  if (window._dashClientiSortField === field) window._dashClientiSortAsc = !window._dashClientiSortAsc;
  else { window._dashClientiSortField = field; window._dashClientiSortAsc = false; }
  window.renderDashClientiTable();
};

async function loadAll(){
  const hash = window.location.hash || '#dashboard';
  if (hash !== '#dashboard' && hash !== '' && hash !== '#') return;
  const{s,e}=getPeriod();
  if(!s||!e){ return; }
  showLoader(true);
  try{
    // loadDashClienti(s,e); // DISABLED: Postgres query takes 1-2 mins and blocks the Flask server, freezing the UI.
    await Promise.allSettled([loadKPI(s,e),loadTrend(s,e),loadLocations(s,e),loadProviders(s,e),loadTypes(s,e),loadCabinets(s,e),loadCalendars(s,e),loadMachines()]);
    if (typeof filterDashTables === 'function') filterDashTables();
    if (document.getElementById('view-rapoarte') && document.getElementById('view-rapoarte').classList.contains('active')) {
      const hh  = document.getElementById('rep-page-hh');
      const mg  = document.getElementById('rep-page-multigame');
      const cl  = document.getElementById('rep-page-clienti');
      const mkt = document.getElementById('rep-page-marketing');
      const co  = document.getElementById('rep-page-cashout');
      if (hh  && hh.style.display !== 'none' && hh.style.display !== '')  loadHhReport();
      else if (mg  && mg.style.display  !== 'none' && mg.style.display  !== '') loadMultigame();
      else if (cl  && cl.style.display  !== 'none' && cl.style.display  !== '') loadClientiReport();
      else if (mkt && mkt.style.display !== 'none' && mkt.style.display !== '') loadMarketingReport();
      else if (co  && co.style.display  !== 'none' && co.style.display  !== '') loadCashoutReport();
      else loadHourlyReport();
    }
    if (document.getElementById('view-live')?.classList.contains('active')) {
      loadLive();
    }
    if (document.getElementById('view-cheltuieli')?.classList.contains('active')) {
      loadExpensesReport();
    }
  }
  catch(err){console.error('loadAll error:', err);}
  finally{ 
    showLoader(false); 
  }
}

async function loadDashboardLiveCard() {
  const container = document.getElementById('v-live-players');
  const cashoutsContainer = document.getElementById('v-latest-cashouts');
  if (!container && !cashoutsContainer) return;
  try {
    const data = await api('/api/live?active_only=true');
    const top = data.top_machines || [];
    const active_count = data.active_slots || 0;

    // --- Sloturi Live ---
    if (container) {
      const titleEl = document.getElementById('dash-live-title');
      if (titleEl) {
        titleEl.innerHTML = `<span style="width:8px; height:8px; border-radius:50%; background:#6366f1; animation:pulse 2s infinite; display:inline-block;"></span> Sloturi Live: <span style="color:var(--text); font-weight:800; margin-left:4px;">${active_count}</span>`;
      }
      if (top.length === 0) {
        container.innerHTML = '<div style="color:var(--muted); text-align:center; padding-top:20px;">Niciun aparat activ cu credit.</div>';
      } else {
        let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
        for (let i = 0; i < top.length; i++) {
          const p = top[i];
          const n = (p.player_name || 'Necunoscut').trim();
          const c = p.credite_ron || 0;
          const bet = p.bet_ron || 0;
          const est_in_str = (p.est_in !== undefined) ? fmt(p.est_in) : '—';
          const thumbUrl = gameThumbUrl(p.joc_activ, p.game_id);
          
          const pInitials = n.split(' ').filter(Boolean).map(x => x[0]).join('').substring(0, 2).toUpperCase() || 'P';
          const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#d946ef'];
          const bg = colors[(p.player_id_live || 0) % colors.length];
          
          html += `
            <div style="border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:8px; cursor:pointer; display:flex; align-items:center; gap:12px;" onclick="openPlayerDetails(${p.player_id_live||''})">
              <div style="width:40px; height:40px; border-radius:50%; background:${bg}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; flex-shrink:0; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.2);">
                ${pInitials}
              </div>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                  <strong style="font-size:12px; color:var(--accent); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${i+1}. ${n}</strong>
                  <strong style="color:${c < 0 ? 'var(--danger)' : 'var(--blue)'}; font-size:12px; white-space:nowrap;">${fmt(c)} <span style="font-size:9px">RON</span></strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px; font-size:10px;">
                  <span style="color:var(--muted);">${p.locatie} &bull; Bet: <span style="color:var(--orange)">${fmt(bet)}</span></span>
                  <span style="color:#10b981; font-weight:700;">Est. IN: ${est_in_str}</span>
                </div>
                <div style="font-size:10px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px;">
                  <strong style="color:var(--text);">#${p.pozitie || p.machine_id || '—'}</strong> (SN: ${p.serial_nr || '—'}) &bull; <img src="${thumbUrl}" style="width:16px; height:16px; border-radius:4px; object-fit:cover; display:inline-block; vertical-align:middle; background:var(--surface2);" onerror="this.style.display='none'"> <span style="cursor:pointer; color:var(--text); text-decoration:underline; text-decoration-style:dotted;" onclick="event.stopPropagation(); openGameDetails('${(cleanGameName(p.joc_activ)||'').replace(/'/g,"\\'")}', '${p.game_id||''}')">${cleanGameName(p.joc_activ) || 'Necunoscut'}</span>
                </div>
              </div>
            </div>
          `;
        }
        html += '</div>';
        container.innerHTML = html;
      }
    }

    // --- Ultimele Cashout-uri ---
    if (cashoutsContainer) {
      window._latestCashoutsData = data.latest_cashouts || [];
      window._maxCashoutsData = [...(data.latest_cashouts || [])].sort((a,b) => Math.max(b.cashout_ron||0, b.jackpot_ron||0, b.hh_ron||0) - Math.max(a.cashout_ron||0, a.jackpot_ron||0, a.hh_ron||0));
      window._handpayCashoutsData = [...(data.latest_cashouts || [])].filter(c => (c.hh_ron || 0) > 0);
      window._currentCashoutTab = window._currentCashoutTab || 'ultimele';
      renderCashoutsList();
    }
  } catch(e) { if(container) container.innerHTML = `<div style="color:red;padding:10px">ERROR: ${e.toString()}</div>`; console.error('loadDashboardLiveCard error:', e); }
}

window.changeLocDetailLimit = function() {
  const limit = document.getElementById('ld-top-limit').value;
  localStorage.setItem('locDetailTopLimit', limit);
  renderLocDetailMachines();
}

window.switchCashoutTab = function(tab) {
  window._currentCashoutTab = tab;
  ['ultimele', 'mari', 'handpay'].forEach(t => {
    const el = document.getElementById('btn-cashout-' + t);
    if (!el) return;
    el.style.background = tab === t ? 'var(--surface)' : 'transparent';
    el.style.color = tab === t ? 'var(--text)' : 'var(--muted)';
    el.style.boxShadow = tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
  });
  renderCashoutsList();
}

window.renderCashoutsList = function() {
  const container = document.getElementById('v-latest-cashouts');
  if (!container) return;
  const tab = window._currentCashoutTab || 'ultimele';
  let cashouts = [];
  if (tab === 'ultimele') cashouts = window._latestCashoutsData || [];
  else if (tab === 'mari') cashouts = window._maxCashoutsData || [];
  else if (tab === 'handpay') cashouts = window._handpayCashoutsData || [];
  
  if (cashouts.length === 0) {
    container.innerHTML = '<div style="color:var(--muted); text-align:center; padding-top:20px;">Nu există date recente.</div>';
    return;
  }
  
  let chHtm = '<div style="display:flex; flex-direction:column; gap:8px;">';
  for (let i = 0; i < cashouts.length; i++) {
    const c = cashouts[i];
    const d = (c.cashout_time||'').substring(5,16).replace('-', '.');
    const t = (c.cashout_time||'').substring(11,16);
    const hh = c.hh_ron||0, jp = c.jackpot_ron||0, out = c.cashout_ron||0;
    let tip = 'Cashout'; if (jp>0) tip='Jackpot'; if (hh>0) tip='Handpay';
    const tipColor = jp>0 ? '#eab308' : hh>0 ? '#ec4899' : '#94a3b8';
    const mixInfo = [c.mix, c.cabinet, c.joc].filter(Boolean).join(' · ');
    chHtm += `
      <div style="border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
          <strong style="font-size:12px; color:var(--accent); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.locatie || '—'}</strong>
          <strong style="color:var(--red); font-size:12px; white-space:nowrap;">${fmt(Math.max(out, jp, hh))} <span style="font-size:9px">RON</span></strong>
        </div>
        ${mixInfo ? `<div style="font-size:10px;color:var(--text);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${mixInfo}</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:var(--muted);">
          <span>#${c.machine_id || c.serial_nr} • ${d}</span>
          <span style="color:${tipColor};font-weight:700">${tip} ${t}</span>
        </div>
      </div>
    `;
  }
  chHtm += '</div>';
  container.innerHTML = chHtm;
}


// ─── Init ─────────────────────────────────────────────────────────────────────
setTimeout(async () => {
  await checkAuth();
  if (!currentUser) {
    if (window.location.hash.startsWith('#invite/')) {
      window.dispatchEvent(new Event('hashchange'));
    }
    return; // Stop init if not logged in
  }
  await loadBNR();
  await loadFilters();
  
  const savedP = localStorage.getItem('cp2_preset');
  const savedS = localStorage.getItem('cp2_start');
  const savedE = localStorage.getItem('cp2_end');
  
  if (savedP) {
    applyPreset(savedP);
  } else if (savedS && savedE) {
    document.getElementById('native-date-start').value = savedS;
    document.getElementById('native-date-end').value = savedE;
    document.getElementById('date-start').value = savedS;
    document.getElementById('date-end').value = savedE;
    document.getElementById('tl-range-display').textContent = `${savedS} ➔ ${savedE}`;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  } else {
    applyPreset('month');
  }
  // dispatch AFTER filters+period are ready so hash-specific loaders have data
  window.dispatchEvent(new Event('hashchange'));
}, 0);

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = savedTheme === 'light' ? '#64748b' : '#94a3b8';
  Chart.defaults.borderColor = savedTheme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.06)';
}

window.toggleTheme = function() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = next === 'light' ? '#64748b' : '#94a3b8';
    Chart.defaults.borderColor = next === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.06)';
  }
  
  if (localStorage.getItem('cp2_token')) {
    apiAuth('/api/me/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next })
    }).catch(e => console.error('Failed to save theme', e));
  }
  if(trendChart) trendChart.update();
  if(barChart) barChart.update();
  if(pieChart) pieChart.update();
};
document.getElementById('theme-toggle').addEventListener('click', window.toggleTheme);

// ─── Views & Reports ──────────────────────────────────────────────────────
window.addEventListener('hashchange', () => {
  if (window.innerWidth > 1024) {
    const sb = document.querySelector('.sidebar');
    if(sb) sb.classList.remove('collapsed');
  } else {
    const sb = document.querySelector('.sidebar');
    if(sb) sb.classList.add('collapsed');
    const overlay = document.getElementById('sidebar-overlay');
    if(overlay) overlay.style.display = 'none';
  }

  const fullHash = window.location.hash;
  const rawHash = (fullHash.split('?')[0]).replace('#', '') || 'dashboard';
  const parts = rawHash.split('/');
  const mainHash = parts[0];
  const subHash = parts[1];
  console.log("DEBUG Hash:", fullHash, "main:", mainHash, "sub:", subHash);
  
  if (mainHash === 'invite') {
    handleInviteHash(subHash);
    return;
  }
  
  if (mainHash === 'locatie') {
    const kpiSection = document.getElementById('kpi-section');
    if (kpiSection) kpiSection.style.display = 'none';
    
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('view-loc-detail').classList.add('active');
    
    // Extract name from query params if possible
    const searchParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const locName = searchParams.get('name') || 'Locație';
    loadLocationDetails(subHash, locName);
    return;
  }
  
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar .nav-item').forEach(i => i.classList.remove('active'));
  
  const kpiSection = document.getElementById('kpi-section');
  const timelineSection = document.querySelector('.timeline-section');
  const headerFilters = document.querySelector('.header-filters');
  
  if (mainHash === 'live' || (mainHash === 'rapoarte' && subHash === 'retentie') || mainHash === 'admin' || mainHash === 'pos' || mainHash === 'floorplan' || mainHash === 'admin-floorplan') {
    if (kpiSection) kpiSection.style.display = 'none';
    if (timelineSection && mainHash === 'admin-floorplan') timelineSection.style.display = 'none';
    else if (timelineSection) timelineSection.style.display = 'flex';
    if (headerFilters && mainHash === 'admin-floorplan') headerFilters.style.display = 'none';
    else if (headerFilters) headerFilters.style.display = 'flex';
  } else {
    if (kpiSection) kpiSection.style.display = 'grid';
    if (timelineSection) timelineSection.style.display = 'flex';
    if (headerFilters) headerFilters.style.display = 'flex';
  }

  // Exceptii specifice pentru afisare header:
  if (mainHash === 'contracte' || mainHash === 'onjn') {
    if (kpiSection) kpiSection.style.display = 'none'; // hide general KPIs
    if (timelineSection) timelineSection.style.display = 'none'; // hide date picker
    if (headerFilters) headerFilters.style.display = 'none'; // hide top location/type filters
  }

  const targetView = document.getElementById('view-' + mainHash);
  if(targetView) targetView.classList.add('active');

  if (mainHash === 'floorplan') {
    initGlobalFloorplan();
  }
  if (mainHash === 'admin-floorplan') {
    initAdminFloorplan();
  }
  
  const targetBtn = document.querySelector(`.sidebar .nav-item[href="#${mainHash}"]`) || document.querySelector('.sidebar .nav-item');
  if(targetBtn) targetBtn.classList.add('active');
  
  if (mainHash === 'contracte') {
    if (typeof window.loadContracts === 'function') {
      window.loadContracts();
    }
  }
  if (mainHash === 'onjn') {
    if (typeof window.initOnjnApp === 'function') {
      window.initOnjnApp();
    }
  }

  // Hide period selector on Live and Admin-Floorplan
  const tlSection = document.querySelector('.timeline-section');
  if(tlSection) {
    if (mainHash === 'live' || mainHash === 'admin-floorplan' || mainHash === 'contracte' || mainHash === 'onjn') {
      tlSection.style.display = 'none';
    } else {
      tlSection.style.display = 'flex';
    }
  }

  if(mainHash === 'cheltuieli' || mainHash === 'pl') {
    // Hide KPI cards that are irrelevant for expenses/PL page
    ['kpi-in', 'kpi-jp', 'kpi-games', 'kpi-aparate'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });
    // Show the requested ones explicitly
    ['kpi-ggr', 'kpi-ngr', 'kpi-profit', 'kpi-total-expenses', 'kpi-marketing'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'block';
    });
    
    // Arrange cards nicely across the row
    const globalKpiGrid = document.querySelector('.kpi-grid');
    if (globalKpiGrid) globalKpiGrid.style.gridTemplateColumns = '';
    
    loadExpensesReport();
    const btnExpSettings = document.getElementById('btn-exp-settings');
    if (btnExpSettings) btnExpSettings.style.display = (currentUser && currentUser.role === 'Super Admin') ? 'inline-flex' : 'none';
  } else if (mainHash === 'contracte' || mainHash === 'onjn') {
    // Hide ALL global KPIs for contracte/onjn, because they have their own inline KPIs
    ['kpi-in', 'kpi-ggr', 'kpi-profit', 'kpi-total-expenses', 'kpi-marketing', 'kpi-games', 'kpi-aparate', 'kpi-jp'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });
  } else {
    // Show them back on other pages
    ['kpi-in', 'kpi-ggr', 'kpi-profit', 'kpi-games', 'kpi-aparate'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'block';
    });
    const expKpi = document.getElementById('kpi-total-expenses');
    if(expKpi) expKpi.style.display = 'none';
    const mktKpi = document.getElementById('kpi-marketing');
    if(mktKpi) mktKpi.style.display = 'none';
    
    // Restore label
    const inCard = document.getElementById('kpi-in');
    if (inCard) {
      const lbl = inCard.querySelector('.kpi-label');
      if (lbl) lbl.textContent = 'Total IN';
    }
  }

  if(mainHash === 'pl') {
    loadPLData();
  }

  if(mainHash === 'rapoarte') {
    document.getElementById('subnav-rapoarte').style.display = 'block';
    if(window.innerWidth > 1024) {
      const sb = document.querySelector('.sidebar');
      if(sb) sb.classList.remove('collapsed');
    }
    
    if (subHash) {
      const subLink = document.querySelector(`.subnav-group .nav-item[href="#rapoarte/${subHash}"]`);
      if (subLink) {
        document.querySelectorAll('.subnav-group .nav-item').forEach(b => b.classList.remove('active'));
        subLink.classList.add('active');
      }
      
      document.querySelectorAll('.rep-page').forEach(p => p.style.display = 'none');
      const repTarget = document.getElementById('rep-page-' + subHash);
      if (repTarget) repTarget.style.display = 'block';
      
      const kpiJp    = document.getElementById('kpi-jp');
      const kpiExp   = document.getElementById('kpi-total-expenses');
      const kpiGames = document.getElementById('kpi-games');
      const kpiAp    = document.getElementById('kpi-aparate');
      
      const kpiGrid = document.querySelector('.kpi-grid');
      if (subHash === 'cheltuieli') {
        if(kpiJp)    kpiJp.style.display    = 'none';
        if(kpiGames) kpiGames.style.display = 'none';
        if(kpiAp)    kpiAp.style.display    = 'none';
        if(kpiExp)   kpiExp.style.display   = 'block';
        if(kpiGrid)  kpiGrid.style.gridTemplateColumns = 'repeat(4,1fr)';
      } else {
        if(kpiJp)    kpiJp.style.display    = 'none';
        if(kpiGames) kpiGames.style.display = 'block';
        if(kpiAp)    kpiAp.style.display    = 'block';
        if(kpiExp)   kpiExp.style.display   = 'none';
        if(kpiGrid)  kpiGrid.style.gridTemplateColumns = '';
      }

      if (subHash === 'ore') loadHourlyReport();
      else if (subHash === 'hh') loadHhReport();
      else if (subHash === 'marketing') loadMarketingReport();
      else if (subHash === 'clienti') {
        if (parts[2]) {
          _renderPlayerDetails(parts[2]);
        } else {
          if(window.closePlayerDashboard_UI) window.closePlayerDashboard_UI();
          loadClientiReport();
        }
      }
      else if (subHash === 'multigame') {
        if (parts[2] === 'game' && parts[3]) {
          _renderGameDetails(decodeURIComponent(parts[3]));
        } else {
          const gdView = document.getElementById('view-game-details');
          if(gdView) gdView.style.display = 'none';
          const mgPage = document.getElementById('rep-page-multigame');
          if(mgPage) mgPage.style.display = 'block';
          window.loadMultigameReport ? loadMultigameReport() : loadMultigame(); 
        }
      }
      else if (subHash === 'cashout') loadRapoarteCashout();
      else if (subHash === 'cheltuieli') {
        const {s: cs, e: ce} = getPeriod();
        if (cs && ce) loadKPI(cs, ce).catch(console.error);
        loadExpensesReport();
        const btnExpSettings = document.getElementById('btn-exp-settings');
        if (btnExpSettings) btnExpSettings.style.display = (currentUser && currentUser.role === 'Super Admin') ? 'inline-flex' : 'none';
      } else if (subHash === 'retentie') {
        loadRetentionReport();
      } else if (subHash === 'lunare') {
        loadLunareReport();
      }
    } else {
      // No subhash: show landing
      document.querySelectorAll('.rep-page').forEach(p => p.style.display = 'none');
      const landing = document.getElementById('rep-landing');
      if (landing) landing.style.display = 'block';
    }
  } else {
    const subnav = document.getElementById('subnav-rapoarte');
    if (subnav) subnav.style.display = 'none';
  }
  
  if(mainHash === 'analiza') {
    if (typeof window.loadAnaliza === 'function') {
      window.loadAnaliza(subHash || 'landing');
    }
  } else {
    const subnavAnaliza = document.getElementById('subnav-analiza');
    if (subnavAnaliza) subnavAnaliza.style.display = 'none';
  }
  
  if(mainHash === 'analize') {
    document.getElementById('subnav-rapoarte').style.display = 'none';
    const anView = document.getElementById('view-day-analysis');
    if(anView) anView.classList.add('active');
    loadAnalize();
  }
  if(mainHash === 'admin') {
    if (!subHash) {
      window.location.hash = '#admin/utilizatori';
      return;
    }
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    const adminView = document.getElementById('view-admin-' + subHash);
    if(adminView) adminView.classList.add('active');
    if(subHash === 'utilizatori') loadAdminUtilizatori();
    if(subHash === 'sloturi') loadAdminSloturi();
  }
  if(mainHash === 'live') loadLive();
  if(mainHash === 'dashboard') loadAll();
  if(mainHash === 'pos') { showLoader(false); loadPosReport(); }

  // Show/Hide kpi-profit (Expenses & Net Profit) based on context
  const kpiProfit = document.getElementById('kpi-profit');
  const globalKpiGrid = document.querySelector('.kpi-grid');
  if (mainHash === 'dashboard' || mainHash === 'cheltuieli' || mainHash === 'pl' || (mainHash === 'rapoarte' && subHash === 'cheltuieli')) {
    if (kpiProfit) kpiProfit.style.display = 'block';
    if (globalKpiGrid) {
      if (window.innerWidth > 1200) {
        globalKpiGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
      } else {
        globalKpiGrid.style.gridTemplateColumns = '';
      }
    }
  } else {
    if (kpiProfit) kpiProfit.style.display = 'none';
    if (globalKpiGrid) {
      if (window.innerWidth > 1200) {
        globalKpiGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
      } else {
        globalKpiGrid.style.gridTemplateColumns = '';
      }
    }
  }
});

let hourlyTrendChart = null;
let hourlyLocChart = null;

window.loadHourlyReport = async function() {
  const { s, e } = getPeriod();
  const locEl = document.getElementById('global-loc-select');
  const locId = locEl ? locEl.value : 'all';
  const provId = document.getElementById('rep-prov-select').value;
  
  let p = `start=${s}&end=${e}`;
  if(locId !== 'all') p += `&loc_ids=${locId}`;
  else p += locParam();
  
  if(provId !== 'all') p += `&prov_id=${provId}`;

  showLoader(true);
  try {
    const data = await api(`/api/reports/hourly?${p}`);
    
    let hourlyMap = {};
    let locMap = {};
    
    data.forEach(r => {
      const h = r.dt.split(' ')[1]?.substring(0, 5) || r.dt;
      if (!hourlyMap[h]) hourlyMap[h] = { tIn: 0, tGgr: 0 };
      hourlyMap[h].tIn += (+r.in || 0);
      hourlyMap[h].tGgr += (+r.ggr || 0);
      if (!locMap[r.locatie]) locMap[r.locatie] = 0;
      locMap[r.locatie] += (+r.ggr || 0);
    });
    
    const hours = Object.keys(hourlyMap).sort((a, b) => {
      const h1 = parseInt(a.split(':')[0], 10);
      const h2 = parseInt(b.split(':')[0], 10);
      const w1 = h1 >= 8 ? h1 - 8 : h1 + 16;
      const w2 = h2 >= 8 ? h2 - 8 : h2 + 16;
      return w1 - w2;
    });
    const tInArr = hours.map(h => hourlyMap[h].tIn);
    const tGgrArr = hours.map(h => hourlyMap[h].tGgr);
    
    if (hourlyTrendChart) hourlyTrendChart.destroy();
    hourlyTrendChart = new Chart(document.getElementById('hourly-trend-chart').getContext('2d'), {
      data: {
        labels: hours,
        datasets: [
          { type: 'line', label: 'Total IN', data: tInArr, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.1)', tension: 0.4, fill: true, borderWidth: 3, pointRadius: 0, pointHoverRadius: 6, yAxisID: 'y1' },
          { type: 'line', label: 'GGR', data: tGgrArr, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', tension: 0.4, fill: true, borderWidth: 3, pointRadius: 0, pointHoverRadius: 6, yAxisID: 'y2' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { 
          legend: { 
            labels: { 
              color: '#94a3b8',
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8
            } 
          } 
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
          y1: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#6366f1' } },
          y2: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#10b981' } }
        }
      }
    });
    
    const sortedLocs = Object.entries(locMap).sort((a, b) => b[1] - a[1]);
    if (hourlyLocChart) hourlyLocChart.destroy();
    hourlyLocChart = new Chart(document.getElementById('hourly-loc-chart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: sortedLocs.map(x => x[0]),
        datasets: [{
          data: sortedLocs.map(x => Math.abs(x[1])),
          backgroundColor: sortedLocs.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderWidth: 0, hoverOffset: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '75%',
        plugins: { legend: { position: 'right', labels: { color: '#94a3b8', boxWidth: 12, padding: 16 } } }
      }
    });
    tableStates['rep-hourly'].rows = data.map((r, i) => {
      const ggrCls = +r.ggr < 0 ? 'cell-neg-1' : '';
      return `<tr>
        <td>${i+1}</td>
        <td style="white-space:nowrap;font-weight:500">${r.dt}</td>
        <td>${r.locatie}</td>
        <td>${r.serial_nr}</td>
        <td>${r.provider}</td>
        <td class="num">${fmt(r.in)}</td>
        <td class="num">${fmt(r.out)}</td>
        <td class="num ${ggrCls}">${fmt(r.ggr)}</td>
        <td class="num">${fmt(r.games)}</td>
        <td class="num">${fmt(r.bet)}</td>
      </tr>`;
    });
    renderTablePaginated('rep-hourly');
  } catch(err) {
    console.error('loadHourlyReport error:', err);
    if(hourlyTrendChart) { hourlyTrendChart.destroy(); hourlyTrendChart = null; }
    if(hourlyLocChart) { hourlyLocChart.destroy(); hourlyLocChart = null; }
    tableStates['rep-hourly'].rows = [`<tr><td colspan="10" style="padding:40px;text-align:center;">
        <div style="color:var(--red);font-weight:700;margin-bottom:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Eroare la incarcare
        </div>
        <div style="color:var(--muted);font-size:11px;margin-bottom:12px">${err.message}</div>
        <div style="color:var(--muted);font-size:10px">
          Perioadele lungi (ex: Luna curenta) pot fi lente.<br>
          Incerca <strong>Azi</strong> sau <strong>7 zile</strong> pentru rezultate rapide.
        </div>
      </td></tr>`];
    renderTablePaginated('rep-hourly');
  } finally {
    showLoader(false);
  }
};

window.switchRepTab = function(name, btn) {
  window.location.hash = 'rapoarte/' + name;
};

window.switchRepPage = function(name, el) {
  window.location.hash = 'rapoarte/' + name;
};

let hhEvoChart = null;
let hhScatterChart = null;

window.loadHhReport = async function() {
  const { s, e } = getPeriod();
  const locEl = document.getElementById('global-loc-select');
  const locId = locEl ? locEl.value : 'all';
  let p = `start=${s}&end=${e}`;
  if(locId !== 'all') p += `&loc_ids=${locId}`;
  else p += locParam();

  showLoader(true);
  try {
    const [data, hhHistData, advData, playersData, locData] = await Promise.all([
      api(`/api/daily?${p}`),
      api(`/api/hh_history?${p}`),
      api(`/api/hh_advanced?${p}`),
      api(`/api/hh_players?${p}`),
      api(`/api/locations?${p}`)
    ]);
    
    // Render Advanced HH logic if available
    if (advData) {
      const locKey = locId === 'all' ? Object.keys(advData)[0] : locId;
      const st = locKey && advData[locKey] ? advData[locKey] : null;
      
      const volBody = document.getElementById('hh-vol-body');
      const depBody = document.getElementById('hh-dep-body');
      const insightBox = document.getElementById('hh-smart-insight');
      
      if (st) {
        if (insightBox) {
            insightBox.style.display = 'block';
            insightBox.innerHTML = st.insight;
            if (st.alerta === 'ROSU') {
                insightBox.style.borderColor = 'var(--danger)';
                insightBox.style.color = 'var(--danger)';
                insightBox.style.backgroundColor = 'rgba(239,68,68,0.1)';
            } else if (st.alerta === 'PORTOCALIU') {
                insightBox.style.borderColor = 'var(--warning)';
                insightBox.style.color = 'var(--warning)';
                insightBox.style.backgroundColor = 'rgba(245,158,11,0.1)';
            } else {
                insightBox.style.borderColor = 'var(--success)';
                insightBox.style.color = 'var(--success)';
                insightBox.style.backgroundColor = 'rgba(34,197,94,0.1)';
            }
        }
        
        let deltaIn = st.in_med_no > 0 ? ((st.in_med_hh / st.in_med_no) - 1) * 100 : 0;
        let deltaGgr = st.ggr_med_no > 0 ? ((st.ggr_med_hh / st.ggr_med_no) - 1) * 100 : 0;
        
        if (volBody) {
            volBody.innerHTML = `
              <tr>
                <td>IN Mediu / Oră</td>
                <td class="num" style="font-weight:800;color:var(--accent)">${fmt(st.in_med_hh)}</td>
                <td class="num">${fmt(st.in_med_no)}</td>
                <td class="num" style="color:${deltaIn>0?'var(--success)':'var(--danger)'}">
                    ${deltaIn>0?'+':''}${deltaIn.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td>GGR Mediu / Oră</td>
                <td class="num">${fmt(st.ggr_med_hh)}</td>
                <td class="num">${fmt(st.ggr_med_no)}</td>
                <td class="num" style="color:${deltaGgr>0?'var(--success)':'var(--danger)'}">
                    ${deltaGgr>0?'+':''}${deltaGgr.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td>Cost HH / Oră HH</td>
                <td class="num" style="color:var(--danger)">${st.ore_hh_count>0 ? fmt(st.cost_total/st.ore_hh_count) : 0}</td>
                <td class="num">-</td>
                <td class="num">-</td>
              </tr>
            `;
        }
        
        if (depBody) {
            if (st.dependente && st.dependente.length > 0) {
                depBody.innerHTML = st.dependente.map(d => `
                  <tr>
                    <td style="text-align:left;">
                      <div style="font-weight:700;color:var(--text)">${d.name.split(' (')[0]}</div>
                      <div style="font-size:10px;color:var(--muted)">${d.name.split(' (')[1].replace(')','')}</div>
                    </td>
                    <td class="num" style="color:var(--danger); font-weight:800;">${d.pct_in_hh.toFixed(1)}%</td>
                    <td class="num">${fmtK(d.in_total)}k</td>
                  </tr>
                `).join('');
            } else {
                depBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:24px;">Niciun aparat nu este dependent critic (>60% IN in HH)</td></tr>`;
            }
        }
      } else {
        if (volBody) volBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--muted);">Nu există date HH avansate pentru această selecție.</td></tr>';
        if (depBody) depBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:24px; color:var(--muted);">Niciun aparat nu este dependent în această perioadă.</td></tr>';
        if (insightBox) insightBox.style.display = 'none';
      }
    }
    
    // Render HH Players
    if (!tableStates['hh-players']) tableStates['hh-players'] = { page: 1, limit: 10, rows: [] };
    const playersBody = document.getElementById('body-hh-players');
    if (playersBody) {
      if (playersData && playersData.length > 0) {
        tableStates['hh-players'].rows = playersData.map((p, i) => {
          const pInitials = ((p.first_name || '') + ' ' + (p.last_name || '')).split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P';
          const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#d946ef'];
          const bg = colors[p.id % colors.length];
          return `
          <tr style="border-bottom:1px solid var(--border)" onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
            <td style="font-weight:700; color:var(--muted); padding-left:16px; width:40px;">${i + 1}</td>
            <td style="text-align:left;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:32px; height:32px; border-radius:50%; background:${bg}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px; flex-shrink:0; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.2);">
                  ${pInitials}
                </div>
                <div>
                  <div style="font-weight:700;color:var(--text)">${p.first_name || 'N/A'} ${p.last_name || ''}</div>
                  <div style="font-size:10px;color:var(--muted)">ID: ${p.id} &bull; ${p.locatie || '—'}</div>
                </div>
              </div>
            </td>
            <td>${p.phone || '—'}</td>
            <td class="num" style="font-weight:800; color:var(--accent);">${p.sessions_in_hh}</td>
            <td style="text-align:center;">
              ${p.exclusiv_hh ? '<span style="background:rgba(16,185,129,0.15);color:var(--green);padding:4px 8px;border-radius:4px;font-size:10px;font-weight:700;">DA</span>' : '<span style="background:rgba(239,68,68,0.15);color:var(--danger);padding:4px 8px;border-radius:4px;font-size:10px;font-weight:700;">NU (' + p.sessions_outside_hh + ' normale)</span>'}
            </td>
            <td class="num">${p.last_hh_session ? p.last_hh_session.substring(0, 16) : '—'}</td>
          </tr>
        `;
        });
      } else {
        tableStates['hh-players'].rows = ['<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--muted);">Nu au fost găsiți jucători activi în orele de HH.</td></tr>'];
      }
      renderTablePaginated('hh-players');
    }
    
    let totalZile = data.length;
    let zileHH = 0, inHH = 0, inNoHH = 0;
    let scatterData = [];

    data.forEach(r => {
      const ggr = r.ggr || 0;
      const hh = r.hh || 0;
      const tin = r.total_in || 0;
      
      if (hh > 0) {
        zileHH++;
        inHH += tin;
        scatterData.push({ x: hh, y: tin });
      } else {
        inNoHH += tin;
      }
    });

    let tableRows = hhHistData.map(r => {
      const ggr = r.ggr || 0;
      return `<tr>
        <td><span class="drill-link" onclick="openDayAnalysis('${r.date}')">📅 ${r.date}</span></td>
        <td><span class="drill-link" onclick="openLocationAnalysis('${(r.locatie||'').replace(/'/g,"\\'").replace(/"/g,"&quot;")}', ${r.location_id}, '${r.date}')" style="display:inline-flex;align-items:center;gap:4px;background:var(--surface2);padding:4px 8px;border-radius:4px;border:1px solid var(--border);">📊 ${r.locatie} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></td>
        <td class="num cell-pos-2">${fmt(r.hh_cost)}</td>
        <td class="num">${fmt(r.total_in)}</td>
        <td class="num">${fmt(r.total_bet)}</td>
        <td class="num ${ggr < 0 ? 'cell-neg-1' : ''}">${fmt(ggr)}</td>
      </tr>`;
    });

    const avgInHH = zileHH > 0 ? inHH / zileHH : 0;
    const avgInNoHH = (totalZile - zileHH) > 0 ? inNoHH / (totalZile - zileHH) : 0;
    const effect = avgInNoHH > 0 ? ((avgInHH - avgInNoHH) / avgInNoHH) * 100 : 0;

    document.getElementById('hh-kpi-zile').textContent = zileHH;
    document.getElementById('hh-kpi-in-hh').textContent = fmt(avgInHH) + ' RON';
    document.getElementById('hh-kpi-in-nohh').textContent = fmt(avgInNoHH) + ' RON';
    
    const effEl = document.getElementById('hh-kpi-efect');
    effEl.textContent = effect > 0 ? `+${effect.toFixed(1)}%` : `${effect.toFixed(1)}%`;
    effEl.className = 'kpi-value ' + (effect > 0 ? 'cell-pos-3' : (effect < 0 ? 'cell-neg-2' : ''));

    let costTotal = 0;
    hhHistData.forEach(r => costTotal += (r.hh_cost || 0));
    const netEfectRon = (inHH - inNoHH) * 0.15 - costTotal; // estimate 15% margin on IN
    
    document.getElementById('hh-kpi-cost').textContent = fmt(costTotal) + ' RON';
    
    const profEl = document.getElementById('hh-kpi-profit');
    profEl.textContent = fmt(netEfectRon) + ' RON';
    profEl.className = 'kpi-value ' + (netEfectRon > 0 ? 'cell-pos-3' : (netEfectRon < 0 ? 'cell-neg-2' : ''));
    
    let insight = '';
    const globalLocEl = document.getElementById('global-loc-select');
    const isGlobal = !globalLocEl || globalLocEl.value === 'all' || globalLocEl.value === '';
    
    if (zileHH === 0) {
      insight = `În perioada <strong>${s} ➔ ${e}</strong> nu au rulat campanii Happy Hour. Selectați o altă perioadă pentru analiză.`;
    } else if (isGlobal) {
      let bdown = '';
      if (advData && Object.keys(advData).length > 0) {
        const names = {};
        if (locData) locData.forEach(r => names[r.id] = r.locatie);
        hhHistData.forEach(r => names[r.location_id] = r.locatie);
        let poz = [], neg = [];
        for (const [lid, st] of Object.entries(advData)) {
          const nm = names[lid] || ('Loc. ' + lid);
          if (st.alerta === 'ROSU') neg.push(nm);
          else if (st.alerta !== 'PORTOCALIU') poz.push(nm); // Verde sau OK
        }
        bdown = `<div style="margin-top:12px; display:flex; gap:16px;">
          <div style="flex:1; background:rgba(34,197,94,0.1); padding:12px; border-radius:8px; border:1px solid var(--success);">
            <div style="font-weight:700; color:var(--success); margin-bottom:4px;">✅ Campanii Profitabile (ROI +)</div>
            <div style="font-size:12px;">${poz.length ? poz.join(', ') : 'Niciuna identificată'}</div>
          </div>
          <div style="flex:1; background:rgba(239,68,68,0.1); padding:12px; border-radius:8px; border:1px solid var(--danger);">
            <div style="font-weight:700; color:var(--danger); margin-bottom:4px;">❌ Campanii pe Pierdere (ROI -)</div>
            <div style="font-size:12px;">${neg.length ? neg.join(', ') : 'Niciuna identificată'}</div>
          </div>
        </div>`;
      }
      insight = `<strong>Analiză la Nivel Global (Multi-Locație):</strong> În perioada <strong>${s} ➔ ${e}</strong> s-au înregistrat ${zileHH} zile active de campanii. ${bdown}`;
    } else {
      const locName = globalLocEl.options[globalLocEl.selectedIndex].text;
      if (effect > 0) {
        insight = `Pentru <strong>${locName}</strong> (${s} ➔ ${e}), campaniile Happy Hour au generat o creștere estimată a volumului de joc (Total IN) cu <strong>${fmt(effect, 1)}%</strong> în zilele active. `;
      } else {
        insight = `Pentru <strong>${locName}</strong> (${s} ➔ ${e}), zilele cu Happy Hour au înregistrat un volum de joc cu <strong>${fmt(Math.abs(effect), 1)}%</strong> mai mic comparativ cu zilele fără promoție. `;
      }
      
      if (netEfectRon > 0) {
        insight += `<br><span style="color:var(--green)">OK</span> <strong>ROI Pozitiv:</strong> Surplusul de încasări acoperă costul campaniilor (${fmt(costTotal)} RON), estimând un profit net adițional de <strong>+${fmt(netEfectRon, 0)} RON</strong> pentru această locație.`;
      } else {
        insight += `<br><span style="color:var(--red)">!</span> <strong>Atenție (ROI Negativ):</strong> Costurile totale cu premiile (${fmt(costTotal)} RON) depășesc marja estimată din sporul de încasări. Deficit net estimat: <strong>${fmt(netEfectRon, 0)} RON</strong> pentru această locație.`;
      }
    }
    const insightEl = document.getElementById('hh-smart-insights');
    if (insightEl) insightEl.innerHTML = insight;

    document.getElementById('body-rep-hh').innerHTML = tableRows.length > 0 ? tableRows.join('') : '<tr><td colspan="6" style="text-align:center;">Nu există evenimente HH în perioada selectată.</td></tr>';

    const dates = data.map(r => r.date.split('-').slice(1).join('-') || r.date);
    const ggrArr = data.map(r => r.ggr);
    const hhArr = data.map(r => r.hh);

    if (hhEvoChart) hhEvoChart.destroy();
    hhEvoChart = new Chart(document.getElementById('hh-evo-chart').getContext('2d'), {
      data: {
        labels: dates,
        datasets: [
          { type: 'line', label: 'GGR', data: ggrArr, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0, yAxisID: 'y1' },
          { type: 'bar', label: 'Cost HH', data: hhArr, backgroundColor: '#ef4444', borderRadius: 4, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle' } } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
          y1: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,.03)' } }
        }
      }
    });

    if (hhScatterChart) hhScatterChart.destroy();
    
    // Process locData for the new Bar chart
    const locLabels = locData.map(l => l.locatie);
    const locGgr = locData.map(l => l.ggr || 0);
    const locHh = locData.map(l => l.hh || 0);
    
    hhScatterChart = new Chart(document.getElementById('hh-loc-chart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: locLabels,
        datasets: [
          { label: 'GGR Real', data: locGgr, backgroundColor: locGgr.map(v=>v>=0?'rgba(16,185,129,.75)':'rgba(239,68,68,.75)'), borderRadius: 4 },
          { label: 'Cost HH', data: locHh, backgroundColor: 'rgba(239,68,68,.8)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,.03)' } }
        }
      }
    });

  } catch(err) {
    console.error('loadHhReport error:', err);
    if(hhEvoChart) { hhEvoChart.destroy(); hhEvoChart = null; }
    if(hhScatterChart) { hhScatterChart.destroy(); hhScatterChart = null; }
    
    document.getElementById('body-rep-hh').innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;">
        <div style="color:var(--red);font-weight:700;margin-bottom:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Eroare la incarcare
        </div>
        <div style="color:var(--muted);font-size:11px;margin-bottom:12px">${err.message}</div>
        <div style="color:var(--muted);font-size:10px">
          Perioadele lungi (ex: Luna curenta) pot fi lente sau pot da timeout la nivel de server.<br>
          Incerca o perioada mai scurta (ex: <strong>Azi</strong> sau <strong>7 zile</strong>) pentru rezultate rapide.
        </div>
      </td></tr>`;
      
    // Clear other sub-panels if there is an error
    const volBody = document.getElementById('hh-vol-body');
    const depBody = document.getElementById('hh-dep-body');
    const insightBox = document.getElementById('hh-smart-insights');
    if(volBody) volBody.innerHTML = '';
    if(depBody) depBody.innerHTML = '';
    if(insightBox) insightBox.innerHTML = '';
    
  } finally {
    showLoader(false);
  }
};

// ─── Day Analysis Page ────────────────────────────────────────────────────────
let daHourlyChart = null, daHhPie = null, daMachinesChart = null;
let _daPrevView = '#dashboard';

function closeDayAnalysisPage() {
  const tp = document.querySelector('.timeline-presets'); if (tp) tp.style.display = '';
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  // Restore previously active nav item
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  const prevHash = _daPrevView || '#dashboard';
  
  if (prevHash.startsWith('#rapoarte/')) {
      document.getElementById('view-rapoarte').classList.add('active');
      const subHash = prevHash.replace('#rapoarte/', '');
document.querySelectorAll('.rep-page').forEach(p => p.style.display = 'none');
      const repTarget = document.getElementById('rep-page-' + subHash);
      if (repTarget) repTarget.style.display = 'block';
      
      const kpiJp = document.getElementById('kpi-jp');
      const kpiExp = document.getElementById('kpi-total-expenses');
      const kpiGrid2 = document.querySelector('.kpi-grid');
      const kpiGames2 = document.getElementById('kpi-games');
      const kpiAp2 = document.getElementById('kpi-aparate');
      if (subHash === 'cheltuieli') {
        if(kpiJp) kpiJp.style.display = 'none';
        if(kpiGames2) kpiGames2.style.display = 'none';
        if(kpiAp2) kpiAp2.style.display = 'none';
        if(kpiExp) kpiExp.style.display = 'block';
        if(kpiGrid2) kpiGrid2.style.gridTemplateColumns = 'repeat(4,1fr)';
      } else {
        if(kpiJp) kpiJp.style.display = 'block';
        if(kpiGames2) kpiGames2.style.display = 'block';
        if(kpiAp2) kpiAp2.style.display = 'block';
        if(kpiExp) kpiExp.style.display = 'none';
        if(kpiGrid2) kpiGrid2.style.gridTemplateColumns = '';
      }
      
      const prevNav = document.querySelector(`.nav-item[href="#rapoarte"]`);
      if (prevNav) prevNav.classList.add('active');
      
      const subLink = document.querySelector(`.subnav-group .nav-item[href="#rapoarte/${subHash}"]`);
      if (subLink) {
          document.querySelectorAll('.subnav-group .nav-item').forEach(b => b.classList.remove('active'));
          subLink.classList.add('active');
      }
  } else {
      const prevNav = document.querySelector(`.nav-item[href="${prevHash}"]`);
      if (prevNav) prevNav.classList.add('active');
      const viewId = 'view-' + prevHash.replace('#','');
      const panel = document.getElementById(viewId);
      if (panel) panel.classList.add('active');
      else document.getElementById('view-dashboard').classList.add('active');
  }
}


// ─── Location Analysis Page ────────────────────────────────────────────────────────
let laEvoChart = null, laDepChart = null, laHourlyChart = null;

window.closeLocAnalysisPage = function() {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  const prevHash = _daPrevView || '#dashboard';
  
  if (prevHash.startsWith('#rapoarte/')) {
      document.getElementById('view-rapoarte').classList.add('active');
      const subHash = prevHash.replace('#rapoarte/', '');
      document.querySelectorAll('.rep-page').forEach(p => p.style.display = 'none');
      const repTarget = document.getElementById('rep-page-' + subHash);
      if (repTarget) repTarget.style.display = 'block';
      
      const prevNav = document.querySelector(`.nav-item[href="#rapoarte"]`);
      if (prevNav) prevNav.classList.add('active');
      const subLink = document.querySelector(`.subnav-group .nav-item[href="#rapoarte/${subHash}"]`);
      if (subLink) {
          document.querySelectorAll('.subnav-group .nav-item').forEach(b => b.classList.remove('active'));
          subLink.classList.add('active');
      }
  } else {
      const prevNav = document.querySelector(`.nav-item[href="${prevHash}"]`);
      if (prevNav) prevNav.classList.add('active');
      const viewId = 'view-' + prevHash.replace('#','');
      const panel = document.getElementById(viewId);
      if (panel) panel.classList.add('active');
      else document.getElementById('view-dashboard').classList.add('active');
  }
};

window.openLocationAnalysis = async function(locName, locId, specificDate = null) {
  _daPrevView = window.location.hash || '#dashboard';
  showLoader(true);
  
  if (specificDate) {
    document.getElementById('start-date').value = specificDate;
    document.getElementById('end-date').value = specificDate;
  }
  
  const {s, e} = getPeriod();
  
  try {
    const [dailyData, advDataObj, hourlyData] = await Promise.all([
      api(`/api/daily?res=day&start=${s}&end=${e}&loc_ids=${locId}`),
      api(`/api/hh_advanced?start=${s}&end=${e}&loc_ids=${locId}`),
      api(`/api/daily?res=hour&start=${s}&end=${e}&loc_ids=${locId}`)
    ]);

    document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(a=>a.classList.remove('active'));
    document.getElementById('view-loc-analysis').classList.add('active');
    document.getElementById('loc-analysis-page-title').textContent = `Analiză Locație: ${locName}`;
    
    // KPI Data
    let totalIn = 0, totalGgr = 0, totalHh = 0, zileHh = 0;
    const dates = [], dataIn = [], dataGgr = [], dataHh = [];
    
    dailyData.forEach(r => {
      totalIn += (r.total_in || 0);
      totalGgr += (r.ggr || 0);
      totalHh += (r.hh || 0);
      if (r.hh > 0) zileHh++;
      dates.push(r.date);
      dataIn.push(r.total_in || 0);
      dataGgr.push(r.ggr || 0);
      dataHh.push(r.hh || 0);
    });

    document.getElementById('la-kpi-row').innerHTML = [
      {label:'Total IN', val:`${fmt(totalIn)} RON`, sub:'', color:'var(--text)'},
      {label:'GGR Real', val:`${fmt(totalGgr)} RON`, sub:'', color: totalGgr>=0?'var(--green)':'var(--red)'},
      {label:'Zile cu HH', val:zileHh, sub:'', color:'var(--accent)'},
      {label:'Cost HH', val:`${fmt(totalHh)} RON`, sub:'', color:'var(--danger)'}
    ].map(k => `
      <div class="kpi-card" style="padding:16px;">
        <div class="kpi-label" style="font-size:11px; margin-bottom:8px;">${k.label} ${k.sub?`<span style="opacity:.6;font-weight:400;margin-left:4px">(${k.sub})</span>`:``}</div>
        <div class="kpi-value" style="font-size:20px; color:${k.color}">${k.val}</div>
      </div>
    `).join('');

    // Insights Box
    const adv = advDataObj && advDataObj[locId] ? advDataObj[locId] : null;
    const ibox = document.getElementById('la-insight-box');
    if (adv) {
      ibox.innerHTML = adv.insight;
      if (adv.alerta === 'ROSU') { ibox.style.borderColor = 'var(--danger)'; ibox.style.color = 'var(--danger)'; ibox.style.backgroundColor = 'rgba(239,68,68,0.1)'; }
      else if (adv.alerta === 'PORTOCALIU') { ibox.style.borderColor = 'var(--warning)'; ibox.style.color = 'var(--warning)'; ibox.style.backgroundColor = 'rgba(245,158,11,0.1)'; }
      else { ibox.style.borderColor = 'var(--success)'; ibox.style.color = 'var(--success)'; ibox.style.backgroundColor = 'rgba(34,197,94,0.1)'; }
    } else {
      ibox.style.display = 'none';
    }

    // Chart 1: Evo
    if (laEvoChart) laEvoChart.destroy();
    laEvoChart = new Chart(document.getElementById('la-evo-chart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          { label: 'Total IN', data: dataIn, backgroundColor: 'rgba(99,102,241,0.8)', order: 3 },
          { label: 'Cost HH', data: dataHh, backgroundColor: 'rgba(239,68,68,0.8)', order: 2 },
          { label: 'GGR', data: dataGgr, type: 'line', borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.3, borderWidth: 2, order: 1 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false } }
    });

    // Chart 2: Top Dependent Machines (Bar)
    if (laDepChart) laDepChart.destroy();
    if (adv && adv.dependente && adv.dependente.length > 0) {
      const depLabels = adv.dependente.map(d => d.name.split(' (')[0]);
      const depData = adv.dependente.map(d => d.pct_in_hh);
      laDepChart = new Chart(document.getElementById('la-dep-pie').getContext('2d'), {
        type: 'bar',
        data: {
          labels: depLabels,
          datasets: [{ label: '% IN realizat în HH', data: depData, backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
      });
    } else {
      // clear canvas
      const ctx = document.getElementById('la-dep-pie').getContext('2d');
      ctx.clearRect(0,0,1000,1000);
      ctx.font = '12px Inter';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText('Niciun aparat nu e complet dependent de HH.', 150, 100);
    }

    // Chart 3: Hourly
    if (laHourlyChart) laHourlyChart.destroy();
    // Agregam orar (0-23)
    let hrAgg = Array(24).fill(0).map(()=>({in:0, hh:0, cnt:0}));
    hourlyData.forEach(r => {
      const timePart = r.date.includes(' ') ? r.date.split(' ')[1] : r.date;
      let h = parseInt(timePart.split(':')[0], 10);
      hrAgg[h].in += (r.total_in || 0);
      hrAgg[h].hh += (r.hh || 0);
      hrAgg[h].cnt += 1;
    });
    
    laHourlyChart = new Chart(document.getElementById('la-hourly-chart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: Array(24).fill(0).map((_,i)=>i+':00'),
        datasets: [
          { label: 'Rulaj Mediu (IN)', data: hrAgg.map(x => x.cnt>0 ? x.in/x.cnt : 0), backgroundColor: 'rgba(99,102,241,0.6)' },
          { label: 'Cost Mediu HH', data: hrAgg.map(x => x.cnt>0 ? x.hh/x.cnt : 0), backgroundColor: 'rgba(239,68,68,0.8)', borderColor: 'rgba(239,68,68,1)', type: 'line', tension: 0.3, yAxisID: 'y1' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { type: 'linear', display: true, position: 'left' }, y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } } } }
    });

  } catch(err) {
    console.error(err);
  } finally {
    showLoader(false);
  }
};


window.openDayAnalysis = async function(dateStr) {
  _daPrevView = window.location.hash || '#dashboard';
  showLoader(true);
  try {
    const [hourly, machines, smart] = await Promise.all([
      api(`/api/daily?res=hour&start=${dateStr}&end=${dateStr}${locParam()}`),
      api(`/api/machines?start=${dateStr}&end=${dateStr}${locParam()}&provider_id=&cabinet_id=`),
      api(`/api/reports/day_smart?start=${dateStr}&end=${dateStr}${locParam()}`)
    ]);

    // ── Totale ──────────────────────────────────────────────────────────
    let totalIn=0, totalGgr=0, totalHh=0;
    let maxHour=null, minHour=null, maxHhHour=null, hoursWithHH=[];
    hourly.forEach(r => {
      totalIn  += (+r.total_in||0);
      totalGgr += (+r.ggr||0);
      totalHh  += (+r.hh||0);
      if(!maxHour||r.ggr>maxHour.ggr) maxHour=r;
      if(!minHour||r.ggr<minHour.ggr) minHour=r;
      if(+r.hh>0){ hoursWithHH.push(r); if(!maxHhHour||r.hh>maxHhHour.hh) maxHhHour=r; }
    });
    const ggrFaraHH = totalGgr + totalHh;
    const hhImpactPct = ggrFaraHH!==0 ? Math.abs((totalHh/Math.abs(ggrFaraHH))*100) : 0;
    const holdPct = totalIn > 0 ? (totalGgr/totalIn)*100 : 0;

    machines.sort((a,b)=>b.ggr-a.ggr);
    const machinesWithHH = machines.filter(m=>m.hh>0).sort((a,b)=>b.hh-a.hh);
    const topWinners = machines.slice(0,5);
    const topLosers  = [...machines].reverse().slice(0,5);

    const tp = document.querySelector('.timeline-presets'); if (tp) tp.style.display = 'none';
    document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(a=>a.classList.remove('active'));
    document.getElementById('view-day-analysis').classList.add('active');
    document.getElementById('day-analysis-page-title').textContent = `Analiza Zilei: ${dateStr}`;
    document.getElementById('day-analysis-page-sub').textContent =
      `${hourly.length} ore analizate · ${machines.length} aparate · ${hoursWithHH.length} ore cu Happy Hour activ`;

    // ── KPI Row ─────────────────────────────────────────────────────────
    document.getElementById('da-kpi-row').innerHTML = [
      {label:'Total IN', val:`${fmt(totalIn)} RON`, sub:'', color:'var(--text)'},
      {label:'GGR Real', val:`${fmt(totalGgr)} RON`, sub:'', color: totalGgr>=0?'var(--green)':'var(--red)'},
      {label:'GGR fara HH', val:`${fmt(ggrFaraHH)} RON`, sub:'estimat', color: ggrFaraHH>=0?'var(--green)':'var(--red)'},
      {label:'Cost HH Total', val:`${fmt(totalHh)} RON`, sub:`${hoursWithHH.length} ore active`, color:'var(--accent)'},
      {label:'Hold%', val:`${fmt(holdPct,2)}%`, sub:'GGR/IN', color: holdPct>=3?'var(--green)':holdPct>0?'var(--orange)':'var(--red)'},
    ].map(k=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${k.label}</div>
        <div style="font-size:18px;font-weight:800;color:${k.color};line-height:1.2">${k.val}</div>
        ${k.sub?`<div style="font-size:10px;color:var(--muted);margin-top:3px">${k.sub}</div>`:''}
      </div>`).join('');

    // ── Smart Client Stats ──────────────────────────────────────────────
    let locInsightsHtml = '';
    if (smart.location_insights && smart.location_insights.length > 0) {
      const renderClientList = (list) => {
        if (!list || !list.length) return `<div style="color:var(--muted); font-size:11px;">—</div>`;
        return `<div style="display:flex; flex-direction:column; gap:2px; max-height:220px; overflow-y:auto; padding-right:4px;">
          ${list.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:3px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.03);">
              <span style="font-size:10.5px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.name}">${c.name}</span>
              <span style="font-size:9.5px; font-weight:700; color:var(--muted); background:rgba(0,0,0,0.2); padding:1px 4px; border-radius:3px;">${c.v} vizite</span>
            </div>
          `).join('')}
        </div>`;
      };
      locInsightsHtml = `<div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">`;
      smart.location_insights.forEach(li => {
        locInsightsHtml += `
          <div style="background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:12px; flex:1; min-width:240px; display:flex; flex-direction:column; gap:12px;">
            <div style="font-weight:800; font-size:12px; color:var(--text); border-bottom:1px solid var(--border); padding-bottom:6px;">${li.locatie}</div>
            
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span style="color:var(--muted); font-weight:600; font-size:11px; padding-left:2px;">Fideli (${li.fidel_count})</span>
              ${renderClientList(li.fidel)}
            </div>
            
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span style="color:var(--green); font-weight:600; font-size:11px; padding-left:2px;">+ Noi/Reveniți (${li.nou_count})</span>
              ${renderClientList(li.nou)}
            </div>
            
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span style="color:var(--red); font-weight:600; font-size:11px; padding-left:2px;">- Lipsă (30 zile) (${li.lipsa_count})</span>
              ${renderClientList(li.lipsa)}
            </div>
          </div>
        `;
      });
      locInsightsHtml += `</div>`;
    }

    let smartHtml = `
      <div style="background:linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%); border:1px solid rgba(139,92,246,0.3); border-radius:var(--radius); padding:20px; margin-bottom:24px; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div>
            <div style="font-size:11px; font-weight:800; color:#8b5cf6; text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px;">✨ Smart Client Insights</div>
            <div style="font-size:13px; color:var(--text); max-width:400px; line-height:1.4;">
              Activitate loialitate: <strong>${smart.card_players}</strong> clienți cu card unici au jucat.
            </div>
          </div>
          <div style="display:flex; gap:16px; text-align:right;">
            <div><div style="font-size:10px; color:var(--muted); text-transform:uppercase;">Cashback Oferit</div><div style="font-size:16px; font-weight:800; color:var(--text);">${fmt(smart.cashback)} RON</div></div>
            <div><div style="font-size:10px; color:var(--muted); text-transform:uppercase;">Câștig Roată</div><div style="font-size:16px; font-weight:800; color:var(--orange);">${fmt(smart.wheel)} RON</div></div>
            <div><div style="font-size:10px; color:var(--muted); text-transform:uppercase;">Jackpoturi (Card)</div><div style="font-size:16px; font-weight:800; color:var(--green);">${fmt(smart.jackpots)} RON</div></div>
          </div>
        </div>
        ${locInsightsHtml}
      </div>
    `;
    
    // Add it after KPI row
    const kpiRow = document.getElementById('da-kpi-row');
    if (!document.getElementById('da-smart-row')) {
      const el = document.createElement('div');
      el.id = 'da-smart-row';
      kpiRow.parentNode.insertBefore(el, kpiRow.nextSibling);
    }
    document.getElementById('da-smart-row').innerHTML = smartHtml;

    // ── Verdict ─────────────────────────────────────────────────────────
    let verdictColor, verdictTitle, verdictText, maxHhSection='';
    if(totalHh===0){
      verdictColor='var(--muted)'; verdictTitle='Nicio campanie Happy Hour activa in aceasta zi.';
      verdictText=`GGR total: <strong>${fmt(totalGgr)} RON</strong>. Rezultatul reflecta activitatea pura a sloturilor, fara influenta promotionala.`;
    } else if(totalGgr>=0){
      verdictColor='var(--green)'; verdictTitle=`Happy Hour a rulat — cost total ${fmt(totalHh)} RON. Ziua s-a inchis PE PLUS.`;
      verdictText=`GGR realizat: <strong style="color:var(--green)">${fmt(totalGgr)} RON</strong>. Fara campania HH, GGR estimat ar fi fost <strong>${fmt(ggrFaraHH)} RON</strong>. Costul promotiei a redus profitul cu <strong>${fmt(totalHh)} RON (${hhImpactPct.toFixed(1)}% din GGR brut)</strong>, insa ziua ramane profitabila. HH a rulat in <strong>${hoursWithHH.length} ore</strong>.`;
    } else if(ggrFaraHH>=0){
      verdictColor='var(--red)'; verdictTitle=`Happy Hour a dus ziua in PIERDERE. Fara HH, ar fi fost zi profitabila.`;
      verdictText=`GGR realizat: <strong style="color:var(--red)">${fmt(totalGgr)} RON</strong>. Fara costul HH de <strong>${fmt(totalHh)} RON</strong>, GGR estimat ar fi fost <strong style="color:var(--green)">+${fmt(ggrFaraHH)} RON</strong> — zi PROFITABILA. Campaniile din ${hoursWithHH.length} ore au transformat o zi buna intr-o pierdere.`;
    } else {
      verdictColor='var(--red)'; verdictTitle=`Zi pe pierdere. Happy Hour a amplificat deficitul cu ${fmt(totalHh)} RON.`;
      verdictText=`GGR realizat: <strong style="color:var(--red)">${fmt(totalGgr)} RON</strong>. Chiar si fara HH, GGR ar fi ramas negativ: <strong style="color:var(--red)">${fmt(ggrFaraHH)} RON</strong>. Problema principala nu e promotia, ci performanta sloturilor. HH a adaugat totusi <strong>${fmt(totalHh)} RON</strong> la deficit in <strong>${hoursWithHH.length} ore</strong>.`;
    }
    if(maxHhHour){
      maxHhSection=`
        <div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid var(--accent);padding:12px 16px;border-radius:12px;margin-top:14px;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Ora cu cel mai mare cost HH</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div><span style="font-size:20px;font-weight:800;color:var(--accent)">${maxHhHour.date}</span>
              <span style="font-size:11px;color:var(--muted);margin-left:10px">cost premii: <strong>${fmt(maxHhHour.hh)} RON</strong></span>
            </div>
            <div style="text-align:right;font-size:11px;color:var(--muted)">IN: ${fmt(maxHhHour.total_in)}<br>GGR: <span style="color:${maxHhHour.ggr>=0?'var(--green)':'var(--red)'};font-weight:700">${fmt(maxHhHour.ggr)} RON</span></div>
          </div>
          ${(maxHhHour.loc_details||[]).length?`<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${(maxHhHour.loc_details).sort((a,b)=>b.hh-a.hh).map(l=>`<span style="font-size:10px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:2px 10px"><strong>${l.locatie}</strong>: HH <span style="color:var(--accent)">${fmt(l.hh)}</span> &bull; GGR <span style="color:${l.ggr>=0?'var(--green)':'var(--red)'}">${fmt(l.ggr)}</span></span>`).join('')}</div>`:''}
        </div>`;
    }
    document.getElementById('da-verdict').innerHTML=`
      <div style="background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${verdictColor};border-radius:var(--radius);padding:18px 22px;">
        <div style="font-size:10px;font-weight:700;color:${verdictColor};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Verdict Happy Hour</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px;">${verdictTitle}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.7">${verdictText}</div>
        ${maxHhSection}
      </div>`;

    // ── Charts ───────────────────────────────────────────────────────────
    hourly.sort((a, b) => {
      const h1 = parseInt(a.date.split(':')[0], 10);
      const h2 = parseInt(b.date.split(':')[0], 10);
      const w1 = h1 >= 8 ? h1 - 8 : h1 + 16;
      const w2 = h2 >= 8 ? h2 - 8 : h2 + 16;
      return w1 - w2;
    });
    const labels = hourly.map(r=>r.date);
    const inArr  = hourly.map(r=>+r.total_in||0);
    const ggrArr = hourly.map(r=>+r.ggr||0);
    const hhArr  = hourly.map(r=>+r.hh||0);

    if(daHourlyChart) daHourlyChart.destroy();
    daHourlyChart = new Chart(document.getElementById('da-hourly-chart').getContext('2d'), {
      data: { labels,
        datasets: [
          {type:'line', label:'Total IN', data:inArr, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,.08)', tension:0.4, fill:true, borderWidth:2, pointRadius:2, yAxisID:'y2'},
          {type:'bar',  label:'GGR',      data:ggrArr, backgroundColor:ggrArr.map(v=>v>=0?'rgba(16,185,129,.75)':'rgba(239,68,68,.75)'), borderRadius:4, yAxisID:'y1'},
          {type:'bar',  label:'Cost HH',  data:hhArr,  backgroundColor:'rgba(239,68,68,.8)', borderRadius:4, yAxisID:'y1'},
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction:{mode:'index', intersect:false},
        plugins:{legend:{labels:{color:'#94a3b8', usePointStyle:true, pointStyle:'circle', boxWidth:8, font:{size:10}}},
          tooltip:{
            callbacks:{
              label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} RON`,
              footer: ctxArr => {
                const idx = ctxArr[0]?.dataIndex;
                const hour = hourly[idx];
                if(!hour) return [];
                const lines = [];
                // Location breakdown
                const locs = hour.loc_details || hour.locs || [];
                if(locs.length) {
                  lines.push('');
                  lines.push('── Detalii locatii ──');
                  locs.sort((a,b)=>Math.abs(b.ggr)-Math.abs(a.ggr)).forEach(l => {
                    const hhStr = (+l.hh>0) ? ` | HH: ${fmt(l.hh)}` : '';
                    lines.push(`${l.locatie}: IN ${fmt(l.in || 0)} | GGR ${fmt(l.ggr)}${hhStr}`);
                  });
                }
                // Top HH machines this hour
                const hhMach = machinesWithHH.filter(m => +hour.hh > 0).slice(0,3);
                if(+hour.hh > 0 && hhMach.length) {
                  lines.push('');
                  lines.push('── Top aparate HH (zi) ──');
                  hhMach.forEach(m => lines.push(`${m.serial_nr} ${m.cabinet||''}: HH ${fmt(m.hh)} RON`));
                }
                return lines;
              }
            },
            footerColor: '#f59e0b',
            footerFont: {size: 10}
          }
        },
        scales:{
          y1:{position:'left',  ticks:{color:'#64748b', callback:v=>fmtK(v)}, grid:{color:'rgba(255,255,255,.03)'}},
          y2:{position:'right', ticks:{color:'#3b82f6', callback:v=>fmtK(v)}, grid:{display:false}},
          x: {ticks:{color:'#64748b', font:{size:10}}, grid:{display:false}}
        }
      }
    });

    if(daHhPie) { daHhPie.destroy(); daHhPie=null; }
    const hhHours = hourly.filter(r=>+r.hh>0);
    const hhPieWrap = document.getElementById('da-hh-pie-wrap');
    const hhPieCanvas = document.getElementById('da-hh-pie');
    if(hhHours.length && hhPieCanvas){
      if(hhPieWrap) hhPieWrap.style.display = 'block';
      daHhPie = new Chart(hhPieCanvas.getContext('2d'),{
        type:'doughnut',
        data:{
          labels: hhHours.map(r=>r.date),
          datasets:[{
            data: hhHours.map(r=>+r.hh),
            backgroundColor: CHART_COLORS,
            borderWidth:0
          }]
        },
        options:{responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{position:'bottom', labels:{color:'#94a3b8', font:{size:9}, boxWidth:8}},
            tooltip:{callbacks:{label:ctx=>{
              const h = hhHours[ctx.dataIndex];
              const locs = (h.loc_details||[]).filter(l=>+l.hh>0).sort((a,b)=>b.hh-a.hh);
              const locsStr = locs.map(l=>`${l.locatie}: ${fmt(l.hh)} RON`).join(', ');
              return [`${ctx.label}: Cost HH ${fmt(ctx.raw)} RON`, locsStr ? `Locatii: ${locsStr}` : ''];
            }}}
          }, cutout:'60%'}
      });
    } else {
      if(hhPieWrap) hhPieWrap.style.display='flex';
      // Show message but keep the canvas for potential re-use
      if(hhPieWrap) hhPieWrap.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12px;flex-direction:column;gap:6px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Nicio campanie HH activa in aceasta zi</div>';
    }

    // Machines bar — top 15 by abs(ggr)
    const top15 = machines.slice(0,15);
    if(daMachinesChart) daMachinesChart.destroy();
    daMachinesChart = new Chart(document.getElementById('da-machines-chart').getContext('2d'),{
      type:'bar',
      data:{
        labels: top15.map(m=>`${m.serial_nr} (${m.locatie})`),
        datasets:[
          {label:'GGR', data:top15.map(m=>m.ggr), backgroundColor:top15.map(m=>m.ggr>=0?'rgba(16,185,129,.75)':'rgba(239,68,68,.75)'), borderRadius:4},
          {label:'Cost HH', data:top15.map(m=>m.hh), backgroundColor:'rgba(239,68,68,.8)', borderRadius:4},
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false, indexAxis:'y',
        interaction:{mode:'index', intersect:false},
        plugins:{legend:{labels:{color:'#94a3b8', font:{size:10}, boxWidth:8}},
          tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${fmt(ctx.raw)} RON`}}},
        scales:{
          x:{ticks:{color:'#64748b', callback:v=>fmtK(v)}, grid:{color:'rgba(255,255,255,.03)'}},
          y:{ticks:{color:'#94a3b8', font:{size:10}}, grid:{display:false}}
        }
      }
    });

    // ── Detail columns ───────────────────────────────────────────────────
    const fmtHourCard=(r,title,color)=>{
      if(!r)return '';
      const locs=(r.loc_details||[]).sort((a,b)=>Math.abs(b.ggr)-Math.abs(a.ggr)).slice(0,4)
        .map(l=>`<span style="font-size:10px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:2px 9px"><strong>${l.locatie}</strong>: GGR <span style="color:${l.ggr>=0?'var(--green)':'var(--red)'}">${fmt(l.ggr)}</span>${l.hh>0?` &bull; HH <span style="color:var(--accent)">${fmt(l.hh)}</span>`:''}</span>`).join('');
        
      let machinesHtml = '';
      if (r.top_machine && r.top_machine.ggr > 0) {
        machinesHtml += `<div style="font-size:11px; margin-top:8px; padding-top:8px; border-top:1px dashed var(--border); display:flex; justify-content:space-between;">
          <span style="color:var(--muted)">Top profit: <strong style="color:var(--text)">${r.top_machine.serial_nr}</strong> <span style="font-size:9px">(${r.top_machine.mix || r.top_machine.cabinet})</span></span>
          <strong style="color:var(--green)">+${fmt(r.top_machine.ggr)} RON</strong>
        </div>`;
      }
      if (r.bottom_machine && r.bottom_machine.ggr < 0) {
        machinesHtml += `<div style="font-size:11px; margin-top:4px; display:flex; justify-content:space-between;">
          <span style="color:var(--muted)">Top minus: <strong style="color:var(--text)">${r.bottom_machine.serial_nr}</strong> <span style="font-size:9px">(${r.bottom_machine.mix || r.bottom_machine.cabinet})</span></span>
          <strong style="color:var(--red)">${fmt(r.bottom_machine.ggr)} RON</strong>
        </div>`;
      }

      return `<div style="background:var(--surface);border:1px solid var(--border);border-left:3px solid ${color};padding:14px 16px;border-radius:var(--radius);margin-bottom:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${title}</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div style="font-size:22px;font-weight:900;color:${color}">${r.date} <span style="font-size:12px;font-weight:600;color:var(--muted)">GGR: ${fmt(r.ggr)} RON</span></div>
          <div style="text-align:right;font-size:11px;color:var(--muted)">IN: ${fmt(r.total_in)}<br>HH: <span style="color:${r.hh>0?'var(--accent)':'var(--muted)'};font-weight:700">${r.hh>0?fmt(r.hh)+' RON':'—'}</span></div>
        </div>
        ${locs?`<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px">${locs}</div>`:''}
        ${machinesHtml}
      </div>`;
    };

    const fmtMachine=m=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text)">${m.serial_nr} <span style="color:var(--muted);font-weight:400;font-size:11px">${m.cabinet||'—'} / ${m.mix||'—'}</span></div>
          <div style="font-size:11px;color:var(--muted)">${m.locatie}</div>
        </div>
        <div style="text-align:right;padding-left:12px">
          <div style="font-size:13px;font-weight:800;color:${m.ggr>=0?'var(--green)':'var(--red)'}">${fmt(m.ggr)} RON</div>
          <div style="font-size:10px;color:var(--muted)">JP: ${fmtK(m.jackpot)} &bull; HH: <span style="color:${m.hh>0?'var(--accent)':'var(--muted)'}">${fmtK(m.hh)}</span></div>
        </div>
      </div>`;

    const hhMachinesHtml = machinesWithHH.slice(0,10).map(m=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text)">${m.serial_nr} <span style="color:var(--muted);font-weight:400">${m.cabinet||'—'}</span></div>
          <div style="font-size:10px;color:var(--muted)">${m.locatie} &bull; ${m.mix||'—'}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:12px;font-weight:800;color:var(--accent)">HH: ${fmt(m.hh)} RON</div>
          <div style="font-size:10px;color:${m.ggr>=0?'var(--green)':'var(--red)'}">GGR: ${fmt(m.ggr)} RON</div>
        </div>
      </div>`).join('') || `<div style="font-size:12px;color:var(--muted);padding:8px 0">Niciun aparat cu Happy Hour activ.</div>`;

    const card=(title,content)=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">${title}</div>
        ${content}
      </div>`;

    document.getElementById('da-col-left').innerHTML =
      fmtHourCard(maxHour,'Cea mai profitabila ora','var(--green)') +
      fmtHourCard(minHour,'Cea mai slaba ora','var(--red)') +
      card('Top 5 Aparate Profitabile', topWinners.filter(m=>m.ggr>0).map(fmtMachine).join('')||'<div style="font-size:12px;color:var(--muted)">Niciun aparat pe plus</div>');

    document.getElementById('da-col-right').innerHTML =
      card('Aparate cu cel mai mare cost Happy Hour', hhMachinesHtml) +
      card('Top 5 Aparate cu Pierderi', topLosers.filter(m=>m.ggr<0).map(fmtMachine).join('')||'<div style="font-size:12px;color:var(--muted)">Niciun aparat pe minus</div>');

  } catch(e){
    console.error(e);
  } finally {
    showLoader(false);
  }
};

// ─── Analize Inteligente ──────────────────────────────────────────────────────
let anQuadChart=null, anPeakChart=null, anCabChart=null;

async function loadAnalize() {
  const {s,e} = getPeriod();
  showLoader(true);
  try {
    const [machines, locations, cabinets, hourlyPeriod] = await Promise.all([
      api(`/api/machines?start=${s}&end=${e}${locParam()}&provider_id=&cabinet_id=`),
      api(`/api/locations?start=${s}&end=${e}${locParam()}`),
      api(`/api/cabinets?start=${s}&end=${e}${locParam()}`),
      api(`/api/reports/hourly?start=${s}&end=${e}${locParam()}`)
    ]);

    const dayCount = Math.max(1, Math.round((new Date(e)-new Date(s))/(86400000))+1);
    const subEl = document.getElementById('analize-sub');
    if (subEl) subEl.textContent =
      `Analiza automata: ${s} — ${e} (${dayCount} zile) · ${machines.length} aparate · ${locations.length} locatii`;

    // ── 1. Quadrant Scatter ────────────────────────────────────────────
    const medIN = machines.reduce((a,m)=>a+(+m.total_in||0),0)/machines.length;
    const medHold = machines.reduce((a,m)=>a+(+m.hold_pct||0),0)/machines.length;
    const maxHH = Math.max(1,...machines.map(m=>+m.hh||0));

    const qColors = m => {
      const hiIN = +m.total_in > medIN, hiHold = +m.hold_pct > medHold;
      if(hiIN && hiHold) return 'rgba(16,185,129,0.75)';
      if(hiIN && !hiHold) return 'rgba(59,130,246,0.65)';
      if(!hiIN && hiHold) return 'rgba(245,158,11,0.65)';
      return 'rgba(239,68,68,0.6)';
    };

    if(anQuadChart) anQuadChart.destroy();
    const quadCanvas = document.getElementById('an-quadrant');
    if(!quadCanvas) { showLoader(false); return; }
    anQuadChart = new Chart(quadCanvas.getContext('2d'), {
      type:'bubble',
      data:{ datasets:[{
        label:'Aparate',
        data: machines.map(m=>({
          x: Math.round(+m.total_in/1000),
          y: +m.hold_pct||0,
          r: Math.max(4, (+m.hh/maxHH)*22 + 4),
          _m: m
        })),
        backgroundColor: machines.map(qColors),
        borderWidth: 0
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{
            label: ctx => {
              const m=ctx.raw._m;
              return [`${m.serial_nr} (${m.locatie})`, `IN: ${fmt(m.total_in)} | Hold: ${fmt(m.hold_pct,1)}%`, `GGR: ${fmt(m.ggr)} | HH cost: ${fmt(m.hh)}`];
            }
          }},
          annotation: {
            annotations: {
              vLine:{type:'line', xMin:Math.round(medIN/1000), xMax:Math.round(medIN/1000), borderColor:'rgba(255,255,255,.15)', borderWidth:1, borderDash:[4,4]},
              hLine:{type:'line', yMin:medHold, yMax:medHold, borderColor:'rgba(255,255,255,.15)', borderWidth:1, borderDash:[4,4]}
            }
          }
        },
        scales:{
          x:{title:{display:true, text:'Total IN (mii RON)', color:'#64748b', font:{size:10}}, ticks:{color:'#64748b', callback:v=>v+'k'}, grid:{color:'rgba(255,255,255,.03)'}},
          y:{title:{display:true, text:'Hold %', color:'#64748b', font:{size:10}}, ticks:{color:'#64748b', callback:v=>v+'%'}, grid:{color:'rgba(255,255,255,.03)'}}
        }
      }
    });

    // ── 2. HH ROI per Locatie ──────────────────────────────────────────
    const hhRoiRows = locations
      .filter(l => l.hh > 0)
      .map(l => {
        const roi = l.hh > 0 ? l.ggr / l.hh : 0;
        const roiColor = roi > 2 ? 'var(--green)' : roi > 1 ? 'var(--orange)' : 'var(--red)';
        const roiLabel = roi > 2 ? 'Excelent' : roi > 1 ? 'Acceptabil' : 'Negativ';
        const barW = Math.min(100, Math.abs(roi/5)*100);
        return `
          <div style="padding:10px 0; border-bottom:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div>
                <div style="font-size:12px; font-weight:700; color:var(--text)">${l.locatie}</div>
                <div style="font-size:10px; color:var(--muted)">HH cost: ${fmt(l.hh)} RON &bull; GGR: <span style="color:${l.ggr>=0?'var(--green)':'var(--red)'}">${fmt(l.ggr)}</span></div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:14px; font-weight:800; color:${roiColor}">${roi.toFixed(2)}x</div>
                <div style="font-size:10px; color:${roiColor}; font-weight:600">${roiLabel}</div>
              </div>
            </div>
            <div style="background:var(--surface2); height:6px; border-radius:3px; overflow:hidden;">
              <div style="width:${barW}%; height:100%; background:${roiColor}; border-radius:3px; transition:width .5s"></div>
            </div>
          </div>`;
      }).join('') || '<div style="font-size:12px;color:var(--muted);padding:8px 0">Nicio locatie cu HH activ in perioada selectata.</div>';

    const hhRoiEl=document.getElementById('an-hh-roi'); if(hhRoiEl) hhRoiEl.innerHTML=hhRoiRows;

    // ── 3. Aparate dependente HH (HH% din GGR brut > 60%) ─────────────
    const hhAddicts = machines
      .filter(m => m.hh > 0)
      .map(m => ({...m, hhDep: m.hh / (m.ggr + m.hh + 0.01) * 100}))
      .filter(m => m.hhDep > 50)
      .sort((a,b) => b.hhDep - a.hhDep)
      .slice(0,10);

    const hhAddEl=document.getElementById('an-hh-addicts'); if(hhAddEl) hhAddEl.innerHTML = hhAddicts.length ? hhAddicts.map(m=>`
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:11px; font-weight:700; color:var(--text)">${m.serial_nr} <span style="color:var(--muted); font-weight:400">${m.cabinet||'—'}</span></div>
          <div style="font-size:10px; color:var(--muted)">${m.locatie} &bull; ${m.mix||'—'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; font-weight:800; color:var(--red)">${fmt(m.hhDep,1)}% HH dep.</div>
          <div style="font-size:10px; color:var(--muted)">GGR: ${fmt(m.ggr)} | HH: <span style="color:var(--accent)">${fmt(m.hh)}</span></div>
        </div>
      </div>`).join('')
    : '<div style="font-size:12px;color:var(--green);padding:8px 0">Niciun aparat cu dependenta excesiva de HH. Bun semn!</div>';

    // ── 4. Peak Hours chart (din raportul orar) ────────────────────────
    const hourBuckets = {};
    for(let h=8; h<32; h++) hourBuckets[String(h%24).padStart(2,'0')+':00'] = {ggr:0, cnt:0};
    (hourlyPeriod||[]).forEach(r => {
      const dt = r.dt || r.date || '';
      // dt looks like "2026-05-08 23:00:00" — extract HH:00
      const timePart = dt.includes(' ') ? dt.split(' ')[1] : dt.slice(-5);
      const key = timePart.slice(0,5);
      if(hourBuckets[key]) { hourBuckets[key].ggr += (+r.ggr||0); hourBuckets[key].cnt++; }
    });
    const peakLabels = Object.keys(hourBuckets);
    const peakVals   = peakLabels.map(h => hourBuckets[h].cnt > 0 ? Math.round(hourBuckets[h].ggr/hourBuckets[h].cnt) : 0);

    if(anPeakChart) anPeakChart.destroy();
    const peakCanvas=document.getElementById('an-peak-hours'); if(!peakCanvas) return;
    anPeakChart = new Chart(peakCanvas.getContext('2d'),{
      type:'bar',
      data:{ labels:peakLabels,
        datasets:[{label:'GGR mediu/zi (RON)', data:peakVals,
          backgroundColor:peakVals.map(v=>v>=0?'rgba(16,185,129,.7)':'rgba(239,68,68,.7)'),
          borderRadius:4}]},
      options:{responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>`${fmt(ctx.raw)} RON`}}},
        scales:{x:{ticks:{color:'#64748b',font:{size:9}},grid:{display:false}},
          y:{ticks:{color:'#64748b',callback:v=>fmtK(v)},grid:{color:'rgba(255,255,255,.03)'}}}}
    });

    // ── 5. Cabinet Efficiency chart ────────────────────────────────────
    const cabEff = cabinets
      .filter(c=>c.buc>0 && c.zile>0)
      .map(c=>({...c, effPerMachPerDay: (c.ggr||0)/c.buc/(c.zile||1)}))
      .sort((a,b)=>b.effPerMachPerDay-a.effPerMachPerDay)
      .slice(0,12);

    if(anCabChart) anCabChart.destroy();
    const cabCanvas=document.getElementById('an-cabinet-eff'); if(!cabCanvas) return;
    anCabChart = new Chart(cabCanvas.getContext('2d'),{
      type:'bar',
      data:{ labels: cabEff.map(c=>`[${c.provider||'?'}] ${c.cabinet}`),
        datasets:[{label:'GGR/ap/zi',data:cabEff.map(c=>Math.round(c.effPerMachPerDay)),
          backgroundColor: cabEff.map(c=>c.effPerMachPerDay>=0?'rgba(99,102,241,.75)':'rgba(239,68,68,.7)'),
          borderRadius:4}]},
      options:{responsive:true, maintainAspectRatio:false, indexAxis:'y',
        plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>`${fmt(ctx.raw)} RON/ap/zi`}}},
        scales:{x:{ticks:{color:'#64748b',callback:v=>fmtK(v)},grid:{color:'rgba(255,255,255,.03)'}},
          y:{ticks:{color:'#94a3b8',font:{size:9}, callback:v=>{ let l=v; return l.length>22?l.slice(0,20)+'...':l; }},grid:{display:false}}}}
    });

    // ── 6. Aparate Problematice ────────────────────────────────────────
    const problems = machines
      .filter(m => m.ggr < 0)
      .sort((a,b)=>a.ggr-b.ggr)
      .slice(0,15);

    const probEl=document.getElementById('an-problem-machines'); if(probEl) probEl.innerHTML = problems.length ? problems.map(m=>`
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:11px; font-weight:700; color:var(--text)">${m.serial_nr} <span style="color:var(--muted); font-weight:400; font-size:10px">${m.cabinet||'—'}</span></div>
          <div style="font-size:10px; color:var(--muted)">${m.locatie} &bull; ${m.mix||'—'}</div>
          ${m.hh>0?`<div style="font-size:9px; color:var(--accent); margin-top:1px">HH cost: ${fmt(m.hh)} RON — posibil cauza a pierderii</div>`:''}
        </div>
        <div style="text-align:right; padding-left:10px;">
          <div style="font-size:13px; font-weight:800; color:var(--red)">${fmt(m.ggr)} RON</div>
          <div style="font-size:10px; color:var(--muted)">${m.zile}z &bull; JP: ${fmtK(m.jackpot)}</div>
        </div>
      </div>`).join('')
    : '<div style="font-size:12px;color:var(--green);padding:8px 0">Niciun aparat cu GGR negativ in aceasta perioada.</div>';

    // ── 7. Top Performers ──────────────────────────────────────────────
    const topPerf = machines
      .filter(m => m.ggr > 0 && m.hold_pct > 0 && m.zile >= Math.ceil(dayCount*0.5))
      .sort((a,b) => {
        const scoreA = (+a.hold_pct*0.5) + (+a.ggr/1000*0.3) - (+a.hh/(+a.ggr+1)*10);
        const scoreB = (+b.hold_pct*0.5) + (+b.ggr/1000*0.3) - (+b.hh/(+b.ggr+1)*10);
        return scoreB - scoreA;
      })
      .slice(0,15);

    const topEl=document.getElementById('an-top-performers'); if(topEl) topEl.innerHTML = topPerf.map((m,i)=>`
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:11px; font-weight:800; color:var(--muted); width:18px; text-align:right">#${i+1}</span>
          <div>
            <div style="font-size:11px; font-weight:700; color:var(--text)">${m.serial_nr} <span style="color:var(--muted); font-weight:400; font-size:10px">${m.cabinet||'—'}</span></div>
            <div style="font-size:10px; color:var(--muted)">${m.locatie} &bull; ${m.mix||'—'}</div>
          </div>
        </div>
        <div style="text-align:right; padding-left:10px;">
          <div style="font-size:13px; font-weight:800; color:var(--green)">${fmt(m.ggr)} RON</div>
          <div style="font-size:10px; color:var(--muted)">Hold: <span style="color:var(--green); font-weight:700">${fmt(m.hold_pct,1)}%</span> &bull; HH: ${fmtK(m.hh)}</div>
        </div>
      </div>`).join('');

    // ── 8. Marketing Score ─────────────────────────────────────────────
    const locMaxIN = Math.max(1,...locations.map(l=>l.total_in/Math.max(1,l.buc)/Math.max(1,l.zile)));
    const locMaxHold = Math.max(1,...locations.map(l=>l.hold_pct||0));

    const mktEl=document.getElementById('an-mkt-score'); if(mktEl) mktEl.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:14px;">
        ${locations.map(l=>{
          const hhRoi = l.hh>0 ? Math.min(5, l.ggr/l.hh) : (l.ggr>0?5:0);
          const roiScore = Math.max(0, (hhRoi/5)*100);
          const holdScore = Math.max(0, ((l.hold_pct||0)/locMaxHold)*100);
          const inPerApDay = l.total_in/Math.max(1,l.buc)/Math.max(1,l.zile);
          const inScore = (inPerApDay/locMaxIN)*100;
          const total = Math.round(roiScore*0.4 + holdScore*0.3 + inScore*0.3);
          const scoreColor = total>=70?'var(--green)':total>=45?'var(--orange)':'var(--red)';
          const tier = total>=70?'A — Excelent':total>=55?'B — Bun':total>=40?'C — Mediu':'D — Slab';
          return `
            <div style="background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:14px 16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-size:12px; font-weight:700; color:var(--text)">${l.locatie}</div>
                <div style="font-size:22px; font-weight:900; color:${scoreColor}">${total}</div>
              </div>
              <div style="font-size:10px; color:${scoreColor}; font-weight:600; margin-bottom:8px">${tier}</div>
              <div style="font-size:10px; color:var(--muted); display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between"><span>ROI HH</span><span style="font-weight:600; color:var(--text)">${Math.round(roiScore)}/100</span></div>
                <div style="display:flex; justify-content:space-between"><span>Hold%</span><span style="font-weight:600; color:var(--text)">${Math.round(holdScore)}/100</span></div>
                <div style="display:flex; justify-content:space-between"><span>IN/ap/zi</span><span style="font-weight:600; color:var(--text)">${Math.round(inScore)}/100</span></div>
              </div>
              <div style="margin-top:8px; background:var(--surface); height:5px; border-radius:3px; overflow:hidden;">
                <div style="width:${total}%; height:100%; background:${scoreColor}; border-radius:3px;"></div>
              </div>
            </div>`;
        }).join('')}
      </div>`;

  } catch(err) {
    console.error('loadAnalize error:', err);
  } finally {
    showLoader(false);
  }
}

// ─── Live Monitor ─────────────────────────────────────────────────────────────
let _liveTimer = null;

async function loadLive() {
  if (!document.getElementById('view-live')?.classList.contains('active')) return;
  try {
    const activeOnly = document.getElementById('live-active-select')?.checked ? 'true' : 'false';
    const lp = locParam(); // returns "&loc_ids=..." or ""
    const baseQs = lp ? lp.slice(1) : '';
    const qs = `?active_only=${activeOnly}` + (baseQs ? `&${baseQs}` : '');
    const d = await api(`/api/live${qs}`);
    const ts = d.ts || '';
    const el = document.getElementById('live-ts');
    if(el) el.textContent = `Ultima actualizare: ${ts} — se reimprospatează la 10s`;
    
    // Update live cards (moved to Live page)
    loadDashboardLiveCard();
    loadTop10Games();

    if (!_liveTimer) {
      _liveTimer = setInterval(loadLive, 30000); 
    }

    const tl = d.totals_live || {};
    const tt = d.totals_today || {};
    const playersToday = d.players_today || 0;

    // ── KPIs ──
    const kpiEl = document.getElementById('live-kpi');
    const svgI = p => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;opacity:.75">${p}</svg>`;
    if(kpiEl) kpiEl.innerHTML = [
      {label:'Aparate Online',    val: tl.total_aparate_online||0,       sub:'activ ultimele 10min', color:'var(--green)',  svg: svgI('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>')},
      {label:'Credite pe Masini', val:`${fmtK((tl.total_credite||0)/100)}`,   sub:'RON credite live',     color:'var(--accent)', svg: svgI('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>')},
      {label:'Bet Mediu Acum',    val:`${fmtK((tl.avg_bet||0)/100)}`,         sub:'RON / aparat',         color:'var(--orange)', svg: svgI('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')},
      {label:'Clienti Azi',       val: playersToday,                     sub:'sessiuni unice',       color:'var(--text)',   svg: svgI('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')},
      {label:'GGR Azi',           val:`${fmtK(tt.ggr_azi||0)}`,         sub:`IN: ${fmtK(tt.total_in_azi||0)}`, color:(tt.ggr_azi||0)>=0?'var(--green)':'var(--red)', svg: svgI('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>')},
    ].map(k=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;text-align:center;display:flex;flex-direction:column;align-items:center;">
        <div style="color:${k.color}">${k.svg}</div>
        <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">${k.label}</div>
        <div style="font-size:22px;font-weight:900;color:${k.color};line-height:1">${k.val}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px">${k.sub}</div>
      </div>`).join('');

    // ── Location Cards (live) ──
    const locEl = document.getElementById('live-loc-cards');
    if(locEl) {
      // Merge live + today audit by locatie
      const auditMap = {};
      (d.audit_today||[]).forEach(a => auditMap[a.locatie] = a);
      locEl.innerHTML = (d.live_locations||[]).map(loc => {
        const aud = auditMap[loc.locatie] || {};
        const ggr = aud.ggr_azi || 0;
        const ggrColor = ggr >= 0 ? 'var(--green)' : 'var(--red)';
        const pct = loc.aparate_online > 0 ? Math.round((loc.cu_card/loc.aparate_online)*100) : 0;
        return `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div style="font-size:14px;font-weight:800;color:var(--text)">${loc.locatie}</div>
              <span style="font-size:9px;font-weight:700;background:rgba(16,185,129,.15);color:var(--green);border-radius:20px;padding:3px 10px;letter-spacing:.05em">● ONLINE</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:14px;">
              <div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
                <div style="font-size:24px;font-weight:900;color:var(--text)">${loc.aparate_online}</div>
                <div style="font-size:10px;color:var(--muted);margin-top:2px;text-transform:uppercase;font-weight:600">Aparate Online</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:10px;text-align:center;">
              <div>
                <div style="font-weight:700;color:${ggrColor};font-size:12px">${fmtK(ggr)}</div>
                <div style="color:var(--muted)">GGR Azi</div>
              </div>
              <div>
                <div style="font-weight:700;color:var(--text);font-size:12px">${fmtK(loc.credite_totale/100)}</div>
                <div style="color:var(--muted)">Credite Live</div>
              </div>
              <div>
                <div style="font-weight:700;color:var(--orange);font-size:12px">${fmtK(loc.bet_mediu/100)}</div>
                <div style="color:var(--muted)">Bet Mediu</div>
              </div>
            </div>
            ${aud.hh_azi > 0 ? `<div style="margin-top:10px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:6px 10px;font-size:10px;color:var(--accent);font-weight:600">HH Azi: ${fmtK(aud.hh_azi)} RON</div>` : ''}
          </div>`;
      }).join('');
    }



    // ── Top machines — paginated table ──
    const countEl = document.getElementById('live-machines-count');
    if(countEl) countEl.textContent = `${(d.top_machines||[]).length} aparate`;
    
    if (!tableStates['live-machines']) tableStates['live-machines'] = { page: 1, limit: 20, rows: [] };
    const machines = d.top_machines || [];
    
    tableStates['live-machines'].rows = machines.map((m, i) => {
      const hasPlayer = m.player_name && !m.player_name.includes('None') && m.player_name.trim();
      const ggrC = (m.ggr_azi||0) >= 0 ? 'var(--green)' : 'var(--red)';
      
      let playerCellHtml = `<span style="color:var(--muted)">—</span>`;
      if (hasPlayer) {
        const pInitials = m.player_name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P';
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#d946ef'];
        const bg = colors[(m.player_id_live || 0) % colors.length];
        playerCellHtml = `
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:24px; height:24px; border-radius:50%; background:${bg}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:9px; flex-shrink:0; overflow:hidden;">
              ${pInitials}
            </div>
            <span style="font-weight:700;color:var(--blue);cursor:pointer;" onclick="openPlayerDetails(${m.player_id_live})">${m.player_name}</span>
          </div>`;
      }
      
      return `
        <tr>
          <td style="padding-left:16px;color:var(--muted);font-weight:700">${i+1}</td>
          <td style="font-weight:800;color:var(--text);white-space:nowrap">${m.serial_nr||'—'}</td>
          <td style="color:var(--muted);white-space:nowrap">${m.locatie||'—'}</td>
          <td style="color:var(--muted);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(m.tip_cabinet||'').replace(/"/g,'')}">${m.tip_cabinet||'—'}</td>
          <td style="color:var(--muted);max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(cleanGameName(m.joc_activ)||'').replace(/"/g,'')}">${cleanGameName(m.joc_activ)||'—'}</td>
          <td style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${playerCellHtml}</td>
          <td class="num" style="text-align:center;color:var(--muted)">${m.pozitie||'—'}</td>
          <td class="num" style="font-weight:900;color:var(--accent);white-space:nowrap">${fmtK(m.credite_ron ?? m.current_credits * (m.denomination || 0.01))}</td>
          <td class="num" style="color:var(--text)">${fmtK(m.bet_ron ?? m.current_bet * (m.denomination || 0.01))}</td>
          <td class="num" style="color:var(--muted)">${m.in_azi>0?fmtK(m.in_azi):'—'}</td>
          <td class="num" style="font-weight:700;color:${ggrC};padding-right:16px">${m.in_azi>0?fmtK(m.ggr_azi):'—'}</td>
        </tr>`;
    });
    renderTablePaginated('live-machines');

  } catch(err) {
    console.error('loadLive error:', err);
  }
}

// Auto-refresh every 30s
function startLiveTimer() {
  if(_liveTimer) clearInterval(_liveTimer);
  _liveTimer = setInterval(() => {
    if(document.getElementById('view-live')?.classList.contains('active')) loadLive();
  }, 30000);
}
startLiveTimer();

// ─── Multigame Report ─────────────────────────────────────────────────────────
window.loadMultigameReport = window.loadMultigame = async function() {
  let { s, e } = getPeriod();
  // Fallback: if dates are missing or wrong format, use today
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!s || !dateRe.test(s)) { const t = new Date(); s = t.toISOString().slice(0,10); }
  if (!e || !dateRe.test(e)) { e = s; }
  const wrap = document.getElementById('mg-table-wrap');
  const kpiEl = document.getElementById('mg-kpi');
  const periodEl = document.getElementById('mg-period');
  if(!wrap) return;

  wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted);font-size:12px">Se incarca...</div>`;

  try {
    const provId = document.getElementById('mg-filter-provider')?.value || '';
    const cabId  = document.getElementById('mg-filter-cabinet')?.value || '';
    const mixName = document.getElementById('mg-filter-mix')?.value || '';
    const mgExtra = (provId ? `&provider_id=${provId}` : '') + (cabId ? `&cabinet_id=${cabId}` : '') + (mixName ? `&mix_name=${encodeURIComponent(mixName)}` : '');
    const data = await api(`/api/multigame?start=${s}&end=${e}${locParam()}${mgExtra}`);
    if(!data || !data.length) {
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">Nu exista date pentru perioada selectata</div>`;
      return;
    }

    // Period label
    if(periodEl) periodEl.textContent = s === e ? s : `${s} — ${e}`;

    // Totals for KPIs
    const totBet  = data.reduce((a,r) => a + r.bet, 0);
    const totGgr  = data.reduce((a,r) => a + r.ggr, 0);
    const totGame = data.reduce((a,r) => a + r.games, 0);
    const totAp   = data.reduce((a,r) => a + r.aparate, 0);
    const avgEdge = totBet > 0 ? (totGgr / totBet * 100) : 0;

    const kpiCard = (label, val, sub, color) =>
      `<div style="padding:14px 16px;border-right:1px solid var(--border);text-align:center;">
        <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${label}</div>
        <div style="font-size:18px;font-weight:900;color:${color}">${val}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${sub}</div>
      </div>`;

    if(kpiEl) kpiEl.innerHTML = [
      kpiCard('Total Jocuri', data.length, 'tipuri distincte', 'var(--text)'),
      kpiCard('Volume Index', fmtK(totBet), 'credite × 0.01 (relativ)', 'var(--text)'),
      kpiCard('GGR Index', fmtK(totGgr), 'relativ', totGgr >= 0 ? 'var(--green)' : 'var(--red)'),
      kpiCard('House Edge', `${avgEdge.toFixed(2)}%`, 'medie ponderata', avgEdge >= 0 ? 'var(--green)' : 'var(--red)'),
      kpiCard('Runde Totale', fmtK(totGame), 'jocuri jucate', 'var(--accent)'),
    ].join('');

    renderTop3Avatars(data);

    // Table
    const thS = `padding:10px 8px;text-align:left;font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;border-bottom:2px solid var(--border);background:var(--surface2)`;
    const thR = `padding:10px 8px;text-align:right;font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;border-bottom:2px solid var(--border);background:var(--surface2)`;

    const maxBet = Math.max(...data.map(r => r.bet));

    wrap.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:900px;">
        <thead>
          <tr>
            <th style="${thS};padding-left:16px;width:28px">#</th>
            <th style="${thS};width:52px"></th>
            <th style="${thS}">Joc</th>
            <th style="${thR}">Ap.</th>
            <th style="${thR}">% Vol.</th>
            <th style="${thR}">House Edge</th>
            <th style="${thR}">GGR Index</th>
            <th style="${thR}">Runde</th>
            <th style="${thR};padding-right:16px">Bet/Runda</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((r, i) => {
            const ggrC   = r.ggr >= 0 ? 'var(--green)' : 'var(--red)';
            const edgeC  = r.house_edge >= 0 ? 'var(--green)' : 'var(--red)';
            const barPct = maxBet > 0 ? Math.round(r.bet / maxBet * 100) : 0;
            const td     = `padding:9px 8px;`;
            const thumb  = gameThumbUrl(r.game, r.game_id);
            return `<tr style="border-bottom:1px solid var(--border)"
              onmouseenter="this.style.background='var(--surface2)'"
              onmouseleave="this.style.background=''">
              <td style="${td}padding-left:16px;color:var(--muted);font-weight:700;font-size:10px">${i+1}</td>
              <td style="${td}width:52px">
                <img src="${thumb}" referrerpolicy="no-referrer" alt="" loading="lazy"
                  style="width:40px;height:40px;object-fit:cover;border-radius:8px;background:var(--surface2);border:1px solid rgba(255,255,255,0.1);"
                  onerror="this.src='slot_icon.png'; this.style.opacity='0.3'">
              </td>
              <td style="${td}min-width:160px">
                <div style="font-weight:700;color:var(--text);cursor:pointer;text-decoration:underline;text-decoration-style:dotted;" onclick="openGameDetails('${(cleanGameName(r.game)||'').replace(/'/g,"\\'")}', '${r.game_id||''}')">${cleanGameName(r.game)}</div>
                <div style="height:3px;background:var(--border);border-radius:2px;margin-top:5px;overflow:hidden">
                  <div style="width:${barPct}%;height:100%;background:var(--accent);border-radius:2px;transition:width .4s"></div>
                </div>
              </td>
              <td style="${td}text-align:right;color:var(--muted)">${r.aparate}</td>
              <td style="${td}text-align:right;font-weight:700;color:var(--accent)">${r.bet_pct ? r.bet_pct.toFixed(1)+'%' : '—'}</td>
              <td style="${td}text-align:right;font-weight:800;color:${edgeC}">${r.house_edge.toFixed(2)}%</td>
              <td style="${td}text-align:right;font-weight:600;color:${ggrC};font-variant-numeric:tabular-nums">${fmtK(r.ggr)}</td>
              <td style="${td}text-align:right;color:var(--muted);font-variant-numeric:tabular-nums">${fmtK(r.games)}</td>
              <td style="${td}text-align:right;color:var(--muted);padding-right:16px">${r.avg_bet > 0 ? r.avg_bet.toFixed(3) : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch(err) {
    console.error('loadMultigame error:', err);
    const isTimeout = err.message && err.message.includes('timeout');
    wrap.innerHTML = `
      <div style="padding:40px;text-align:center;">
        <div style="color:var(--red);font-weight:700;margin-bottom:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Eroare la incarcare
        </div>
        <div style="color:var(--muted);font-size:11px;margin-bottom:12px">${err.message}</div>
        <div style="color:var(--muted);font-size:10px">
          Perioadele lungi (ex: Luna curenta) pot fi lente.<br>
          Incerca <strong>Azi</strong> sau <strong>7 zile</strong> pentru rezultate rapide.
        </div>
      </div>`;
  }
};

window.filterClientiTable = function(q) {
  const norm = str => (str||'').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  q = norm(q);
  const st = tableStates['rep-clienti'];
  if (!st || !st.allRows) return;
  
  if (!q) {
    st.rows = [...st.allRows];
    document.getElementById('clienti-search-counter').style.display = 'none';
  } else {
    st.rows = st.allRows.filter(r => norm(r).includes(q));
    const counter = document.getElementById('clienti-search-counter');
    counter.textContent = `${st.rows.length} rezultate`;
    counter.style.display = 'flex';
  }
  
  st.page = 1;
  renderTablePaginated('rep-clienti');
};

window.closePlayerDashboard_UI = function() {
  document.getElementById('player-dashboard-view').style.display = 'none';
  document.getElementById('rep-page-clienti').style.display = 'block';
  document.getElementById('clienti-main-view').style.display = 'block';
};

window.closePlayerDashboard = function() {
  window.location.hash = 'rapoarte/clienti';
};

window.openPlayerDetails = function(pid) {
  window.location.hash = 'rapoarte/clienti/' + pid;
};

window.openGameDetails = function(gameName, gameId) {
  let hash = 'rapoarte/multigame/game/' + encodeURIComponent(gameName);
  if (gameId) hash += '?id=' + gameId;
  window.location.hash = hash;
};

window.closeGameDetails = function() {
  window.location.hash = 'rapoarte/multigame';
};

window._renderGameDetails = async function(gameName) {
  const gd = document.getElementById('view-game-details');
  if(!gd) return;
  
  // Hide ALL other rep-pages to prevent overlap
  document.querySelectorAll('.rep-page').forEach(p => p.style.display = 'none');
  gd.style.display = 'block';
  
  document.getElementById('gd-name').textContent = gameName;
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const gameId = urlParams.get('id');
  document.getElementById('gd-thumb').src = gameThumbUrl(gameName, gameId);
  document.getElementById('gd-stats-grid').innerHTML = '<div style="grid-column:1/-1; padding:20px; color:var(--muted);">Se încarcă datele...</div>';
  document.getElementById('body-gd-machines').innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--muted);">Se caută aparate...</td></tr>';
  
  try {
    const {s, e} = getPeriod();
    const res = await api(`/api/multigame/details?game_name=${encodeURIComponent(gameName)}&start=${s}&end=${e}`);
    
    if(!res || res.error) {
        document.getElementById('gd-stats-grid').innerHTML = `<div style="grid-column:1/-1; padding:20px; color:var(--red);">${res.error || 'Eroare la preluarea datelor'}</div>`;
        return;
    }
    
    const stats = res.stats || {};
    document.getElementById('gd-stats-grid').innerHTML = `
        <div class="kpi-card" style="padding:12px; border:1px solid var(--border); border-radius:8px;">
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase;">Volume Index</div>
            <div style="font-size:16px; font-weight:800; color:var(--text);">${fmtK(stats.total_bet)}</div>
        </div>
        <div class="kpi-card" style="padding:12px; border:1px solid var(--border); border-radius:8px;">
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase;">GGR Index</div>
            <div style="font-size:16px; font-weight:800; color:${(stats.ggr||0)>=0 ? 'var(--green)' : 'var(--red)'};">${fmtK(stats.ggr)}</div>
        </div>
        <div class="kpi-card" style="padding:12px; border:1px solid var(--border); border-radius:8px;">
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase;">House Edge</div>
            <div style="font-size:16px; font-weight:800; color:var(--accent);">${(stats.house_edge_pct||0).toFixed(2)}%</div>
        </div>
        <div class="kpi-card" style="padding:12px; border:1px solid var(--border); border-radius:8px;">
            <div style="font-size:9px; color:var(--muted); text-transform:uppercase;">Runde</div>
            <div style="font-size:16px; font-weight:800; color:var(--text);">${fmtK(stats.total_games)}</div>
        </div>
    `;
    
    const machs = res.machines || [];
    document.getElementById('gd-mach-count').textContent = `${machs.length} aparate`;
    document.getElementById('body-gd-machines').innerHTML = machs.map((m, i) => `
        <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:12px 24px; color:var(--muted); font-weight:700;">${i+1}</td>
            <td style="padding:12px 16px; font-weight:700; color:var(--text);">${m.serial_nr}</td>
            <td style="padding:12px 16px; color:var(--muted);">${m.location_name}</td>
            <td style="padding:12px 16px; color:var(--muted);">${m.cabinet} <span style="font-size:9px; opacity:0.6;">(${m.manufacturer})</span></td>
            <td style="padding:12px 24px; text-align:right;"><span style="font-size:10px; background:var(--accent); color:#000; padding:4px 10px; border-radius:12px; font-weight:700;">${m.active_mix || '—'}</span></td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--muted);">Niciun aparat găsit pentru acest joc în perioada selectată.</td></tr>';
  } catch(err) {
    console.error('_renderGameDetails error:', err);
    document.getElementById('gd-stats-grid').innerHTML = `<div style="grid-column:1/-1; padding:20px; color:var(--red);">Eroare la încărcare: ${err.message}.<br><span style="font-size:10px; color:var(--muted);">Încearcă o perioadă mai scurtă (ex: Azi sau Ieri).</span></div>`;
    document.getElementById('body-gd-machines').innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--red);">Nu am putut prelua aparatele (Timeout).</td></tr>`;
  }
};


window._renderPlayerDetails = async function(pid) {
  document.getElementById('clienti-main-view').style.display = 'none';
  const pd = document.getElementById('player-dashboard-view');
  pd.style.display = 'block';
  
  document.getElementById('pd-name').textContent = 'Se încarcă...';
  document.getElementById('body-pd-history').innerHTML = '<tr><td colspan="8" style="text-align:center;">Se încarcă datele...</td></tr>';
  
  try {
    const {s, e} = getPeriod();
    let queryParams = '';
    if (s && e) {
      queryParams = `?start=${s}&end=${e}`;
    }
    const res = await api('/api/players/' + pid + queryParams);
    if (!res || !res.sessions) {
      document.getElementById('body-pd-history').innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--red);">Eroare la preluarea datelor jucătorului.</td></tr>';
      return;
    }
    
    // Header Data
    const p = res.player;
    document.getElementById('pd-name').textContent = p.first_name + ' ' + (p.last_name || '');
    document.getElementById('pd-meta').innerHTML = `
      <span style="display:inline-block; background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:12px; border:1px solid var(--border); margin-right:8px; font-weight:600;">ID: <strong style="color:var(--text); font-weight:700;">${p.id}</strong></span>
      <span style="display:inline-block; background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:12px; border:1px solid var(--border); margin-right:8px; font-weight:600;">Tel: <strong style="color:var(--text); font-weight:700;">${p.phone || '—'}</strong></span>
      <span style="display:inline-block; background:rgba(99,102,241,0.1); padding:4px 12px; border-radius:12px; border:1px solid rgba(99,102,241,0.25); font-weight:600;">Card: <strong style="color:var(--accent); font-weight:800;">${p.card_no || '—'}</strong></span>
    `;
    document.getElementById('pd-points').textContent = fmt(p.points, 2);
    
    // Set Player Avatar
    const pInitials = ((p.first_name || '') + ' ' + (p.last_name || '')).split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P';
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#d946ef'];
    const bg = colors[p.id % colors.length];
    const pdAvatar = document.getElementById('pd-avatar');
    if (pdAvatar) {
      pdAvatar.style.background = bg;
      pdAvatar.textContent = pInitials;
    }

    // Dynamic VIP Level & Progress Calculation
    const pts = p.points || 0;
    let lvlName = 'Bronz';
    let lvlEmoji = '🏆';
    let badgeBg = 'linear-gradient(135deg, #cd7f32, #a0522d)'; // Bronze
    let minPts = 0;
    let maxPts = 100;
    let nextLvl = 'ARGINT';
    let statusText = 'Jucător Standard';
    
    if (pts >= 10000) {
      lvlName = 'Diamond';
      lvlEmoji = '👑';
      badgeBg = 'linear-gradient(135deg, #06b6d4, #0891b2)';
      minPts = 10000;
      maxPts = 10000;
      nextLvl = '';
      statusText = 'Jucător de Elită VIP';
    } else if (pts >= 2000) {
      lvlName = 'Platinum';
      lvlEmoji = '💎';
      badgeBg = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
      minPts = 2000;
      maxPts = 10000;
      nextLvl = 'DIAMOND';
      statusText = 'Super VIP';
    } else if (pts >= 500) {
      lvlName = 'Gold';
      lvlEmoji = '🥇';
      badgeBg = 'linear-gradient(135deg, #fbbf24, #d97706)';
      minPts = 500;
      maxPts = 2000;
      nextLvl = 'PLATINUM';
      statusText = 'VIP Gold';
    } else if (pts >= 100) {
      lvlName = 'Silver';
      lvlEmoji = '🥈';
      badgeBg = 'linear-gradient(135deg, #94a3b8, #475569)';
      minPts = 100;
      maxPts = 500;
      nextLvl = 'GOLD';
      statusText = 'Client Argint';
    } else {
      lvlName = 'Bronz';
      lvlEmoji = '🏆';
      badgeBg = 'linear-gradient(135deg, #b45309, #78350f)';
      minPts = 0;
      maxPts = 100;
      nextLvl = 'SILVER';
      statusText = 'Client Bronz';
    }
    
    const range = maxPts - minPts;
    const progressPct = range > 0 ? Math.min(100, Math.max(0, ((pts - minPts) / range) * 100)) : 100;
    const remaining = maxPts - pts;
    
    const lvlTitleEl = document.getElementById('pd-level-title');
    if (lvlTitleEl) lvlTitleEl.textContent = `Nivel ${lvlName}`;
    
    const lvlPointsEl = document.getElementById('pd-level-points');
    if (lvlPointsEl) {
      lvlPointsEl.textContent = range > 0 ? `${fmt(pts, 2)} / ${maxPts} pct` : `${fmt(pts, 2)} pct`;
    }
    
    const prgBarEl = document.getElementById('pd-level-progress-bar');
    if (prgBarEl) prgBarEl.style.width = `${progressPct}%`;
    
    const badgeEl = document.getElementById('pd-level-badge');
    if (badgeEl) {
      badgeEl.style.left = `calc(${progressPct}% - 29px)`;
      badgeEl.style.background = badgeBg;
      badgeEl.textContent = lvlEmoji;
    }
    
    const nextEl = document.getElementById('pd-level-next');
    if (nextEl) {
      nextEl.innerHTML = range > 0 ? `Următorul Nivel: <strong>${nextLvl}</strong> (mai ai ${fmt(remaining, 2)} pct)` : `Ai atins nivelul maxim!`;
    }
    
    const statusEl = document.getElementById('pd-level-status');
    if (statusEl) statusEl.textContent = `Statut: ${statusText}`;
    
    // History Table
    const pgBodyId = 'pd-history';
    if (!tableStates[pgBodyId]) tableStates[pgBodyId] = { page: 1, limit: 10, rows: [] };
    
    if (res.sessions.length === 0) {
      tableStates[pgBodyId].rows = ['<tr><td colspan="8" style="text-align:center; color:var(--muted);">Nicio sesiune recentă de joc.</td></tr>'];
    } else {
      tableStates[pgBodyId].rows = res.sessions.map((s, idx) => {
        const mixName = s.mix ? s.mix.substring(0,25) : 'Mix Necunoscut';
        const prod = s.producator ? s.producator.substring(0,10) : '';
        return `
        <tr>
          <td style="padding-left:16px; width:40px;"><input type="checkbox" class="row-checkbox"></td>
          <td style="width:40px;">${idx+1}</td>
          <td>${s.created_at.substring(0,16)}</td>
          <td>${s.locatie || '—'}</td>
          <td>
            <div style="font-weight:700; color:var(--text);">${s.serial_nr || '—'}</div>
            <div style="font-size:10px; color:var(--muted);">${prod} ${mixName}</div>
          </td>
          <td class="num" style="font-weight:700; color:var(--success);">${fmt(s.points)}</td>
          <td class="num" style="font-weight:800; color:var(--accent);">${fmt(s.total_bet)}</td>
        </tr>
      `});
    }
    renderTablePaginated(pgBodyId);
    
    // Charts Data — use s.counted to avoid double-counting same (machine, day) in daily/hour charts
    let machStats = {};
    let dayStats = {};
    let hourStats = new Array(24).fill(0).map(()=>({in:0, bet:0, ggr:0}));
    let totalIn = 0; let totalOut = 0; let totalGGR = 0; let totalBet = 0;
    
    res.sessions.forEach(s => {
      const points = s.points || 0;
      const sBet = s.total_bet || 0;
      
      const prodMix = (s.mix || s.producator || '');
      const mach = prodMix.trim().length > 2 ? prodMix.trim() : (s.serial_nr || 'Necunoscut');
      if (!machStats[mach]) machStats[mach] = 0;
      machStats[mach] += sBet; // activity metric = Bet on machine days
      
      const day = s.created_at.split(' ')[0].substring(5); // MM-DD
      // Only count unique (machine, day) once in charts to avoid spikes
      if (s.counted !== false) {
        if (!dayStats[day]) dayStats[day] = { in:0, bet:0, ggr:0 };
        dayStats[day].bet += sBet;
        dayStats[day].ggr += points; // re-use ggr field for points in charts
        
        const hr = new Date(s.created_at).getHours();
        if (!isNaN(hr)) {
          hourStats[hr].bet += sBet;
          hourStats[hr].ggr += points;
        }
        
        totalBet += sBet;
        totalGGR += points;
      } else {
        // Still count the day as active even if values are deduplicated
        if (!dayStats[day]) dayStats[day] = { in:0, bet:0, ggr:0 };
      }
    });
    
    // Generate AI Analysis String
    const sortedMachs = Object.keys(machStats).sort((a,b) => machStats[b] - machStats[a]);
    const topMach = sortedMachs[0] || 'N/A';
    
    const peakHour = hourStats.map((h,i) => ({hr:i, val:h.in+Math.abs(h.ggr)})).sort((a,b)=>b.val-a.val)[0].hr;
    let timePref = 'Necunoscut';
    if (peakHour >= 6 && peakHour < 12) timePref = 'Dimineața (06:00 - 12:00)';
    else if (peakHour >= 12 && peakHour < 18) timePref = 'Prânz (12:00 - 18:00)';
    else if (peakHour >= 18 && peakHour < 24) timePref = 'Seara (18:00 - 00:00)';
    else timePref = 'Noaptea (00:00 - 06:00)';
    
    const activeDays = Object.keys(dayStats).length;
    
    let aiText = `Jucătorul are un comportament stabil, fiind activ pe parcursul a <strong>${activeDays} zile</strong> din perioada selectată. `;
    aiText += `Perioada preferată pentru vizite este <strong>${timePref}</strong>. `;
    if (topMach !== 'N/A') aiText += `Aparatul favorit este <strong>${topMach}</strong>. `;
    aiText += `IN total al aparatelor în zilele jucate este de <strong>${fmt(totalIn)} RON</strong>. `;
    aiText += `GGR-ul cumulat al aparatelor în zilele jucate de el este de <strong>${fmt(totalGGR)} RON</strong>.`;
    
    document.getElementById('pd-ai-analysis').innerHTML = aiText;
    
    // Render Mix Chart
    const mixCtx = document.getElementById('pd-mix-chart').getContext('2d');
    if (window.pdMixChart) window.pdMixChart.destroy();
    
    const machLabels = Object.keys(machStats).slice(0,5); // top 5
    const machData = machLabels.map(k => machStats[k]);
    window.pdMixChart = new Chart(mixCtx, {
      type: 'doughnut',
      data: {
        labels: machLabels,
        datasets: [{ data: machData, backgroundColor: CHART_COLORS, borderWidth:0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {color:'#94a3b8'} } } }
    });
    
    // Render Days Chart
    const daysCtx = document.getElementById('pd-days-chart').getContext('2d');
    if (window.pdDaysChart) window.pdDaysChart.destroy();
    
    const dayLabels = Object.keys(dayStats).sort();
    
    window.pdDaysChart = new Chart(daysCtx, {
      type: 'bar',
      data: {
        labels: dayLabels.length ? dayLabels : ['Fără date'],
        datasets: [
          { label:'IN', type: 'bar', data: dayLabels.map(k => dayStats[k].in), backgroundColor: 'rgba(59,130,246,0.5)', borderRadius:4, yAxisID: 'y' },
          { label:'BET', type: 'bar', data: dayLabels.map(k => dayStats[k].bet), backgroundColor: 'rgba(16,185,129,0.5)', borderRadius:4, yAxisID: 'y' },
          { label:'GGR', type: 'line', data: dayLabels.map(k => dayStats[k].ggr), borderColor: 'rgba(245,158,11,1)', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 2, tension: 0.4, fill: true, yAxisID: 'y' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: {
          x: { grid:{display:false}, ticks:{color:'#64748b', font:{size:10}} },
          y: { type: 'linear', display: true, position: 'left', grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#64748b'} }
        }
      }
    });

    // Render Hours Chart
    const hoursCtx = document.getElementById('pd-hours-chart').getContext('2d');
    if (window.pdHoursChart) window.pdHoursChart.destroy();
    
    window.pdHoursChart = new Chart(hoursCtx, {
      type: 'bar',
      data: {
        labels: Array.from({length:24}, (_,i) => i+':00'),
        datasets: [
          { label:'IN', type: 'bar', data: hourStats.map(h => h.in), backgroundColor: 'rgba(59,130,246,0.5)', borderRadius:4 },
          { label:'BET', type: 'bar', data: hourStats.map(h => h.bet), backgroundColor: 'rgba(16,185,129,0.5)', borderRadius:4 },
          { label:'GGR', type: 'line', data: hourStats.map(h => h.ggr), borderColor: 'rgba(245,158,11,1)', borderWidth: 2, tension: 0.4, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: {
          x: { grid:{display:false}, ticks:{color:'#64748b', font:{size:10}} },
          y: { grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#64748b'} }
        }
      }
    });
    
  } catch(e) {
    console.error(e);
    document.getElementById('body-pd-history').innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--red);">Eroare la preluarea datelor jucătorului.</td></tr>';
  }
};

// ─── RAPOARTE: MARKETING ──────────────────────────────────────────────────────────
window.mktEvoChart = null;
window.mktPieChart = null;
window.loadMarketingReport = async function() {
  const {s, e} = getPeriod();
  if(!s || !e) return;
  showLoader(true);
  try {
    const [dDaily, dLoc] = await Promise.all([
      api(`/api/daily?res=day&start=${s}&end=${e}${locParam()}`),
      api(`/api/locations?start=${s}&end=${e}${locParam()}`)
    ]);
    
    // KPIs
    let tCb = 0, tJp = 0, tHh = 0, tRoata = 0, tRaffles = 0, tBet = 0, tMkt = 0;
    
    dLoc.forEach(l => {
      tCb += l.cashback || 0;
      tJp += l.jackpot || 0;
      tHh += l.hh || 0;
      tRoata += l.roata || 0;
      tRaffles += l.raffles || 0;
      tBet += l.bet || 0;
    });
    tMkt = tCb + tJp + tHh + tRoata + tRaffles;

    document.getElementById('mkt-kpi-cb').textContent = fmt(tCb) + ' RON';
    document.getElementById('mkt-kpi-jp').textContent = fmt(tJp) + ' RON';
    document.getElementById('mkt-kpi-hh').textContent = fmt(tHh) + ' RON';
    document.getElementById('mkt-kpi-roata').textContent = fmt(tRoata) + ' RON';
    if(document.getElementById('mkt-kpi-raffles')) document.getElementById('mkt-kpi-raffles').textContent = fmt(tRaffles) + ' RON';

    // Evo Chart
    const labels = dDaily.map(r => r.date.substring(5));
    const cbData = dDaily.map(r => r.cb || 0);
    const jpData = dDaily.map(r => r.jp || 0);
    const hhData = dDaily.map(r => r.hh || 0);
    const roataData = dDaily.map(r => r.roata || 0);
    const raffleData = dDaily.map(r => r.raffles || 0);

    if (window.mktEvoChart) window.mktEvoChart.destroy();
    window.mktEvoChart = new Chart(document.getElementById('mkt-evo-chart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Tombole', data: raffleData, backgroundColor: 'rgba(59, 130, 246, 0.8)' },          // Blue
          { label: 'Roata Norocului', data: roataData, backgroundColor: 'rgba(139, 92, 246, 0.8)' },   // Purple
          { label: 'Jackpot', data: jpData, backgroundColor: 'rgba(245, 158, 11, 0.8)' },              // Amber
          { label: 'Happy Hour', data: hhData, backgroundColor: 'rgba(239, 68, 68, 0.8)' },            // Red
          { label: 'Cashback', data: cbData, backgroundColor: 'rgba(16, 185, 129, 0.8)' }              // Emerald
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } }
        },
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Pie Chart
    if (window.mktPieChart) window.mktPieChart.destroy();
    window.mktPieChart = new Chart(document.getElementById('mkt-pie-chart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Cashback', 'Jackpot', 'Happy Hour', 'Roata Norocului', 'Tombole'],
        datasets: [{
          data: [tCb, tJp, tHh, tRoata, tRaffles],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'right', labels: { color: '#94a3b8' } }
        }
      }
    });

    // Table
    const tbody = document.getElementById('body-mkt-locatii');
    let htm = '';
    dLoc.forEach(l => {
      const lCb = l.cashback || 0;
      const lJp = l.jackpot || 0;
      const lHh = l.hh || 0;
      const lRoata = l.roata || 0;
      const lRaffles = l.raffles || 0;
      const lTot = lCb + lJp + lHh + lRoata + lRaffles;
      const lBet = l.bet || 0;
      const pct = lBet > 0 ? (lTot / lBet * 100).toFixed(2) : 0;
      htm += `<tr>
        <td>${l.locatie}</td>
        <td class="num">${fmt(lBet)}</td>
        <td class="num" style="color:var(--orange)">${fmt(lCb)}</td>
        <td class="num" style="color:var(--yellow)">${fmt(lJp)}</td>
        <td class="num" style="color:var(--pink)">${fmt(lHh)}</td>
        <td class="num" style="color:var(--purple)">${fmt(lRoata)}</td>
        <td class="num" style="color:var(--blue)">${fmt(lRaffles)}</td>
        <td class="num" style="background:var(--surface2); font-weight:bold;">${fmt(lTot)}</td>
        <td class="num" style="color:${pct > 5 ? 'var(--danger)' : 'var(--success)'}">${pct}%</td>
      </tr>`;
    });
    tbody.innerHTML = htm;

    document.getElementById('foot-mkt-locatii').innerHTML = `<tr>
        <td><strong>TOTAL</strong></td>
        <td class="num"><strong>${fmt(tBet)}</strong></td>
        <td class="num" style="color:var(--orange)"><strong>${fmt(tCb)}</strong></td>
        <td class="num" style="color:var(--yellow)"><strong>${fmt(tJp)}</strong></td>
        <td class="num" style="color:var(--pink)"><strong>${fmt(tHh)}</strong></td>
        <td class="num" style="color:var(--purple)"><strong>${fmt(tRoata)}</strong></td>
        <td class="num" style="color:var(--blue)"><strong>${fmt(tRaffles)}</strong></td>
        <td class="num" style="background:var(--surface2); font-weight:bold;"><strong>${fmt(tMkt)}</strong></td>
        <td class="num"><strong>${tBet > 0 ? (tMkt / tBet * 100).toFixed(2) : 0}%</strong></td>
    </tr>`;

  } catch (e) {
    console.error(e);
  }
  showLoader(false);
};

// ─── Clienti Report ─────────────────────────────────────────────────────────
window.loadClientiReport = async function() {
  if(document.getElementById('rep-page-clienti').style.display === 'none') return;
  const {s, e} = getPeriod();
  if(!s || !e) return;
  
  const locId = document.getElementById('global-loc-select')?.value || 'all';
  let p = `start=${s}&end=${e}`;
  if(locId !== 'all') p += `&loc_ids=${locId}`;
  else p += locParam();

  showLoader(true);
  try {
    const data = await api(`/api/players?${p}`);
    if (!tableStates['rep-clienti']) tableStates['rep-clienti'] = { page: 1, limit: 20, rows: [], allRows: [] };
    
    const htmlRows = data.map((r, i) => {
      const pInitials = ((r.first_name || '') + ' ' + (r.last_name || '')).split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P';
      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#d946ef'];
      const bg = colors[r.id % colors.length];
      
      const prev = r.zile_active_anterior || 0;
      const curr = r.zile_active || 0;
      const diff = curr - prev;
      
      let trendHtml = `<span style="font-size:11px; color:var(--muted)">Egal</span>`;
      if (curr > 0 && prev === 0) {
        trendHtml = `<span style="font-size:10px; font-weight:700; background:rgba(16,185,129,0.1); color:var(--green); padding:2px 6px; border-radius:12px;">+ Nou / Revenit</span>`;
      } else if (diff > 0) {
        trendHtml = `<span style="font-size:10px; font-weight:700; background:rgba(16,185,129,0.1); color:var(--green); padding:2px 6px; border-radius:12px;">▲ +${diff} zile</span>`;
      } else if (diff < 0) {
        if (curr === 0) {
          trendHtml = `<span style="font-size:10px; font-weight:700; background:rgba(239,68,68,0.1); color:var(--red); padding:2px 6px; border-radius:12px;">Lipsă totală</span>`;
        } else if (Math.abs(diff) > (prev / 2)) {
          trendHtml = `<span style="font-size:10px; font-weight:700; background:rgba(239,68,68,0.1); color:var(--red); padding:2px 6px; border-radius:12px;">▼ La risc (${diff})</span>`;
        } else {
          trendHtml = `<span style="font-size:10px; font-weight:700; background:rgba(245,158,11,0.1); color:var(--orange); padding:2px 6px; border-radius:12px;">▼ ${diff} zile</span>`;
        }
      }

      return `
      <tr>
        <td style="padding-left:16px; width:40px;"><input type="checkbox" class="row-checkbox"></td>
        <td style="width:40px;">${i+1}</td>
        <td style="text-align:left; cursor:pointer;" onclick="openPlayerDetails(${r.id})">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:32px; height:32px; border-radius:50%; background:${bg}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px; flex-shrink:0; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.2);">
              ${pInitials}
            </div>
            <div>
              <div style="font-weight:700;color:var(--accent); text-decoration:underline;">${r.first_name || 'N/A'} ${r.last_name || ''}</div>
              <div style="font-size:10px;color:var(--muted)">ID: ${r.id}</div>
            </div>
          </div>
        </td>
        <td>${r.phone || '—'}</td>
        <td>${r.locatie || '—'}</td>
        <td class="num">${r.ultima_vizita ? r.ultima_vizita.substring(0, 16) : '—'}</td>
        <td class="num" style="font-weight:700;">${curr}</td>
        <td style="text-align:center;">${trendHtml}</td>
        <td class="num" style="font-weight:700; color:var(--orange);">${r.vizite_pe_zi || 0}</td>
        <td class="num">${r.timp_preferat || '—'}</td>
        <td class="num" style="font-weight:700; color:var(--success);">${fmt(r.total_in_perioada || 0)}</td>
        <td class="num" style="font-weight:700; color:#10b981;">${fmt(r.media_in_pe_zi || 0)}</td>
        <td class="num" style="color:var(--accent); font-weight:700;">${fmt(r.points || 0, 2)}</td>
        <td class="num">${fmt(r.total_bets || 0)}</td>
        <td class="num">${fmt(r.avg_bet || 0, 2)}</td>
      </tr>
      `;
    });
    
    tableStates['rep-clienti'].allRows = htmlRows;
    
    // Apply existing search filter if any
    const searchVal = document.getElementById('clienti-search').value;
    if (searchVal) {
      const norm = str => (str||'').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      tableStates['rep-clienti'].rows = htmlRows.filter(r => norm(r).includes(norm(searchVal)));
    } else {
      tableStates['rep-clienti'].rows = [...htmlRows];
    }
    
    renderTablePaginated('rep-clienti');
  } catch(err) {
    console.error('loadClientiReport error:', err);
    if (!tableStates['rep-clienti']) tableStates['rep-clienti'] = { page: 1, limit: 20, rows: [] };
    tableStates['rep-clienti'].rows = [`<tr><td colspan="15" style="padding:40px;text-align:center;">
        <div style="color:var(--red);font-weight:700;margin-bottom:8px">Eroare la incarcare</div>
        <div style="color:var(--muted);font-size:11px;">${err.message}</div>
      </td></tr>`];
    renderTablePaginated('rep-clienti');
  } finally {
    showLoader(false);
  }
};

// ─── Cashout Report ───────────────────────────────────────────────────────────
window.loadRapoarteCashout = async function() {
  if(document.getElementById('rep-page-cashout').style.display === 'none') return;
  const {s, e} = getPeriod();
  if(!s || !e) return;
  
  const locId = document.getElementById('global-loc-select')?.value || 'all';
  let p = `start=${s}&end=${e}`;
  if(locId !== 'all') p += `&loc_ids=${locId}`;
  else p += locParam();

  showLoader(true);
  try {
    const data = await api(`/api/cashouts?${p}`);
    window._cashoutRawData = data; // store for filtering
    
    // Populate location filter dropdown
    const locSel = document.getElementById('csh-filter-loc');
    if (locSel) {
      const locs = [...new Set(data.map(r => r.locatie).filter(Boolean))].sort();
      locSel.innerHTML = '<option value="">Toate locațiile</option>' + 
        locs.map(l => `<option value="${l}">${l}</option>`).join('');
    }
    
    window.filterCashoutTable();
  } catch(err) {
    console.error('loadRapoarteCashout error:', err);
    if (!tableStates['rep-cashout']) tableStates['rep-cashout'] = { page: 1, limit: 20, rows: [] };
    tableStates['rep-cashout'].rows = [`<tr><td colspan="9" style="padding:40px;text-align:center;">
        <div style="color:var(--red);font-weight:700;margin-bottom:8px">Eroare la incarcare</div>
        <div style="color:var(--muted);font-size:11px;">${err.message}</div>
      </td></tr>`];
    renderTablePaginated('rep-cashout');
  } finally {
    showLoader(false);
  }
};

window.filterCashoutTable = function() {
  const data = window._cashoutRawData || [];
  const q = (document.getElementById('csh-search')?.value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const locF = document.getElementById('csh-filter-loc')?.value || '';
  const tipF = document.getElementById('csh-filter-tip')?.value || '';
  
  if (!tableStates['rep-cashout']) tableStates['rep-cashout'] = { page: 1, limit: 20, rows: [] };
  tableStates['rep-cashout'].page = 1;
  
  const filtered = data.filter(r => {
    const hh = r.hh_ron || 0, jp = r.jackpot_ron || 0, out = r.cashout_ron || 0;
    let tip = 'Cashout';
    if (jp > 0) tip = 'Jackpot';
    if (hh > 0) tip = 'Handpay';
    
    if (locF && r.locatie !== locF) return false;
    if (tipF && tip !== tipF) return false;
    if (q) {
      const haystack = [r.player_name, r.locatie, r.serial_nr, String(r.machine_id), r.producator].join(' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  
  tableStates['rep-cashout'].rows = filtered.map((r, i) => {
    const hh = r.hh_ron || 0, jp = r.jackpot_ron || 0, out = r.cashout_ron || 0;
    let tip = 'Cashout';
    if (jp > 0) tip = 'Jackpot';
    if (hh > 0) tip = 'Handpay';
    const val = Math.max(out, jp, hh);
    const est_in_str = r.est_in > 0 ? fmt(r.est_in) : '—';
    const cTime = r.c_time ? r.c_time.substring(11, 16) : '—';
    const cDate = r.c_date ? r.c_date.split('-').reverse().join('.') : '—';
    const tipColor = tip === 'Jackpot' ? 'var(--yellow)' : tip === 'Handpay' ? 'var(--pink)' : 'var(--muted)';
    
    // Deduplicate game name if the DB has it duplicated (e.g., "Flaming HotFlaming Hot")
    let cjoc = cleanGameName(r.joc || '');
    
    const mixInfo = [r.mix, r.cabinet, cjoc].filter(Boolean).join(' · ');
    return `<tr>
      <td style="padding-left:16px;"><input type="checkbox" class="row-checkbox"></td>
      <td>${i+1}</td>
      <td>
        <div style="font-weight:700;color:var(--text)">${cDate}</div>
        <div style="font-size:10px;color:var(--muted)">${cTime}</div>
      </td>
      <td><div style="font-weight:700;color:var(--text)">${(r.player_name||'Necunoscut').trim()}</div></td>
      <td>${r.locatie || '—'}</td>
      <td>
        <div style="font-weight:700;color:var(--text)">#${r.machine_id} (SN: ${r.serial_nr || '?'})</div>
        <div style="font-size:10px;color:var(--accent);font-weight:600">${r.mix || r.producator || '—'}</div>
        <div style="font-size:10px;color:var(--muted)">${r.cabinet || ''}${cjoc ? ' · ' + cjoc : ''}</div>
      </td>
      <td class="num" style="color:var(--red); font-weight:700;">-${fmt(val)}</td>
      <td><div style="display:inline-block; padding:2px 8px; border-radius:12px; background:var(--surface2); border:1px solid ${tipColor}; color:${tipColor}; font-size:10px; font-weight:700;">${tip}</div></td>
      <td class="num" style="color:var(--green); font-weight:700;">${est_in_str}</td>
    </tr>`;
  });

  const counter = document.getElementById('csh-search-counter');
  if (counter) {
    if (q) {
      counter.textContent = `${filtered.length} rezultate`;
      counter.style.display = 'flex';
    } else {
      counter.style.display = 'none';
    }
  }

  renderTablePaginated('rep-cashout');
};

window.exportCashoutExcel = window.exportCashoutCSV = function() {
  const data = window._cashoutRawData || [];
  let html = '<html><head><meta charset="UTF-8"></head><body><table border="1">';
  html += '<tr><th>Data</th><th>Ora</th><th>Jucator</th><th>Locatie</th><th>Aparat</th><th>SN</th><th>Mix</th><th>Cabinet</th><th>Joc</th><th>Suma RON</th><th>Tip</th><th>Est. IN RON</th></tr>';
  data.forEach(r => {
    const hh = r.hh_ron||0, jp = r.jackpot_ron||0, out = r.cashout_ron||0;
    let tip = 'Cashout'; if (jp>0) tip='Jackpot'; if (hh>0) tip='Handpay';
    html += `<tr><td>${r.c_date||''}</td><td>${(r.c_time||'').substring(11,16)}</td><td>${(r.player_name||'Necunoscut').trim()}</td><td>${r.locatie||''}</td><td>${r.machine_id||''}</td><td>${r.serial_nr||''}</td><td>${r.mix||''}</td><td>${r.cabinet||''}</td><td>${r.joc||''}</td><td>${Math.max(out,jp,hh)}</td><td>${tip}</td><td>${r.est_in||0}</td></tr>`;
  });
  html += '</table></body></html>';
  const blob = new Blob(['\ufeff' + html], {type: 'application/vnd.ms-excel;charset=UTF-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `cashout_${new Date().toISOString().slice(0,10)}.xls`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ─── POS DEPOSITS REPORT ──────────────────────────────────────────────────────
let _posData = null;

window.loadPosReport = async function() {
  const { s, e } = getPeriod();
  if (!s || !e) return;
  
  const tbody = document.getElementById('body-pos');
  const thead = document.getElementById('head-pos');
  const tfoot = document.getElementById('foot-pos');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--muted); padding:30px;">Se încarcă...</td></tr>';
  
  try {
    const data = await api(`/api/reports/pos?start=${s}&end=${e}${locParam()}`);
    _posData = data;
    
    const locs = data.locations || [];
    const days = data.days || [];
    
    // KPI
    let grandTotal = 0, totalTrx = 0;
    days.forEach(d => {
      locs.forEach(loc => {
        const cell = d.locations[loc] || {};
        grandTotal += cell.amount || 0;
        totalTrx += cell.count || 0;
      });
    });
    
    const numDays = days.length;
    const avgPerDay = numDays > 0 ? grandTotal / numDays : 0;
    
    const el = id => document.getElementById(id);
    if (el('pos-kpi-total')) el('pos-kpi-total').textContent = fmt(grandTotal);
    if (el('pos-kpi-avg')) el('pos-kpi-avg').textContent = fmt(avgPerDay);
    if (el('pos-kpi-trx')) el('pos-kpi-trx').textContent = totalTrx.toLocaleString('ro-RO');
    if (el('pos-kpi-days')) el('pos-kpi-days').textContent = numDays;
    
    // Footer - totals per location (unchanged logic, just keep it here before sort)
    if (tfoot) {
      let footHtml = '<tr style="font-weight:700;"><td colspan="2">TOTAL</td>';
      let footGrand = 0;
      locs.forEach(loc => {
        let locTotal = 0;
        days.forEach(d => { locTotal += (d.locations[loc] || {}).amount || 0; });
        footGrand += locTotal;
        footHtml += `<td class="num">${fmt(locTotal)}</td>`;
      });
      footHtml += `<td class="num" style="font-weight:800;">${fmt(footGrand)}</td></tr>`;
      tfoot.innerHTML = footHtml;
    }

    // Keep existing sort from variables, just render
    renderPosBody();
    
  } catch(err) {
    console.error('Eroare loadPosReport:', err);
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--danger);">Eroare la încărcarea datelor POS: ' + (err.message || err) + '</td></tr>';
  }
};

let _posSortCol = localStorage.getItem('posSortCol') || 'date';
let _posSortAsc = localStorage.getItem('posSortAsc') === null ? false : localStorage.getItem('posSortAsc') === 'true';

window.sortPos = function(col) {
  if (_posSortCol === col) {
    _posSortAsc = !_posSortAsc;
  } else {
    _posSortCol = col;
    _posSortAsc = false; // Default to descending for dates and metrics
  }
  localStorage.setItem('posSortCol', _posSortCol);
  localStorage.setItem('posSortAsc', _posSortAsc);
  renderPosBody();
};

function renderPosBody() {
  if (!_posData) return;
  const tbody = document.getElementById('body-pos');
  const thead = document.getElementById('head-pos');
  
  const locs = _posData.locations || [];
  let days = [...(_posData.days || [])];
  
  // Sort days
  days.sort((a, b) => {
    let valA, valB;
    if (_posSortCol === 'date') {
      const partsA = a.date.split('.');
      const partsB = b.date.split('.');
      valA = new Date(`${partsA[2]}-${partsA[1]}-${partsA[0]}`).getTime();
      valB = new Date(`${partsB[2]}-${partsB[1]}-${partsB[0]}`).getTime();
    } else if (_posSortCol === 'total') {
      valA = 0; locs.forEach(l => valA += (a.locations[l] || {}).amount || 0);
      valB = 0; locs.forEach(l => valB += (b.locations[l] || {}).amount || 0);
    } else {
      valA = (a.locations[_posSortCol] || {}).amount || 0;
      valB = (b.locations[_posSortCol] || {}).amount || 0;
    }
    
    if (valA < valB) return _posSortAsc ? -1 : 1;
    if (valA > valB) return _posSortAsc ? 1 : -1;
    return 0;
  });

  // Rebuild header
  if (thead) {
    const arr = _posSortAsc ? '↑' : '↓';
    let thHtml = '<tr><th style="text-align:center; width:40px;">Nr.</th>';
    thHtml += `<th style="cursor:pointer;" onclick="sortPos('date')">Data ${_posSortCol === 'date' ? arr : '↕'}</th>`;
    locs.forEach(loc => { 
      thHtml += `<th class="num" style="cursor:pointer;" onclick="sortPos('${loc}')">${loc} ${_posSortCol === loc ? arr : '↕'}</th>`; 
    });
    thHtml += `<th class="num" style="font-weight:800; cursor:pointer;" onclick="sortPos('total')">TOTAL ${_posSortCol === 'total' ? arr : '↕'}</th></tr>`;
    thead.innerHTML = thHtml;
  }

  let bodyHtml = '';
  if (days.length === 0) {
    bodyHtml = `<tr><td colspan="${locs.length + 3}" style="text-align:center; color:var(--muted); padding:30px;">Nu sunt date POS pentru perioada selectată.</td></tr>`;
  } else {
    days.forEach((d, idx) => {
      let rowTotal = 0;
      let cells = '';
      locs.forEach(loc => {
        const cell = d.locations[loc] || {};
        const amt = cell.amount || 0;
        const totalIn = cell.total_in || 0;
        rowTotal += amt;
        
        let pctStr = '';
        if (totalIn > 0 && amt > 0) {
            const pct = (amt / totalIn) * 100;
            pctStr = `<div style="font-size:10px; color:var(--muted); margin-top:2px;">${pct.toFixed(2)}%</div>`;
        }
        
        cells += `<td class="num">${amt > 0 ? fmt(amt) + pctStr : '<span style="color:var(--muted)">—</span>'}</td>`;
      });
      bodyHtml += `<tr>
        <td style="text-align:center; color:var(--muted); font-size:11px;">${idx + 1}</td>
        <td style="white-space:nowrap;">${d.date}</td>
        ${cells}
        <td class="num" style="font-weight:700;">${fmt(rowTotal)}</td>
      </tr>`;
    });
  }
  if (tbody) tbody.innerHTML = bodyHtml;
}

window.exportPosExcel = function() {
  if (!_posData || !_posData.days || _posData.days.length === 0) return;
  const locs = _posData.locations || [];
  const days = _posData.days || [];
  
  const aoa = [];
  aoa.push(['Nr.', 'Data', ...locs, 'TOTAL']);

  days.forEach((d, idx) => {
    let rowTotal = 0;
    let vals = [];
    locs.forEach(loc => {
      const amt = (d.locations[loc] || {}).amount || 0;
      rowTotal += amt;
      vals.push(amt);
    });
    aoa.push([idx+1, d.date, ...vals, rowTotal]);
  });
  
  let footVals = [];
  let footGrand = 0;
  locs.forEach(loc => {
    let t = 0;
    days.forEach(d => { t += (d.locations[loc] || {}).amount || 0; });
    footGrand += t;
    footVals.push(t);
  });
  aoa.push(['', 'TOTAL', ...footVals, footGrand]);
  
  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Depuneri POS");
    XLSX.writeFile(wb, `POS_Depuneri_${_posData.days[0]?.date || 'export'}.xlsx`);
  } else {
    // Fallback in case XLSX failed to load
    let csv = 'Nr.,Data,' + locs.join(',') + ',TOTAL\n';
    for (let i = 1; i < aoa.length; i++) {
      csv += aoa[i].join(',') + '\n';
    }
    const blob = new Blob(['\uFEFF' + csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `POS_Depuneri_${_posData.days[0]?.date || 'export'}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};


// ─── AUTHENTICATION & ADMIN ───────────────────────────────────────────────────

let currentUser = null;
let allUsers = [];
let allSlots = [];

async function apiAuth(url, options = {}) {
  const token = localStorage.getItem('cp2_token');
  if (token) {
    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  const res = await fetch(url, options);
  if (res.status === 401) {
    console.warn('Unauthorized access to:', url);
    // Only logout if we already had a token and it's definitely invalid
    if (token) {
       // Optional: only logout on specific endpoints or if this isn't the initial check
       // For now, let's keep it but add logging
       logout(false);
    }
    throw new Error('Unauthorized');
  }
  return res.json();
}

async function checkAuth() {
  const token = localStorage.getItem('cp2_token');
  if (!token) {
    console.log('No token found, redirecting to login');
    document.getElementById('view-login').style.display = 'flex';
    const appEl = document.getElementById('app');
    if (appEl) appEl.style.display = 'none';
    const globalHeader = document.getElementById('global-header');
    if (globalHeader) globalHeader.style.display = 'none';
    const appBody = document.getElementById('app-body');
    if (appBody) appBody.style.display = 'none';
    const sb = document.querySelector('.sidebar');
    if (sb) sb.style.display = 'none';
    return;
  }
  try {
    currentUser = await apiAuth('/api/me');
    console.log('Auth check success:', currentUser.email);
    document.getElementById('view-login').style.display = 'none';
    const appEl = document.getElementById('app');
    if (appEl) appEl.style.display = 'flex';
    const globalHeader = document.getElementById('global-header');
    if (globalHeader) globalHeader.style.display = 'flex';
    const appBody = document.getElementById('app-body');
    if (appBody) appBody.style.display = 'flex';
    const sb = document.querySelector('.sidebar');
    if (sb) sb.style.display = 'flex';
    
    await loadFilters();
    
    document.getElementById('user-profile').style.display = 'flex';
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-role').textContent = currentUser.role;
    
    // Set initials or Avatar
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    // Process Permissions
    let perms = { pages: [], locations: [], avatar: '' };
    if (currentUser.permissions) {
      try { perms = JSON.parse(currentUser.permissions); } catch(e) { console.error('Perms Parse Error:', e); }
    }
    if (perms.theme && ['light', 'dark'].includes(perms.theme)) {
      document.documentElement.setAttribute('data-theme', perms.theme);
      localStorage.setItem('theme', perms.theme);
      Chart.defaults.color = perms.theme === 'light' ? '#64748b' : '#94a3b8';
      Chart.defaults.borderColor = perms.theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.06)';
    }
    
    const avatarEl = document.getElementById('user-avatar');
    if (perms.avatar) {
      currentUser.avatar = perms.avatar; // cache it
      avatarEl.style.backgroundImage = `url('${perms.avatar}')`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.textContent = '';
    } else {
      avatarEl.style.backgroundImage = 'none';
      avatarEl.textContent = initials;
    }
    
    // Hide admin sections if not Super Admin, except on localhost for local development
    const adminLinks = document.querySelectorAll('a[href^="#admin"]');
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (currentUser.role !== 'Super Admin' && !isLocalHost) {
      adminLinks.forEach(el => el.style.display = 'none');
      document.querySelector('.nav-section-title').style.display = 'none';
      
      // Hide non-admin pages based on permissions
      if (perms.pages && perms.pages.length > 0) {
        document.querySelectorAll('a.nav-item').forEach(link => {
          if (link.getAttribute('href').startsWith('#admin')) return;
          const pageId = link.getAttribute('href').replace('#', '');
          if (!perms.pages.includes(pageId)) {
            link.style.display = 'none';
          }
        });
        // Auto-redirect if current hash is not allowed
        const currentHash = window.location.hash.replace('#', '') || 'dashboard';
        const mainHash = currentHash.split('/')[0];
        const isManagerFloorplan = (mainHash === 'admin-floorplan' && currentUser.role === 'Manager');
        if (!perms.pages.includes(mainHash) && perms.pages.length > 0 && !isManagerFloorplan) {
          window.location.hash = '#' + perms.pages[0];
        }
      }
    } else {
      adminLinks.forEach(el => el.style.display = 'flex');
      document.querySelector('.nav-section-title').style.display = 'block';
      if (isLocalHost) {
        document.querySelectorAll('a.nav-item').forEach(link => {
          link.style.display = '';
        });
      }
    }
  } catch (err) {
    // handled by apiAuth
  }
}

window.toggleLoginPassword = function() {
  const pwd = document.getElementById('login-password');
  const icon = document.getElementById('login-eye-icon');
  if (pwd.type === 'password') {
    pwd.type = 'text';
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } else {
    pwd.type = 'password';
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
}

window.doLogin = async function(e) {
  if (e) e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const pwd = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember')?.checked;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({email, password: pwd})
    });
    const data = await res.json();
    if (data.error) {
      errEl.textContent = data.error;
    } else {
      localStorage.setItem('cp2_token', data.token);
      if (remember) {
        localStorage.setItem('cp2_saved_email', email);
        localStorage.setItem('cp2_saved_pwd', pwd);
      } else {
        localStorage.removeItem('cp2_saved_email');
        localStorage.removeItem('cp2_saved_pwd');
      }
      await checkAuth();
      if (currentUser) {
        await loadBNR();
        const savedS = localStorage.getItem('cp2_start');
        const savedE = localStorage.getItem('cp2_end');
        if (savedS && savedE) {
          document.getElementById('native-date-start').value = savedS;
          document.getElementById('native-date-end').value = savedE;
          document.getElementById('date-start').value = savedS;
          document.getElementById('date-end').value = savedE;
          document.getElementById('tl-range-display').textContent = `${savedS} ➔ ${savedE}`;
          const savedP = localStorage.getItem('cp2_preset');
          if (savedP) {
            document.querySelectorAll('.preset-btn').forEach(b => {
              b.classList.toggle('active', b.dataset.preset === savedP);
            });
          }
        } else {
          applyPreset('month');
        }
        window.dispatchEvent(new Event('hashchange'));
      }
    }
  } catch (err) {
    errEl.textContent = 'Eroare retea. Verifica daca serverul ruleaza.';
  }
};

// Pre-fill saved email on login page
(function() {
  const saved = localStorage.getItem('cp2_saved_email');
  const savedPwd = localStorage.getItem('cp2_saved_pwd');
  if (saved) {
    const el = document.getElementById('login-email');
    const rem = document.getElementById('login-remember');
    const pwdEl = document.getElementById('login-password');
    if (el) el.value = saved;
    if (pwdEl && savedPwd) pwdEl.value = savedPwd;
    if (rem) { rem.checked = true; rem.dispatchEvent(new Event('change')); }
  }
})();

window.logout = function(callApi = true) {
  console.log('Logging out, callApi:', callApi);
  if (callApi) {
    apiAuth('/api/logout', {method: 'POST'}).catch(e=>e);
  }
  localStorage.removeItem('cp2_token');
  window.location.hash = '';
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.display = 'none';
  document.getElementById('view-login').style.display = 'flex';
  document.getElementById('view-register').style.display = 'none';
  currentUser = null;
};

// ─── ADMIN UTILIZATORI ────────────────────────────────────────────────────────
async function loadAdminUtilizatori() {
  try {
    const [usersRes, invRes] = await Promise.all([
      apiAuth('/api/users'),
      apiAuth('/api/invitations').catch(e => [])
    ]);
    allUsers = usersRes || [];
    window.allInvitations = Array.isArray(invRes) ? invRes : [];
    renderUtilizatori();
  } catch(e) { console.error(e); }
}

function renderUtilizatori() {
  if (!tableStates['admin-utilizatori']) {
    tableStates['admin-utilizatori'] = { page: 1, limit: 20, rows: [] };
  }
  
  let rows = [];
  let index = 1;
  
  (window.allInvitations || []).forEach(inv => {
    rows.push(`
      <tr style="background: rgba(245,158,11,0.05);">
        <td style="padding-left:16px;"><input type="checkbox" class="row-checkbox"></td>
        <td>${index++}</td>
        <td>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:32px; height:32px; border-radius:50%; background:var(--orange); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">⏳</div>
            <div>
              <strong style="color:var(--orange)">Invitație în așteptare</strong>
              <div style="font-size:10px; color:var(--muted)">Generat: ${new Date(inv.created_at).toLocaleDateString('ro-RO')}</div>
            </div>
          </div>
        </td>
        <td>${inv.email}</td>
        <td>—</td>
        <td><span class="badge" style="background:var(--surface2)">${inv.role}</span></td>
        <td>Limitat</td>
        <td style="text-align:right; padding-right:16px;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn-primary" style="padding:4px 8px; font-size:10px;" onclick="copyInv('${inv.code}')" title="Copiază Link">Copiază Link</button>
            <button class="tahoe-icon-btn" onclick="deleteInv('${inv.code}')" title="Șterge Invitația" style="color:#ef4444; border-color:rgba(239,68,68,0.2);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `);
  });

  (allUsers || []).forEach((u) => {
    const initials = (u.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    rows.push(`
      <tr>
        <td style="padding-left:16px;"><input type="checkbox" class="row-checkbox"></td>
        <td>${index++}</td>
        <td>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:32px; height:32px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">${initials}</div>
            <strong>${u.name}</strong>
          </div>
        </td>
        <td>${u.email}</td>
        <td>${u.phone || '—'}</td>
        <td><span class="badge" style="background:var(--surface2)">${u.role}</span></td>
        <td>Toate (Default)</td>
        <td style="text-align:right; padding-right:16px;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="tahoe-icon-btn" onclick="openEditUserModal(${u.id})" title="Editează">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            ${u.email !== 'jeka7ro@gmail.com' ? `
            <button class="tahoe-icon-btn" onclick="deleteUser(${u.id})" title="Șterge" style="color:#ef4444; border-color:rgba(239,68,68,0.2);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `);
  });
  
  tableStates['admin-utilizatori'].rows = rows;
  renderTablePaginated('admin-utilizatori');
}

window.copyInv = function(code) {
  const link = window.location.origin + window.location.pathname + '#invite/' + code;
  navigator.clipboard.writeText(link).then(() => showAlert('Link copiat!'));
}

window.deleteInv = async function(code) {
  if (!confirm('Ștergi această invitație?')) return;
  try {
    await apiAuth('/api/invitations/' + code, {method: 'DELETE'});
    loadAdminUtilizatori();
  } catch(e) {}
}

function openUserModal() {
  const locsContainer = document.getElementById('nu-locs-container');
  if (locsContainer && filtersData && filtersData.locations) {
    locsContainer.innerHTML = filtersData.locations.map(l => `
      <label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer;">
        <input type="checkbox" class="nu-loc-cb" value="${l.id}" checked> ${l.name}
      </label>
    `).join('');
  }
  document.getElementById('user-modal').classList.add('show');
}

window.handleAvatarUpload = function(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('eu-avatar').value = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.openEditUserModal = function(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;
  document.getElementById('eu-id').value = u.id;
  const parts = (u.name || '').split(' ');
  document.getElementById('eu-nume').value = parts[0] || '';
  document.getElementById('eu-prenume').value = parts.slice(1).join(' ') || '';
  document.getElementById('eu-email').value = u.email || '';
  document.getElementById('eu-phone').value = u.phone || '';
  const roleSelect = document.getElementById('eu-role');
  if (roleSelect) roleSelect.value = u.role || 'Viewer';
  const pwdInput = document.getElementById('eu-password');
  if (pwdInput) pwdInput.value = '';
  const avatarInput = document.getElementById('eu-avatar');
  if (avatarInput) avatarInput.value = u.avatar || '';
  const locsContainer = document.getElementById('eu-locs-container');
  if (locsContainer) {
    const locList = (filtersData && filtersData.locations) ? filtersData.locations : [];
    locsContainer.innerHTML = locList.map(l => `
      <label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer; width:calc(50% - 12px);">
        <input type="checkbox" class="eu-loc-cb" value="${l.id}"> ${l.name}
      </label>
    `).join('');
  }
  let perms = { pages: [], locations: [] };
  if (u.permissions) { 
    try { 
      const p = JSON.parse(u.permissions);
      if (p) {
        perms.pages = p.pages || [];
        perms.locations = p.locations || [];
      }
    } catch(e) { console.error('Perms Parse Error:', e); } 
  }
  document.querySelectorAll('.eu-page-cb').forEach(cb => { 
    cb.checked = perms.pages && perms.pages.includes(cb.value); 
  });
  document.querySelectorAll('.eu-loc-cb').forEach(cb => { 
    cb.checked = perms.locations && perms.locations.includes(parseInt(cb.value, 10)); 
  });
  document.getElementById('edit-user-modal').classList.add('show');
};

window.saveEditedUser = async function() {
  const id = document.getElementById('eu-id').value;
  const nume = document.getElementById('eu-nume').value.trim();
  const prenume = document.getElementById('eu-prenume').value.trim();
  const email = document.getElementById('eu-email').value.trim();
  const phone = document.getElementById('eu-phone').value.trim();
  const role = document.getElementById('eu-role').value;
  const new_password = document.getElementById('eu-password').value.trim();
  const avatarInput = document.getElementById('eu-avatar');
  const avatar = avatarInput ? avatarInput.value.trim() : '';
  const pages = Array.from(document.querySelectorAll('.eu-page-cb:checked')).map(cb => cb.value);
  const locations = Array.from(document.querySelectorAll('.eu-loc-cb:checked')).map(cb => parseInt(cb.value, 10));
  const permissions = JSON.stringify({ pages, locations, avatar });
  const name = nume + (prenume ? ' ' + prenume : '');
  if (!nume || !email) return showAlert('Numele și Email-ul sunt obligatorii!');
  const body = { name, email, phone, role, permissions };
  if (new_password) {
    body.new_password = new_password;
  }
  
  try {
    const res = await apiAuth(`/api/users/${id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    if (res.error) showAlert(res.error);
    else {
      document.getElementById('edit-user-modal').classList.remove('show');
      loadAdminUtilizatori();
      if (id == currentUser.id) {
        currentUser.name = name; currentUser.phone = phone; currentUser.avatar = avatar;
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const avatarEl = document.getElementById('user-avatar');
        if (avatar) {
          avatarEl.style.backgroundImage = `url('${avatar}')`;
          avatarEl.style.backgroundSize = 'cover';
          avatarEl.style.backgroundPosition = 'center';
          avatarEl.textContent = '';
        } else {
          avatarEl.style.backgroundImage = 'none';
          avatarEl.textContent = initials;
        }
        document.getElementById('user-name').textContent = name;
      }
    }
  } catch(e) { console.error(e); }
};

function deleteUser(id) {
  showConfirm("Sigur ștergi acest utilizator?", async () => {
    try { await apiAuth(`/api/users/${id}`, {method: 'DELETE'}); loadAdminUtilizatori(); } catch(e) { console.error(e); }
  });
}

// ─── ADMIN SLOTURI ────────────────────────────────────────────────────────────
async function loadAdminSloturi() {
  showLoader(true);
  try { allSlots = await apiAuth('/api/slots/inventory'); renderSloturi(); } catch(e) { console.error(e); }
  showLoader(false);
}

window.renderSloturi = function() {
  const q = document.getElementById('slot-search')?.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
  const globalLocEl = document.getElementById('global-loc-select');
  const locId = globalLocEl ? globalLocEl.value : '';
  if (!tableStates['admin-sloturi']) tableStates['admin-sloturi'] = { page: 1, limit: 50, rows: [] };
  let filtered = allSlots.filter(s => {
    if (locId && locId !== 'all' && String(s.location_id) !== String(locId)) return false;
    if (q) {
      const txt = `${s.serial_nr} ${s.locatie} ${s.mix} ${s.provider} ${s.cabinet}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!txt.includes(q)) return false;
    }
    return true;
  });
  tableStates['admin-sloturi'].rows = filtered.map((s, i) => {
    const hold = s.rto_pct ? s.rto_pct.toFixed(2) + '%' : '—';
    const rc = s.last_ram_clear && s.last_ram_clear !== '—' ? s.last_ram_clear : 'Niciodată';
    const notesCount = (s.notes || []).length;
    const filesCount = (s.files || []).length;
    return `<tr>
      <td style="padding-left:16px"><input type="checkbox" class="row-checkbox"></td>
      <td>${i+1}</td>
      <td><strong>${s.locatie||'—'}</strong></td>
      <td>${s.slot_machine_id||'—'}</td>
      <td>${s.provider||'—'}</td>
      <td>${s.cabinet||'—'}</td>
      <td>${s.mix||'—'}</td>
      <td class="num">${hold}</td>
      <td>${rc}</td>
      <td>
        <div style="display:flex;gap:8px;align-items:center;">
          <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${notesCount>0?'#3b82f6':'var(--surface2)'};color:${notesCount>0?'#fff':'var(--muted)'};position:relative;" title="Notițe">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path></svg>
            ${notesCount>0?`<span style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:9px;font-weight:bold;width:14px;height:14px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${notesCount}</span>`:''}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${filesCount>0?'#eab308':'var(--surface2)'};color:${filesCount>0?'#000':'var(--muted)'};position:relative;" title="Fișiere">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            ${filesCount>0?`<span style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:9px;font-weight:bold;width:14px;height:14px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${filesCount}</span>`:''}
          </div>
        </div>
      </td>
      <td style="text-align:right;padding-right:16px;">
        <button class="tahoe-icon-btn" onclick='openSlotDetails(${JSON.stringify(s).replace(/'/g,"&#39;")})' title="Detalii">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
      </td>
    </tr>`;
  });

  const counter = document.getElementById('slot-search-counter');
  if (counter) {
    if (q) {
      counter.textContent = `${filtered.length} rezultate`;
      counter.style.display = 'flex';
    } else {
      counter.style.display = 'none';
    }
  }

  renderTablePaginated('admin-sloturi');
};


window.openSlotDetails = function(s) {
  document.getElementById('slot-modal-title').textContent = `Slot: ${s.slot_machine_id} - ${s.locatie}`;
  
  let html = `
    <div style="display:flex; gap:20px; margin-bottom:20px;">
      <div style="flex:1;">
        <div style="font-size:10px; color:var(--muted)">Cabinet</div>
        <div style="font-weight:700">${s.cabinet || '-'}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:10px; color:var(--muted)">Mix / Joc</div>
        <div style="font-weight:700">${s.mix || '-'}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:10px; color:var(--muted)">Exp. TVA</div>
        <div style="font-weight:700">${s.tva_expiration_date || '-'}</div>
      </div>
    </div>
    
    <div style="border-top:1px solid var(--border); padding-top:16px; margin-bottom:16px;">
      <h4 style="margin-bottom:12px;">Notițe</h4>
      <div id="slot-notes-list" style="margin-bottom:12px; max-height:150px; overflow-y:auto;">
        ${(s.notes||[]).map(n => `<div style="background:var(--surface2); padding:8px; border-radius:4px; margin-bottom:8px; font-size:11px;">
          <div style="color:var(--muted); font-size:9px; margin-bottom:4px;">${n.created_at}</div>
          <div>${n.note}</div>
        </div>`).join('')}
      </div>
      <div style="display:flex; gap:8px;">
        <input type="text" id="new-slot-note" class="glass-select" placeholder="Notiță nouă..." style="flex:1; padding:8px;">
        <button class="glass-btn active" onclick="addSlotNote(${s.id})" style="padding:8px 12px;">Adaugă</button>
      </div>
    </div>

    <div style="border-top:1px solid var(--border); padding-top:16px;">
      <h4 style="margin-bottom:12px;">Fișiere & PDF</h4>
      <div id="slot-files-list" style="margin-bottom:12px;">
        ${(s.files||[]).map(f => `<div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface2); padding:8px; border-radius:4px; margin-bottom:8px; font-size:11px;">
          <a href="/${f.filepath}" target="_blank" style="color:var(--accent); text-decoration:none;">📄 ${f.filename}</a>
          <span style="color:var(--muted); font-size:9px;">${f.created_at}</span>
        </div>`).join('')}
      </div>
      <div style="display:flex; gap:8px;">
        <input type="file" id="new-slot-file" class="glass-select" style="flex:1; padding:4px;" accept=".pdf,.png,.jpg">
        <button class="glass-btn active" onclick="uploadSlotFile(${s.id})" style="padding:8px 12px;">Upload</button>
      </div>
    </div>
  `;
  
  document.getElementById('slot-modal-body').innerHTML = html;
  document.getElementById('slot-modal').classList.add('show');
}

window.addSlotNote = async function(mid) {
  const note = document.getElementById('new-slot-note').value;
  if (!note) return;
  try {
    await apiAuth(`/api/slots/${mid}/notes`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({note})
    });
    // reload slots and re-open modal
    await loadAdminSloturi();
    const s = allSlots.find(x => x.id === mid);
    if(s) openSlotDetails(s);
  } catch(e) { console.error(e); }
}

window.uploadSlotFile = async function(mid) {
  const fileInput = document.getElementById('new-slot-file');
  if (!fileInput.files.length) return;
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  try {
    const res = await fetch(`/api/slots/${mid}/files`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('cp2_token')
      }
    });
    await loadAdminSloturi();
    const s = allSlots.find(x => x.id === mid);
    if(s) openSlotDetails(s);
  } catch(e) { console.error(e); }
}


// ─── INVITATIONS & REGISTRATION ───────────────────────────────────────────────

window.generateInvite = async function() {
  const email = document.getElementById('nu-email').value;
  const role = document.getElementById('nu-role').value;
  
  const pages = Array.from(document.querySelectorAll('.nu-page-cb:checked')).map(cb => cb.value);
  const locations = Array.from(document.querySelectorAll('.nu-loc-cb:checked')).map(cb => parseInt(cb.value, 10));
  const permissions = JSON.stringify({ pages, locations });

  if (!email) return showAlert("Scrie adresa de email!");
  
  document.getElementById('nu-generate-btn').innerText = 'Se genereaza...';
  
  try {
    const res = await apiAuth('/api/invitations', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, role, permissions})
    });
    if (res.error) {
      showAlert(res.error);
    } else {
      const link = window.location.origin + window.location.pathname + '#invite/' + res.code;
      document.getElementById('nu-link-copy').value = link;
      document.getElementById('nu-result').style.display = 'block';
      document.getElementById('nu-generate-btn').style.display = 'none';
      loadAdminUtilizatori(); // Optional: might not show invites list right now
    }
  } catch(e) { console.error(e); }
  document.getElementById('nu-generate-btn').innerText = 'Genereaza Link';
}

window.copyInviteLink = function() {
  const linkInput = document.getElementById('nu-link-copy');
  linkInput.select();
  document.execCommand('copy');
  showAlert('Link-ul a fost copiat în clipboard!');
}

async function handleInviteHash(code) {
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('view-register').style.display = 'flex';
  const roleEl = document.getElementById('reg-role-display');
  const errEl = document.getElementById('reg-error');
  
  try {
    const res = await fetch('/api/invitations/' + code);
    const data = await res.json();
    if (data.error) {
      roleEl.textContent = 'Eroare';
      errEl.textContent = data.error;
    } else {
      roleEl.textContent = `Rol alocat: ${data.role}`;
      document.getElementById('reg-email').value = data.email;
      document.getElementById('reg-code').value = code;
      document.getElementById('reg-form').style.display = 'block';
    }
  } catch(e) {
    roleEl.textContent = 'Eroare conexiune';
  }
}

window.doRegister = async function(e) {
  if (e) e.preventDefault();
  const code = document.getElementById('reg-code').value;
  const nume = document.getElementById('reg-nume').value.trim();
  const prenume = document.getElementById('reg-prenume').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  
  if (!nume || !prenume || !password) {
    errEl.textContent = "Toate câmpurile obligatorii trebuie completate.";
    return;
  }
  
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ code, name: `${nume} ${prenume}`, phone, password })
    });
    const data = await res.json();
    if (data.error) {
      errEl.textContent = data.error;
    } else {
      // successful registration
      showAlert("Cont creat cu succes! Acum te poți autentifica.");
      window.location.hash = '';
      window.location.reload();
    }
  } catch(e) {
    errEl.textContent = "Eroare rețea. Încearcă din nou.";
  }
}


window.toggleSidebar = function() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay && window.innerWidth <= 600) {
      overlay.style.display = isCollapsed ? 'none' : 'block';
    }
  }
};

window.saveRowsPref = function() {
  const sel = document.getElementById('slot-per-page');
  if (sel) localStorage.setItem('cashpot_slot_rows', sel.value);
};

// Restore on load
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('cashpot_slot_rows');
  if (saved) {
    const sel = document.getElementById('slot-per-page');
    if (sel) sel.value = saved;
  }
  loadFilters();
});

window.openHourAnalysis = async function(date, hour) {
  const modal = document.getElementById('hour-analysis-modal');
  const body = document.getElementById('hour-analysis-body');
  const title = document.getElementById('hour-analysis-title');
  if(!modal) return;
  
  title.textContent = `Analiză Oră: ${date} ${hour}`;
  modal.classList.add('show');
  body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--muted)">Se încarcă datele...</td></tr>';
  
  try {
    const locEl = document.getElementById('global-loc-select');
    const locId = locEl ? locEl.value : 'all';
    let p = `start=${date}&end=${date}`;
    if(locId !== 'all') p += `&loc_ids=${locId}`;
    else {
      const ex=getExcluded();
      const active=(filtersData.locations||[]).filter(l=>!ex.includes(String(l.id))).map(l=>l.id);
      if(active.length) p += '&loc_ids='+active.join(',');
    }

    // Fetch machines to get cabinet and mix
    const dataMachines = await api(`/api/machines?${p}`);
    const machineMap = {};
    if(Array.isArray(dataMachines)) {
      dataMachines.forEach(m => {
        machineMap[m.serial_nr] = { cabinet: m.cabinet, mix: m.mix, game: m.last_game_name || m.game_name };
      });
    }

    // Fetch hourly details
    const dataHourly = await api(`/api/reports/hourly?${p}`);
    
    // Filter to selected hour
    const hPrefix = hour.split(':')[0]; // "11"
    const hourRows = dataHourly.filter(r => {
      if (!r.dt) return false;
      const parts = r.dt.split(' ');
      if (parts.length < 2) return false;
      return parts[1].startsWith(hPrefix + ':');
    });

    if (hourRows.length === 0) {
      body.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--muted)">Nu există date sau plăți înregistrate în această oră.</td></tr>';
      return;
    }

    // Sort ascending by GGR (biggest minus first)
    hourRows.sort((a, b) => (parseFloat(a.ggr) || 0) - (parseFloat(b.ggr) || 0));

    body.innerHTML = hourRows.map(r => {
      const ggr = parseFloat(r.ggr) || 0;
      const tIn = parseFloat(r.in) || 0;
      const tOut = parseFloat(r.out) || 0;
      const tHh = parseFloat(r.hh) || 0;
      const tJp = parseFloat(r.jackpot) || 0;
      const tBet = parseFloat(r.bet) || 0;
      const outHh = tOut + tHh + tJp;
      
      // Estimat IN: o aproximație bazată pe Cashout / Handpay, mărginită de IN-ul real
      let estIn = outHh > 0 ? (outHh * 0.95) : 0;
      if (estIn > tIn && tIn > 0) estIn = tIn; // Nu mai mult de IN real

      const ggrClass = ggr < 0 ? 'cell-neg-2' : (ggr > 0 ? 'cell-pos-2' : '');
      const serial = r.serial_nr || r.serial || '—';
      const mInfo = machineMap[serial] || {};
      const cabInfo = mInfo.cabinet ? `${mInfo.cabinet} / ${mInfo.mix||''}` : '—';
      const gameInfo = mInfo.game ? `<div style="font-size:9px; color:var(--accent); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;" title="${mInfo.game}">${mInfo.game}</div>` : '';
      
      const clientName = r.player_name ? `<span style="font-weight:700; color:var(--blue);">${r.player_name}</span>` : '<span style="color:var(--muted)">—</span>';
      
      return `<tr class="hr-row-main" style="border-bottom:1px solid var(--border);">
        <td>${r.locatie || '—'}</td>
        <td style="cursor:pointer; color:var(--accent); position:relative;" onclick="toggleHourlyMachineGames(this, '${serial}', '${r.dt}')" title="Click pentru a vedea detaliile Multigame">
          <div style="font-weight:700; display:flex; align-items:center; gap:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mg-icon"><polyline points="9 18 15 12 9 6"></polyline></svg>
            ${serial}
          </div>
          ${gameInfo}
        </td>
        <td>${clientName}</td>
        <td><span style="font-size:10px; color:var(--muted)">${cabInfo}</span></td>
        <td>${r.provider || '—'}</td>
        <td class="num">${fmt(tBet)}</td>
        <td class="num" style="color:var(--orange); font-weight:600;">${fmt(estIn)}</td>
        <td class="num">${fmt(tIn)}</td>
        <td class="num">${fmt(outHh)}</td>
        <td class="num ${ggrClass}"><strong>${fmt(ggr)}</strong></td>
      </tr>`;
    }).join('');

  } catch(e) {
    body.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:24px; color:#ef4444">Eroare la încărcare: ${e.message}</td></tr>`;
  }
};

window.toggleHourlyMachineGames = async function(td, serial, dt) {
  const tr = td.parentElement;
  const icon = td.querySelector('.mg-icon');
  
  if (tr.nextElementSibling && tr.nextElementSibling.classList.contains('hr-row-games')) {
    // Toggle off
    tr.nextElementSibling.remove();
    if(icon) icon.innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>';
    return;
  }
  
  // Show loading
  const detailsTr = document.createElement('tr');
  detailsTr.className = 'hr-row-games';
  detailsTr.innerHTML = `<td colspan="10" style="padding:16px 24px; background:rgba(0,0,0,0.1); border-bottom:1px solid var(--border);">
    <div style="color:var(--muted); font-size:11px; text-align:center;">Se încarcă jocurile din mix...</div>
  </td>`;
  tr.parentNode.insertBefore(detailsTr, tr.nextSibling);
  if(icon) icon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
  
  try {
    const data = await api(`/api/reports/hourly_machine_games?serial=${serial}&dt=${dt}`);
    if (data.length === 0) {
      detailsTr.innerHTML = `<td colspan="10" style="padding:16px 24px; background:rgba(0,0,0,0.1); border-bottom:1px solid var(--border);">
        <div style="color:var(--muted); font-size:11px; text-align:center;">Nu există detalii multigame pentru această oră.</div>
      </td>`;
      return;
    }
    
    let html = `<div style="display:flex; flex-direction:column; gap:8px; padding:4px 0;">`;
    html += `<div style="display:flex; font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:4px; margin-bottom:4px;">
      <div style="flex:2">Joc</div>
      <div style="flex:1; text-align:right;">Bet</div>
      <div style="flex:1; text-align:right;">Win</div>
      <div style="flex:1; text-align:right;">JP</div>
      <div style="flex:1; text-align:right;">GGR</div>
    </div>`;
    
    data.forEach(g => {
      const gClass = g.ggr < 0 ? 'color:var(--red)' : (g.ggr > 0 ? 'color:var(--green)' : 'color:var(--text)');
      html += `<div style="display:flex; font-size:11px; align-items:center;">
        <div style="flex:2; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${g.game_name}">${g.game_name}</div>
        <div style="flex:1; text-align:right;">${fmt(g.bet)}</div>
        <div style="flex:1; text-align:right;">${fmt(g.win)}</div>
        <div style="flex:1; text-align:right; color:var(--accent);">${g.jp > 0 ? fmt(g.jp) : '-'}</div>
        <div style="flex:1; text-align:right; font-weight:700; ${gClass}">${fmt(g.ggr)}</div>
      </div>`;
    });
    html += `</div>`;
    
    detailsTr.innerHTML = `<td colspan="10" style="padding:12px 24px 16px 24px; background:rgba(0,0,0,0.2); border-bottom:1px solid var(--border);">${html}</td>`;
  } catch(e) {
    detailsTr.innerHTML = `<td colspan="10" style="padding:16px 24px; background:rgba(0,0,0,0.1); border-bottom:1px solid var(--border);">
      <div style="color:var(--red); font-size:11px; text-align:center;">Eroare: ${e.message}</div>
    </td>`;
  }
}


// ─── P&L (PROFIT & LOSS) ─────────────────────────────────────────
window.loadPLData = async function() {
  const { s, e } = getPeriod();
  const locEl = document.getElementById('global-loc-select');
  const locId = locEl ? locEl.value : 'all';
  let p = `start=${s}&end=${e}`;
  if(locId !== 'all') p += `&loc_ids=${locId}`;
  else p += locParam();

  showLoader(true);
  try {
    const locRes = await api(`/api/locations?${p}`);
    if (locRes.error) throw new Error(locRes.error);
    
    const expRes = await api(`/api/reports/expenses?${p}`);
    const expData = expRes || [];

    // KPI updates are now handled exclusively by loadKPI() to avoid race conditions.
    
    // Marketing is now handled in loadKPI

    const norm = n => n.toLowerCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ').trim();

    const locRevMap = {};
    const locNormMap = {};
    locRes.forEach(r => { 
      locRevMap[r.locatie] = r; 
      locNormMap[norm(r.locatie)] = r.locatie;
    });

    const expMap = {};
    expData.forEach(exp => {
       const rawName = exp.location_name || 'Fără Locație';
       const normalized = norm(rawName);
       // Match expense location to canonical revenue location if possible
       const lName = locNormMap[normalized] || rawName;
       expMap[lName] = (expMap[lName] || 0) + (exp.amount || 0);
    });

    let tIn = 0, tOut = 0, tGgr = 0, tBonus = 0, tNgr = 0, tExp = 0, tNet = 0;
    let html = '';
    
    // Only show locations returned by /api/locations (respects exclusion filter)
    // Cheltuieli from excluded locations (e.g. Depozit) are summed separately
    const allLocNames = new Set(locRes.map(r => r.locatie));
    
    const rows = Array.from(allLocNames).map(lName => {
       const rev = locRevMap[lName] || {};
       const inVal = rev.total_in || 0;
       const outVal = rev.total_out || 0;
       const ggr = rev.ggr || (inVal - outVal);
       const jp = rev.jackpot || 0;
       const hh = rev.hh || 0;
       const cb = rev.cashback || 0;
       const bonus = jp + hh + cb;
       
       const ngr = ggr + bonus;
       
       const exp = expMap[lName] || 0;
       const net = ggr - exp;
       
       tIn += inVal; tOut += outVal; tGgr += ggr; tBonus += bonus; tNgr += ngr; tExp += exp; tNet += net;
       
       return { name: lName, inVal, outVal, ggr, bonus, ngr, exp, net };
    });
    
    rows.sort((a,b) => b.net - a.net);
    
    rows.forEach(r => {
       html += `
         <tr style="border-bottom: 1px solid var(--border);">
           <td style="font-weight:700; color:var(--text);">${r.name}</td>
           <td class="num">${fmt(r.inVal)}</td>
           <td class="num" style="color:var(--muted);">${fmt(r.outVal)}</td>
           <td class="num" style="font-weight:600;">${fmt(r.ggr)}</td>
           <td class="num" style="color:var(--muted);">${fmt(r.bonus)}</td>
           <td class="num" style="font-weight:600;">${fmt(r.ngr)}</td>
           <td class="num" style="color:var(--red); font-weight:600;">${fmt(r.exp)}</td>
           <td class="num" style="font-weight:800; color:${r.net >= 0 ? 'var(--green)' : 'var(--red)'};">${fmt(r.net)}</td>
         </tr>
       `;
    });
    
    if(rows.length === 0) {
      html = '<tr><td colspan="8" style="text-align:center; color:var(--muted); padding:24px;">Nu există date pentru această selecție.</td></tr>';
    }

    const tbody = document.getElementById('body-pl');
    if (tbody) tbody.innerHTML = html;
    
    const tfoot = document.getElementById('foot-pl');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr style="background:var(--surface2); border-top:2px solid var(--border); height: 48px;">
          <td style="text-align:left; font-weight:800; font-size:12px; color:var(--text); text-transform:uppercase; letter-spacing:0.05em;">Total P&L</td>
          <td class="num" style="font-weight:800; color:var(--green);">${fmt(tIn)}</td>
          <td class="num" style="font-weight:800; color:var(--muted);">${fmt(tOut)}</td>
          <td class="num" style="font-weight:800;">${fmt(tGgr)}</td>
          <td class="num" style="font-weight:800; color:var(--muted);">${fmt(tBonus)}</td>
          <td class="num" style="font-weight:800;">${fmt(tNgr)}</td>
          <td class="num" style="font-weight:800; color:var(--red);">${fmt(tExp)}</td>
          <td class="num" style="font-weight:900; font-size:14px; color:${tNet >= 0 ? 'var(--green)' : 'var(--red)'};">${fmt(tNet)}</td>
        </tr>
      `;
    }

    // Trigger KPI load for dashboard KPIs if they still show "—"
    const vIn = document.getElementById('v-in');
    if (vIn && (vIn.textContent === '—' || vIn.textContent.trim() === '—')) {
      if (s && e) loadKPI(s, e).catch(console.error);
    }

    // Render Charts
    if (window._plChartNet) window._plChartNet.destroy();
    if (window._plChartStruct) window._plChartStruct.destroy();

    const chartRows = [...rows].filter(r => r.name !== 'Fără Locație').slice(0, 10);
    const labels = chartRows.map(r => r.name.substring(0, 15));
    const netData = chartRows.map(r => r.net);
    const expDataChart = chartRows.map(r => r.exp);
    const ngrDataChart = chartRows.map(r => r.ngr);

    const ctxNet = document.getElementById('pl-chart-net');
    if (ctxNet) {
      window._plChartNet = new Chart(ctxNet, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Profit Net',
              data: netData,
              backgroundColor: netData.map(v => v >= 0 ? '#10b981' : '#ef4444'),
              borderRadius: 4,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } }
          }
        }
      });
    }

    const ctxStruct = document.getElementById('pl-chart-struct');
    if (ctxStruct) {
      window._plChartStruct = new Chart(ctxStruct, {
        type: 'bar',
        data: {
          labels: labels.slice(0, 5),
          datasets: [
            {
              label: 'NGR',
              data: ngrDataChart.slice(0, 5),
              backgroundColor: '#3b82f6',
              borderRadius: 4,
            },
            {
              label: 'Cheltuieli',
              data: expDataChart.slice(0, 5),
              backgroundColor: '#ef4444',
              borderRadius: 4,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 12 } } },
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } }
          }
        }
      });
    }

    // --- Heatmap (Last 12 Months) ---
    api(`/api/reports/pl_heatmap?${p}`).then(heatRes => {
      const monthsSet = new Set();
      const locData = {}; // { 'Locatia': { '2023-01': net } }
      
      const rev = heatRes.revenue || [];
      const exp = heatRes.expenses || [];
      const dynNormMap = { ...locNormMap };
      const getCanonical = (name) => {
         const n = norm(name);
         if (!dynNormMap[n]) {
            dynNormMap[n] = name;
         }
         return dynNormMap[n];
      };

      rev.forEach(r => {
        if (!r.month) return;
        monthsSet.add(r.month);
        const lName = getCanonical(r.location_name);
        if (!locData[lName]) locData[lName] = {};
        if (!locData[lName][r.month]) locData[lName][r.month] = 0;
        locData[lName][r.month] += parseFloat(r.ggr || r.ngr || 0); // Profitul se calculeaza din GGR
      });
      
      exp.forEach(r => {
        if (!r.month) return;
        monthsSet.add(r.month);
        const lName = getCanonical(r.location_name);
        if (!locData[lName]) locData[lName] = {};
        if (!locData[lName][r.month]) locData[lName][r.month] = 0;
        locData[lName][r.month] -= parseFloat(r.expenses || 0);
      });
      
      const months = Array.from(monthsSet).sort();
      let thead = '<tr><th style="text-align:left; position:sticky; left:0; background:var(--surface); z-index:2;">Locație</th>';
      months.forEach(m => { thead += `<th style="text-align:center; font-size:11px;">${m}</th>`; });
      thead += '<th style="text-align:center; font-size:11px;">Total 12M</th></tr>';
      
      let tbody = '';
      // Only show locations that are in the active locRes (respects exclusion filter)
      const activeLocNames = new Set(locRes.map(r => r.locatie));
      const locNames = Object.keys(locData).filter(k => activeLocNames.has(k)).sort();
      const monthTotals = {};
      months.forEach(m => monthTotals[m] = 0);
      let grandTotal = 0;

      locNames.forEach(lName => {
        if (lName === 'Fără Locație') return; // Skip dummy if empty
        let rTot = 0;
        tbody += `<tr><td style="text-align:left; font-weight:700; position:sticky; left:0; background:var(--surface); z-index:1;">${lName}</td>`;
        months.forEach(m => {
          const net = locData[lName][m] || 0;
          rTot += net;
          monthTotals[m] += net;
          grandTotal += net;
          let bg = 'transparent';
          let col = 'var(--text)';
          if (net > 0) {
            bg = `rgba(16, 185, 129, ${Math.min(0.8, 0.1 + net/200000)})`;
            col = '#fff';
          } else if (net < 0) {
            bg = `rgba(239, 68, 68, ${Math.min(0.8, 0.1 + Math.abs(net)/200000)})`;
            col = '#fff';
          }
          tbody += `<td style="background:${bg}; color:${col}; font-weight:600; text-align:center; padding: 12px 4px; font-size:12px;" title="${lName} / ${m} / ${fmt(net)}">${fmtK(net)}</td>`;
        });
        tbody += `<td style="text-align:center; font-weight:800; color:${rTot >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtK(rTot)}</td></tr>`;
      });
      
      // Add Total Row
      tbody += `<tr><td style="text-align:left; font-weight:800; color:var(--text); text-transform:uppercase; letter-spacing:0.05em; position:sticky; left:0; background:var(--surface2); z-index:1; border-top:2px solid var(--border); height: 48px;">TOTAL</td>`;
      months.forEach(m => {
          const mTot = monthTotals[m];
          tbody += `<td style="text-align:center; font-weight:800; border-top:2px solid var(--border); background:var(--surface2); color:${mTot >= 0 ? 'var(--green)' : 'var(--red)'};">${fmtK(mTot)}</td>`;
      });
      tbody += `<td style="text-align:center; font-weight:900; font-size:14px; border-top:2px solid var(--border); background:var(--surface2); color:${grandTotal >= 0 ? 'var(--green)' : 'var(--red)'};">${fmtK(grandTotal)}</td></tr>`;
      
      
      const elHead = document.getElementById('pl-heatmap-head');
      const elBody = document.getElementById('pl-heatmap-body');
      if (elHead) elHead.innerHTML = thead;
      if (elBody) elBody.innerHTML = tbody;
      
    }).catch(err => {
      console.error('Heatmap error:', err);
      const elBody = document.getElementById('pl-heatmap-body');
      if (elBody) elBody.innerHTML = '<tr><td colspan="15" style="color:var(--red);">Eroare încărcare heatmap.</td></tr>';
    });

  } catch(err) {
    console.error('loadPLData error:', err);
    const tbody = document.getElementById('body-pl');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="color:var(--red); text-align:center; padding: 24px; font-weight: 600;">Eroare la încărcarea datelor P&L</td></tr>';
  } finally {
    showLoader(false);
  }
};

// ─── RAPOARTE CHELTUIELI ──────────────────────────────────────────
let _expensesData = [];
let _expPage = 1;
let _expPerPage = parseInt(localStorage.getItem('expPerPage') || '50');

window.changeExpPerPage = function(val) {
  _expPerPage = parseInt(val);
  _expPage = 1;
  localStorage.setItem('expPerPage', val);
  window.renderExpensesTable();
}
window.changeExpPage = function(dir) {
  const q = (document.getElementById('exp-search')?.value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = _expensesData.filter(r => !q || [r.explanation, r.location_name, r.department_name, r.vendor_name, r.expenditure_type_name].join(' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q));
  const totalPages = _expPerPage >= 999999 ? 1 : Math.ceil(filtered.length / _expPerPage);
  _expPage = Math.max(1, Math.min(_expPage + dir, totalPages));
  window.renderExpensesTable();
}
window.loadExpensesReport = async function() {
  showLoader(true);
  try {
    const {s, e} = getPeriod();
    const data = await api(`/api/reports/expenses?start=${s}&end=${e}${locParam()}`);
    _expensesData = data || [];
    _expPage = 1;
    // Restore saved per-page
    const sel = document.getElementById('exp-per-page');
    if (sel) sel.value = String(_expPerPage);
    populateExpFilterOptions();
    window.renderExpensesTable();
    window.renderExpCharts();
    window.renderExpSummary();
    
    // KPI updates are now handled exclusively by loadKPI() to avoid race conditions.
    
    // Marketing is now handled in loadKPI
    
    
    // Trigger KPI load for dashboard KPIs if they still show "—"
    const vIn = document.getElementById('v-in');
    if (vIn && (vIn.textContent === '—' || vIn.textContent.trim() === '—')) {
      if (s && e) loadKPI(s, e).catch(console.error);
    }
  } catch(err) {
    console.error(err);
  } finally {
    showLoader(false);
  }
}

window.switchExpTab = function(tab) {
  document.getElementById('exp-tab-btn-summary').style.borderBottomColor = (tab === 'summary') ? 'var(--accent)' : 'transparent';
  document.getElementById('exp-tab-btn-summary').style.color = (tab === 'summary') ? 'var(--accent)' : 'var(--muted)';
  
  document.getElementById('exp-tab-btn-details').style.borderBottomColor = (tab === 'details') ? 'var(--accent)' : 'transparent';
  document.getElementById('exp-tab-btn-details').style.color = (tab === 'details') ? 'var(--accent)' : 'var(--muted)';
  
  const fixedBtn = document.getElementById('exp-tab-btn-fixed');
  if(fixedBtn) {
    fixedBtn.style.borderBottomColor = (tab === 'fixed') ? 'var(--accent)' : 'transparent';
    fixedBtn.style.color = (tab === 'fixed') ? 'var(--accent)' : 'var(--muted)';
  }
  
  const plBtn = document.getElementById('exp-tab-btn-pl');
  if(plBtn) {
    plBtn.style.borderBottomColor = (tab === 'pl') ? 'var(--accent)' : 'transparent';
    plBtn.style.color = (tab === 'pl') ? 'var(--accent)' : 'var(--muted)';
  }
  
  document.getElementById('exp-tab-summary').style.display = (tab === 'summary') ? 'block' : 'none';
  document.getElementById('exp-tab-details').style.display = (tab === 'details') ? 'block' : 'none';
  
  const fixedTab = document.getElementById('exp-tab-fixed');
  if(fixedTab) {
    fixedTab.style.display = (tab === 'fixed') ? 'block' : 'none';
    if(tab === 'fixed') loadFixedExpenses();
  }
  
  const plTab = document.getElementById('exp-tab-pl');
  if(plTab) {
    plTab.style.display = (tab === 'pl') ? 'block' : 'none';
    if(tab === 'pl') loadPLData();
  }
  
  const bulkToolbar = document.getElementById('exp-bulk-toolbar');
  if(bulkToolbar) {
    bulkToolbar.style.display = (tab === 'details') ? 'flex' : 'none';
  }
}

window.toggleExpDep = function(depIndex) {
  const typeRows = document.querySelectorAll('.exp-subrow-' + depIndex);
  const expRows = document.querySelectorAll('.exp-subsubrow-dep-' + depIndex);
  const icon = document.getElementById('exp-icon-' + depIndex);
  let isHidden = false;
  
  typeRows.forEach(r => {
    if(r.style.display === 'none') {
      r.style.display = 'table-row';
      isHidden = true;
    } else {
      r.style.display = 'none';
    }
  });
  
  if (!isHidden) {
    expRows.forEach(r => r.style.display = 'none');
    document.querySelectorAll('.exp-type-icon-dep-' + depIndex).forEach(i => i.textContent = '▶');
  }
  
  if(icon) {
    icon.textContent = isHidden ? '▼' : '▶';
  }
}

window.toggleExpType = function(typeIndex) {
  const rows = document.querySelectorAll('.exp-subsubrow-' + typeIndex);
  const icon = document.getElementById('exp-type-icon-' + typeIndex);
  let isHidden = false;
  rows.forEach(r => {
    if(r.style.display === 'none') {
      r.style.display = 'table-row';
      isHidden = true;
    } else {
      r.style.display = 'none';
    }
  });
  if(icon) {
    icon.textContent = isHidden ? '▼' : '▶';
  }
}

window.toggleAllExpDeps = function() {
  const isExpanded = document.body.dataset.expAll === 'true';
  const newExpanded = !isExpanded;
  document.body.dataset.expAll = newExpanded ? 'true' : 'false';
  
  document.querySelectorAll('tr[class*="exp-subrow-"]').forEach(r => {
    r.style.display = newExpanded ? 'table-row' : 'none';
  });
  
  if (!newExpanded) {
    document.querySelectorAll('tr[class*="exp-subsubrow-"]').forEach(r => {
      r.style.display = 'none';
    });
    document.querySelectorAll('[id^="exp-type-icon-"]').forEach(i => {
      i.textContent = '▶';
    });
  }
  
  document.querySelectorAll('[id^="exp-icon-"]').forEach(i => {
    i.textContent = newExpanded ? '▼' : '▶';
  });
}

window.goToExpDetails = function(q) {
  const s = document.getElementById('exp-search');
  if (s) {
    s.value = q;
    window.filterExpensesTable();
  }
  window.switchExpTab('details');
};

window.renderExpSummary = function() {
  const q = (document.getElementById('exp-search')?.value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = typeof getExpFiltered === 'function' ? getExpFiltered() : _expensesData.filter(r => !q || [r.explanation, r.location_name, r.department_name, r.vendor_name, r.expenditure_type_name].join(' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q));

  // Categorii (Departments) as rows, Locations as columns
  // Also we want to expand into Types (expenditure_type_name)
  const depsMap = {};  // dep -> { total: 0, locs: { loc: 0 }, types: { typeName: { total: 0, locs: { loc: 0 } } } }
  const locTotals = {};

  for (const r of filtered) {
    if (r.is_hidden) continue;
    
    const dName = r.department_name || 'Fără Dep.';
    const tName = r.expenditure_type_name || 'Fără Tip';
    const eName = r.explanation || 'Fără Explicație';
    const lName = r.location_name || 'Fără Locație';

    if (!depsMap[dName]) {
      depsMap[dName] = { total: 0, items: [], locs: {}, types: {} };
    }
    if (!depsMap[dName].locs[lName]) depsMap[dName].locs[lName] = { amount: 0, items: [] };
    
    if (!depsMap[dName].types[tName]) {
      depsMap[dName].types[tName] = { total: 0, items: [], locs: {}, exps: {} };
    }
    if (!depsMap[dName].types[tName].locs[lName]) depsMap[dName].types[tName].locs[lName] = { amount: 0, items: [] };
    
    if (!depsMap[dName].types[tName].exps[eName]) {
      depsMap[dName].types[tName].exps[eName] = { total: 0, items: [], locs: {} };
    }
    if (!depsMap[dName].types[tName].exps[eName].locs[lName]) depsMap[dName].types[tName].exps[eName].locs[lName] = { amount: 0, items: [] };
    
    if (!locTotals[lName]) locTotals[lName] = { amount: 0, items: [] };

    depsMap[dName].total += r.amount;
    depsMap[dName].items.push(r);
    depsMap[dName].locs[lName].amount += r.amount;
    depsMap[dName].locs[lName].items.push(r);
    
    depsMap[dName].types[tName].total += r.amount;
    depsMap[dName].types[tName].items.push(r);
    depsMap[dName].types[tName].locs[lName].amount += r.amount;
    depsMap[dName].types[tName].locs[lName].items.push(r);
    
    depsMap[dName].types[tName].exps[eName].total += r.amount;
    depsMap[dName].types[tName].exps[eName].items.push(r);
    depsMap[dName].types[tName].exps[eName].locs[lName].amount += r.amount;
    depsMap[dName].types[tName].exps[eName].locs[lName].items.push(r);
    
    locTotals[lName].amount += r.amount;
    locTotals[lName].items.push(r);
  }

  const deps = Object.keys(depsMap).sort();
  const locs = Object.keys(locTotals).sort();

  const thead = document.getElementById('head-exp-summary');
  const tbody = document.getElementById('body-exp-summary');
  if (!thead || !tbody) return;

  // Header: Departament | Loc1 | Loc2 | ... | Total
  let thHtml = '<tr><th style="white-space:nowrap;">Departament / Tip <button onclick="toggleAllExpDeps()" style="background:var(--surface); border:1px solid var(--border); color:var(--text); padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer; margin-left:6px;" title="Extinde/Restrânge Tot">+/-</button></th>';
  for (const l of locs) thHtml += `<th class="num">${l}</th>`;
  thHtml += '<th class="num" style="color:var(--red);">Total</th></tr>';
  thead.innerHTML = thHtml;

  let tbHtml = '';
  let grandTotal = 0;
  
  const makeTooltip = (items) => {
    if (!items || items.length === 0) return '';
    const lines = items.map(i => `${i.date || ''}: ${i.explanation ? i.explanation.replace(/"/g, '&quot;') : ''} (${fmt(i.amount)})`);
    return `title="${lines.join('&#10;')}"`;
  };
  
  let depIndex = 0;
  let typeIndex = 0;
  for (const d of deps) {
    depIndex++;
    const depData = depsMap[d];
    
    const types = Object.keys(depData.types).sort();
    
    tbHtml += `<tr style="cursor:pointer;" onclick="toggleExpDep(${depIndex})" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <td style="font-weight:600; color:var(--accent); white-space:nowrap;">
        <span id="exp-icon-${depIndex}" style="display:inline-block; width:16px; font-size:10px;">▶</span> ${d}
      </td>`;
      
    for (const l of locs) {
      const cell = depData.locs[l] || { amount: 0, items: [] };
      tbHtml += `<td class="num" ${makeTooltip(cell.items)}>${cell.amount !== 0 ? fmt(cell.amount) : '-'}</td>`;
    }
    grandTotal += depData.total;
    tbHtml += `<td class="num" style="font-weight:700; color:var(--red);" ${makeTooltip(depData.items)}>${fmt(depData.total)}</td></tr>`;
    
    for (const t of types) {
      typeIndex++;
      const tData = depData.types[t];
      const exps = Object.keys(tData.exps).sort();
      
      tbHtml += `<tr class="exp-subrow-${depIndex}" style="display:none; background:var(--surface); cursor:pointer;" onclick="toggleExpType(${typeIndex})" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='var(--surface)'">
        <td style="padding-left:24px; font-size:12px; color:var(--muted); white-space:nowrap;">
          <span id="exp-type-icon-${typeIndex}" class="exp-type-icon-dep-${depIndex}" style="display:inline-block; width:16px; font-size:10px;">▶</span> ${t}
        </td>`;
      for (const l of locs) {
        const cell = tData.locs[l] || { amount: 0, items: [] };
        tbHtml += `<td class="num" style="font-size:12px; color:var(--muted);" ${makeTooltip(cell.items)}>${cell.amount !== 0 ? fmt(cell.amount) : '-'}</td>`;
      }
      tbHtml += `<td class="num" style="font-size:12px; font-weight:600; color:var(--red); opacity:0.8;" ${makeTooltip(tData.items)}>${fmt(tData.total)}</td></tr>`;
      
      // Sub-sub-rows for explanations
      for (const e of exps) {
        const eData = tData.exps[e];
        tbHtml += `<tr class="exp-subsubrow-${typeIndex} exp-subsubrow-dep-${depIndex}" style="display:none; background:var(--surface2);">
          <td style="padding-left:48px; font-size:11px; color:var(--muted); white-space:nowrap;">- ${e}</td>`;
        for (const l of locs) {
          const cell = eData.locs[l] || { amount: 0, items: [] };
          tbHtml += `<td class="num" style="font-size:11px; color:var(--muted);" ${makeTooltip(cell.items)}>${cell.amount !== 0 ? fmt(cell.amount) : '-'}</td>`;
        }
        tbHtml += `<td class="num" style="font-size:11px; font-weight:500; color:var(--red); opacity:0.7;" ${makeTooltip(eData.items)}>${fmt(eData.total)}</td></tr>`;
      }
    }
  }

  // Total row
  if (deps.length > 0) {
    tbHtml += `<tr style="background:var(--surface2);"><td style="font-weight:700;">TOTAL GENERAL</td>`;
    for (const l of locs) tbHtml += `<td class="num" style="font-weight:700;" ${makeTooltip(locTotals[l]?.items)}>${fmt(locTotals[l]?.amount || 0)}</td>`;
    tbHtml += `<td class="num" style="font-weight:800; color:var(--red);">${fmt(grandTotal)}</td></tr>`;
  } else {
    tbHtml += `<tr><td colspan="${locs.length + 2}" style="text-align:center; color:var(--muted); padding:20px;">Nu există date conform filtrelor selectate.</td></tr>`;
  }

  tbody.innerHTML = tbHtml;
}



window.filterExpensesTable = function() { 
  window.renderExpensesTable(); 
  window.renderExpSummary();
}
window.filterExpenses = window.filterExpensesTable;

window.deleteExpense = async function(id) {
  appConfirm('Ești sigur că vrei să ștergi această cheltuială? Această acțiune este ireversibilă.', async () => {
    try {
      const r = await fetch(API + '/api/admin/expenses/' + id, { method: 'DELETE' });
      const res = await r.json();
      if (res.success) {
        if (typeof loadExpensesData !== 'undefined') loadExpensesData();
        else if (typeof window.loadExpensesReport === 'function') window.loadExpensesReport();
      } else {
        appAlert('Eroare: ' + (res.error || 'Nu s-a putut șterge.'));
      }
    } catch(e) {
      console.error(e);
      appAlert('Eroare la ștergere.');
    }
  });
}

window.exportActiveDashTable = function() {
  const activePanel = document.querySelector('.tab-panel.active');
  if (!activePanel) return;
  const key = activePanel.id.replace('tab-', '');
  exportToExcel(key);
};

window.exportExpensesExcel = async function() {
  const tbody = document.getElementById('body-exp-summary');
  const table = tbody ? tbody.closest('table') : null;
  if (!table) { 
      if (typeof showAlert === 'function') showAlert('Nu există date de exportat.'); 
      else alert('Nu există date de exportat.');
      return; 
  }
  
  // Clone table to ensure all rows are exported even if hidden
  const clone = table.cloneNode(true);
  
  // 1. Remove the expand all button
  const btn = clone.querySelector('button');
  if (btn) btn.remove();
  
  // 2. Remove expand/collapse icons (▶, ▼)
  const icons = clone.querySelectorAll('[id^="exp-icon-"]');
  icons.forEach(i => i.remove());
  
  // 3. Remove the '↳ ' prefix from subrows and make sure they are visible
  const subrows = clone.querySelectorAll('[class^="exp-subrow-"]');
  subrows.forEach(r => {
    r.style.display = '';
    const td = r.querySelector('td');
    if (td && td.textContent.includes('↳')) {
      td.textContent = td.textContent.replace('↳', '').trim();
    }
  });
  
  // 4. Make category rows bold (convert td to th so Excel makes them bold)
  const catRows = clone.querySelectorAll('tr[onclick^="toggleExpDep"]');
  catRows.forEach(r => {
    const tds = r.querySelectorAll('td');
    tds.forEach(td => {
      const th = document.createElement('th');
      th.innerHTML = td.innerHTML.trim();
      r.replaceChild(th, td);
    });
  });

  const hiddenRows = clone.querySelectorAll('tr[style*="display: none"], tr[style*="display:none"]');
  hiddenRows.forEach(r => r.style.display = '');
  
  const wb = XLSX.utils.table_to_book(clone, { sheet: "Centralizator Cheltuieli", display: true });
  XLSX.writeFile(wb, `Cheltuieli_Centralizator_${new Date().toISOString().split('T')[0]}.xlsx`);
}

window.copyExpSummaryTable = async function(btn) {
  const tbody = document.getElementById('body-exp-summary');
  const table = tbody ? tbody.closest('table') : null;
  if (!table) { 
      if (typeof showAlert === 'function') showAlert('Nu există date de copiat.'); 
      else alert('Nu există date de copiat.');
      return; 
  }
  
  const originalHtml = btn ? btn.innerHTML : '';
  const originalColor = btn ? btn.style.color : '';
  const originalBorder = btn ? btn.style.borderColor : '';

  const showSuccessState = () => {
    if (btn) {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      btn.style.color = '#10b981';
      btn.style.borderColor = '#10b981';
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.color = originalColor;
        btn.style.borderColor = originalBorder;
      }, 3000);
    }
  };

  const clone = table.cloneNode(true);
  
  const hdrBtn = clone.querySelector('button');
  if (hdrBtn) hdrBtn.remove();
  
  const icons = clone.querySelectorAll('[id^="exp-icon-"]');
  icons.forEach(i => i.remove());
  
  const subrows = clone.querySelectorAll('[class^="exp-subrow-"]');
  subrows.forEach(r => {
    r.style.display = '';
    const td = r.querySelector('td');
    if (td && td.textContent.includes('↳')) {
      td.textContent = td.textContent.replace('↳', '').trim();
    }
  });
  
  const catRows = clone.querySelectorAll('tr[onclick^="toggleExpDep"]');
  catRows.forEach(r => {
    const tds = r.querySelectorAll('td');
    tds.forEach(td => {
      const th = document.createElement('th');
      th.innerHTML = td.innerHTML.trim();
      r.replaceChild(th, td);
    });
  });

  const hiddenRows = clone.querySelectorAll('tr[style*="display: none"], tr[style*="display:none"]');
  hiddenRows.forEach(r => r.style.display = '');

  // Apply inline styles for HTML export (so Sheets/Excel keeps formatting)
  clone.style.borderCollapse = 'collapse';
  clone.style.fontFamily = 'Arial, sans-serif';
  clone.style.fontSize = '12px';
  
  const allRows = clone.querySelectorAll('tr');
  allRows.forEach((r, idx) => {
    if (idx === 0) {
      r.style.backgroundColor = '#F8FAFC'; // header
    } else if (r.querySelector('th')) {
      r.style.backgroundColor = '#F1F5F9'; // catRows (since we changed td to th)
    } else if (r.textContent.includes('TOTAL GENERAL')) {
      r.style.backgroundColor = '#E2E8F0'; // total row
    } else {
      r.style.backgroundColor = '#FFFFFF'; // subrows
    }
    
    const cells = r.querySelectorAll('th, td');
    cells.forEach(c => {
      c.style.border = '1px solid #E2E8F0';
      c.style.padding = '4px 8px';
      
      // Translate CSS variables to HEX
      if (c.style.color && c.style.color.includes('var(--red)')) {
        c.style.color = '#DC2626';
      } else if (c.style.color && c.style.color.includes('var(--muted)')) {
        c.style.color = '#64748B';
      } else {
        c.style.color = '#0F172A';
      }
      
      if (c.classList.contains('num')) {
        c.style.textAlign = 'right';
      } else {
        c.style.textAlign = 'left';
      }
    });
  });

  let tsv = '';
  const rows = clone.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('th, td');
    const rowData = Array.from(cells).map(cell => cell.textContent.trim().replace(/\n/g, ' '));
    tsv += rowData.join('\t') + '\n';
  });

  let html = clone.outerHTML;
  let clipboardApiSupported = !!(navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined');

  if (clipboardApiSupported) {
    try {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([tsv], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
      
      navigator.clipboard.write(data).then(() => {
        if (typeof showToast === 'function') showToast('Tabelul a fost copiat în memorie!', 'success');
        showSuccessState();
      }).catch(err => {
        console.error('Clipboard API a eșuat...', err);
        fallbackCopy(tsv, showSuccessState);
      });
      return;
    } catch (err) {
      console.error('ClipboardItem error...', err);
      clipboardApiSupported = false;
    }
  }

  if (!clipboardApiSupported) {
    fallbackCopy(tsv, showSuccessState);
  }
  
  function fallbackCopy(text, onSuccess) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand('copy');
      if (ok) {
        if (typeof showToast === 'function') showToast('Copiat cu succes!', 'success');
        if (onSuccess) onSuccess();
      } else {
        if (typeof showToast === 'function') showToast('Eroare la copiere.', 'error');
      }
    } catch(e) {}
    document.body.removeChild(ta);
  }
}

let _expSortCol = 'date';
let _expSortDir = 'desc';

window.sortExpenses = function(col) {
  if (_expSortCol === col) {
    _expSortDir = _expSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _expSortCol = col;
    _expSortDir = 'asc';
  }
  _expPage = 1;
  window.renderExpensesTable();
}

window.renderExpensesTable = function() {
  const tbody = document.getElementById('body-rep-cheltuieli');
  if (!tbody) return;
  const q = (document.getElementById('exp-search')?.value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Filter (includes dropdown filters)
  let filtered = typeof getExpFiltered === 'function' ? getExpFiltered() : _expensesData.filter(r => !q || [r.explanation, r.location_name, r.department_name, r.vendor_name, r.expenditure_type_name].join(' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q));
  
  
  // Actualizare Bula Search
  const searchInput = document.getElementById('exp-search');
  const searchBubble = document.getElementById('exp-search-counter');
  if (searchInput && searchBubble) {
    if (q.trim() !== "") {
      searchBubble.style.display = "inline-block";
      searchBubble.textContent = filtered.length;
    } else {
      searchBubble.style.display = "none";
    }
  }

// Sort
filtered.sort((a, b) => {
    let valA = a[_expSortCol] || '';
    let valB = b[_expSortCol] || '';
    
    if (typeof valA === 'number' && typeof valB === 'number') {
      return _expSortDir === 'asc' ? valA - valB : valB - valA;
    }
    
    valA = String(valA).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    valB = String(valB).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (valA < valB) return _expSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return _expSortDir === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Pagination
  const perPage = _expPerPage >= 999999 ? filtered.length : _expPerPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  _expPage = Math.min(_expPage, totalPages);
  const pageData = filtered.slice((_expPage - 1) * perPage, _expPage * perPage);
  
  // Update page info
  const pageInfo = document.getElementById('exp-page-info');
  if (pageInfo) pageInfo.textContent = `Pagina ${_expPage}/${totalPages} (${filtered.length} total)`;
  const prevBtn = document.getElementById('btn-exp-prev');
  const nextBtn = document.getElementById('btn-exp-next');
  if (prevBtn) prevBtn.disabled = _expPage <= 1;
  if (nextBtn) nextBtn.disabled = _expPage >= totalPages;
  
  let html = '';
  let total = 0;
  
  for (const r of pageData) {
    if (!r.is_hidden) {
      total += r.amount;
    }
    
    html += `
      <tr style="${r.is_hidden ? 'opacity:0.4;' : ''}">
        <td style="text-align:center;">${r.is_manual ? `<input type="checkbox" class="exp-row-cb" value="${r.id}" onclick="updateExpBulkToolbar()" style="cursor:pointer;">` : ''}</td>
        <td style="white-space:nowrap;font-size:11px;color:var(--muted)">${r.date}</td>
        <td style="color:var(--accent);font-weight:600">${r.location_name || '-'}</td>
        <td>${r.department_name || '-'}</td>
        <td>${r.expenditure_type_name || '-'}</td>
        <td>${r.vendor_name || '-'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.explanation}">${r.explanation || '-'}</td>
        <td>${r.details || '-'}</td>
        <td class="num" style="color:var(--red);font-weight:700">${fmt(r.amount)}</td>
        
        <td style="text-align:center;">
          ${r.id ? `<div style="display:flex; justify-content:center; gap:4px;">
            <button onclick="toggleExpenseVisibility('${r.id}')" style="background:none;border:none;cursor:pointer;color:var(--text);padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='none'" title="${r.is_hidden ? 'Afișează' : 'Ascunde (exclude din calcule)'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${r.is_hidden ? 
                  '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>' 
                  : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'}
              </svg>
            </button>
            ${r.is_manual ? `
            <button onclick="openEditExpense('${r.id}')" style="background:none;border:none;cursor:pointer;color:var(--text);padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='none'" title="Modifică">✎</button>
            <button onclick="deleteExpense('${r.id}')" style="background:none;border:none;cursor:pointer;color:var(--red);padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'" title="Șterge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
            ` : ''}
          </div>` : ''}
        </td>
      </tr>
    `;
  }
  
  // Totals
  const totalGeneral = filtered.reduce((s, r) => s + (r.is_hidden ? 0 : r.amount), 0); // all filtered rows
  const totalAll = _expensesData.reduce((s, r) => s + (r.is_hidden ? 0 : r.amount), 0); // all data (no filter)
  const isFiltered = filtered.length < _expensesData.length;
  
  if (!html) html = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted)">Nu s-au găsit cheltuieli.</td></tr>`;
  else {
    const showPageTotal = perPage < filtered.length; // only show page total if there's more than 1 page
    html += `
      ${showPageTotal ? `
      <tr style="background:var(--surface2)">
        <td colspan="8" style="text-align:right;font-weight:600;color:var(--muted);padding:6px 12px;font-size:11px;">Total Pagina ${_expPage}:</td>
        <td class="num" style="color:var(--muted);font-weight:700;font-size:12px;padding:6px 12px;">${fmt(total)} RON</td>
        <td></td>
</tr>` : ''}
      <tr style="background:var(--surface2); border-top:2px solid var(--border)">
        <td colspan="8" style="text-align:right;font-weight:800;color:var(--text);padding:10px 12px;">${isFiltered ? 'Total Filtrat:' : 'Total General:'}</td>
        <td class="num" style="color:var(--red);font-weight:800;font-size:14px;padding:10px 12px;">${fmt(totalGeneral)} RON</td>
        <td></td>
</tr>
${isFiltered ? `<tr style="background:var(--surface2)"><td colspan="8" style="text-align:right;font-size:11px;color:var(--muted);padding:4px 12px;">Total General (fara filtre):</td><td class="num" style="font-size:11px;color:var(--muted);padding:4px 12px;">${fmt(totalAll)} RON</td><td></td></tr>` : ''}
    `;
  }
  
  tbody.innerHTML = html;
}




// ─── EXPENSE FILTERS + CHARTS ────────────────────────────────────────────────
let _expChartDep = null, _expChartTime = null, _expChartTip = null;

window.applyExpFilters = function() { _expPage = 1; window.renderExpensesTable(); window.renderExpCharts(); }
window.resetExpFilters = function() {
  ['exp-filter-loc','exp-filter-dep','exp-filter-tip'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  applyExpFilters();
}

function getExpFiltered() {
  const q   = (document.getElementById('exp-search')?.value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const locCheckboxes = document.querySelectorAll('.exp-loc-cb:checked');
  const locs = Array.from(locCheckboxes).map(cb => cb.value).filter(Boolean);
  
  const dep = document.getElementById('exp-filter-dep')?.value || '';
  const tip = document.getElementById('exp-filter-tip')?.value || '';
  
  return _expensesData.filter(r => {
    if (q && ![r.explanation, r.location_name, r.department_name, r.vendor_name, r.expenditure_type_name].join(' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)) return false;
    
    const rloc = (r.location_name||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (locs.length > 0 && !locs.includes(rloc)) return false;
    
    if (dep && (r.department_name||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") !== dep) return false;
    if (tip && (r.expenditure_type_name||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") !== tip) return false;
    return true;
  });
}

function populateExpFilterOptions() {
  const locs = [...new Set(_expensesData.map(r => r.location_name).filter(Boolean))].sort();
  const deps = [...new Set(_expensesData.map(r => r.department_name).filter(Boolean))].sort();
  const tips = [...new Set(_expensesData.map(r => r.expenditure_type_name).filter(Boolean))].sort();
  const locEl = document.getElementById('exp-filter-loc');
  const depEl = document.getElementById('exp-filter-dep');
  const tipEl = document.getElementById('exp-filter-tip');
  
  if (locEl) {
    locEl.innerHTML = locs.map(l => `<label style="display:flex; align-items:center; gap:8px; font-size:12px; padding:6px 8px; cursor:pointer; border-radius:8px; transition:background 0.2s; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'"><input type="checkbox" class="exp-loc-cb" value="${l.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}" onchange="updateExpLocSelectText()"> ${l}</label>`).join('');
  }
  if (depEl) depEl.innerHTML = '<option value="">Toate departamentele</option>' + deps.map(d => `<option value="${d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}">${d}</option>`).join('');
  if (tipEl) tipEl.innerHTML = '<option value="">Toate tipurile</option>' + tips.map(t => `<option value="${t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}">${t}</option>`).join('');
}

window.renderExpCharts = function() {
  const data = getExpFiltered().filter(r => !r.is_hidden);
  // Vibrant, highly distinct UI colors for charts
  const COLORS = ['#FF3366', '#20D6B5', '#F5A623', '#9B51E0', '#3498DB', '#F1C40F', '#E74C3C', '#2ECC71', '#34495E', '#1ABC9C'];

  // Chart 0: per location (Doughnut)
  const locMap = {};
  data.forEach(r => { const l = r.location_name||'Altele'; locMap[l] = (locMap[l]||0) + r.amount; });
  const loc8 = Object.entries(locMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const c0 = document.getElementById('exp-chart-loc');
  if (c0) {
    if (window._expChartLoc) window._expChartLoc.destroy();
    window._expChartLoc = new Chart(c0, { type:'doughnut',
      plugins: [ChartDataLabels],
      data:{ labels:loc8.map(([k])=>k.length>14?k.slice(0,12)+'…':k), datasets:[{data:loc8.map(([,v])=>v), backgroundColor:COLORS, borderWidth:0}] },
      options:{ 
        responsive:true, maintainAspectRatio:false, cutout:'65%', 
        plugins:{
          legend:{position:'right', labels:{color:'#94a3b8', font:{size:9}, boxWidth:8}},
          datalabels: {
            color: '#fff',
            font: {weight: 'bold', size: 10},
            formatter: (val) => val >= 1000 ? (val/1000).toFixed(0)+'k' : val
          }
        },
        onHover: (e, elements) => { e.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const clickedLoc = loc8[idx][0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const filterEl = document.getElementById('exp-filter-loc');
            if (filterEl && clickedLoc !== 'altele' && clickedLoc !== 'fără locație') {
              filterEl.value = clickedLoc;
              applyExpFilters();
            }
          }
        }
      }
    });
  }

  // Chart 1: per department (horizontal bar sorted desc) -> Premium Bar
  const depMap = {};
  data.forEach(r => { const d = r.department_name||'Altele'; depMap[d] = (depMap[d]||0) + r.amount; });
  const dep10 = Object.entries(depMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const c1 = document.getElementById('exp-chart-dep');
  if (c1) {
    if (window._expChartDep) window._expChartDep.destroy();
    window._expChartDep = new Chart(c1, { type:'bar',
      plugins: [ChartDataLabels],
      data:{ labels:dep10.map(([k])=>k.length>18?k.slice(0,16)+'…':k), datasets:[{data:dep10.map(([,v])=>v), backgroundColor:COLORS, borderRadius:6, barPercentage: 0.7}] },
      options:{ 
        indexAxis:'y',
        responsive:true, maintainAspectRatio:false, 
        plugins:{
          legend:{display:false},
          datalabels: {
            color: '#fff',
            font: {weight: 'bold', size: 9},
            anchor: 'end',
            align: 'start',
            formatter: (val) => val >= 1000 ? (val/1000).toFixed(0)+'k' : val
          }
        },
        scales:{ x:{grid:{color:'rgba(255,255,255,0.05)'}, ticks:{font:{size:9},color:'#94a3b8', callback:v=>v>=1000?(v/1000).toFixed(0)+'k':v}}, y:{grid:{display:false}, ticks:{font:{size:9, weight:'600'},color:'#cbd5e1'}} },
        onHover: (e, elements) => { e.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const clickedDep = dep10[idx][0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const filterEl = document.getElementById('exp-filter-dep');
            if (filterEl && clickedDep !== 'altele' && clickedDep !== 'fără dep.') {
              filterEl.value = clickedDep;
              applyExpFilters();
            }
          }
        }
      }
    });
  }

  // Chart 2: evolution in time -> Beautiful line with gradient
  let useMonth = false;
  if (data && data.length > 0) {
    let minD = data[0].date;
    let maxD = data[0].date;
    for (let r of data) {
      if (r.date < minD) minD = r.date;
      if (r.date > maxD) maxD = r.date;
    }
    if (minD && maxD) {
      const diff = (new Date(maxD) - new Date(minD)) / (1000 * 60 * 60 * 24);
      if (diff > 31) useMonth = true;
    }
  }
  
  const timeMap = {};
  data.forEach(r => { 
    let key = r.date;
    if (useMonth && key) key = key.substring(0, 7);
    timeMap[key] = (timeMap[key]||0) + r.amount; 
  });
  const times = Object.entries(timeMap).sort((a,b)=>a[0].localeCompare(b[0]));
  const formatTimeKey = (k) => {
    if (k.length === 7) {
      const parts = k.split('-');
      const mo = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
      return `${mo[parseInt(parts[1],10)-1]} '${parts[0].slice(-2)}`;
    }
    return k.length === 10 ? k.slice(5) : k;
  };
  const c2 = document.getElementById('exp-chart-time');
  if (c2) {
    const ctx = c2.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,180);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    if (window._expChartTime) window._expChartTime.destroy();
    window._expChartTime = new Chart(ctx, { type:'line',
      data:{ labels:times.map(([k])=>formatTimeKey(k)), datasets:[{data:times.map(([,v])=>v), borderColor:'#10b981', backgroundColor:grad, fill:true, tension:0.4, pointRadius:3, pointBackgroundColor:'#fff', pointBorderColor:'#10b981', borderWidth:3}] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{mode:'index', intersect:false}},
        scales:{ x:{grid:{display:false}, ticks:{font:{size:9},color:'#94a3b8',maxRotation:40}}, y:{grid:{color:'rgba(255,255,255,0.05)'}, ticks:{font:{size:9},color:'#94a3b8', callback:v=>v>=1000?(v/1000).toFixed(0)+'k':v}} } }
    });
  }

  // Chart 3: top 8 types (bar) -> Vertical bars
  const tipMap = {};
  data.forEach(r => { const t = r.expenditure_type_name||'Necategorizat'; tipMap[t] = (tipMap[t]||0) + r.amount; });
  const tip8 = Object.entries(tipMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const c3 = document.getElementById('exp-chart-tip');
  if (c3) {
    if (window._expChartTip) window._expChartTip.destroy();
    window._expChartTip = new Chart(c3, { type:'bar',
      plugins: [ChartDataLabels],
      data:{ labels:tip8.map(([k])=>k.length>14?k.slice(0,12)+'…':k), datasets:[{data:tip8.map(([,v])=>v), backgroundColor:COLORS, borderRadius:6, barPercentage: 0.6}] },
      options:{ 
        responsive:true, maintainAspectRatio:false, 
        plugins:{
          legend:{display:false},
          datalabels: {
            color: '#fff',
            font: {weight: 'bold', size: 9},
            anchor: 'end',
            align: 'start',
            formatter: (val) => val >= 1000 ? (val/1000).toFixed(0)+'k' : val
          }
        },
        scales:{ x:{grid:{display:false}, ticks:{font:{size:9},color:'#94a3b8',maxRotation:40}}, y:{grid:{color:'rgba(255,255,255,0.05)'}, ticks:{font:{size:9},color:'#94a3b8', callback:v=>v>=1000?(v/1000).toFixed(0)+'k':v}} },
        onHover: (e, elements) => { e.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const clickedTip = tip8[idx][0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const filterEl = document.getElementById('exp-filter-tip');
            if (filterEl && clickedTip !== 'necategorizat') {
              filterEl.value = clickedTip;
              applyExpFilters();
            }
          }
        }
      }
    });
  }
}
// ─── END EXPENSE FILTERS + CHARTS ────────────────────────────────────────────

// --- EXPENSES CONFIG SETTINGS ---
let _expConfigDeps = [];

window.loadExpensesConfig = async function() {
  try {
    const data = await api('/api/admin/expenses_config');
    _expConfigDeps = data.departments || [];

    const depEl = document.getElementById('set-exp-deps');
    if (!depEl) return;

    // Render department list on left
    depEl.innerHTML = _expConfigDeps.map(dep => `
      <div class="exp-dep-row" data-id="${dep.id}"
        style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid var(--border); cursor:pointer; transition:background .15s;"
        onclick="expSelectDep('${dep.id}', this)">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:12px; color:var(--text); font-weight:500;">${dep.name}</span>
          ${dep.is_local ? `<span style="font-size:8px; background:var(--accent); color:#fff; padding:1px 4px; border-radius:3px;">LOCAL</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${dep.is_local ? `<button onclick="deleteLocalDepartment('${dep.id}', event)" style="background:none; border:none; cursor:pointer; color:var(--red); padding:0; display:flex; align-items:center; justify-content:center;" title="Șterge departament">×</button>` : ''}
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" class="cfg-dep" value="${dep.id}" ${dep.is_expense ? 'checked' : ''}
              onchange="onExpDepToggle('${dep.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `).join('');

    // Auto-select first
    const firstRow = depEl.querySelector('.exp-dep-row');
    if (firstRow) expSelectDep(_expConfigDeps[0].id, firstRow);

  } catch(e) { console.error('loadExpensesConfig error:', e); }
}

window.expSelectDep = function(depId, el) {
  // Highlight selected row
  document.querySelectorAll('.exp-dep-row').forEach(r => r.style.background = '');
  if (el) el.style.background = 'color-mix(in srgb, var(--accent) 12%, transparent)';

  const dep = _expConfigDeps.find(d => d.id === depId);
  const label = document.getElementById('set-exp-dep-filter-label');
  if (label) label.textContent = dep ? dep.name : '';

  const typesEl = document.getElementById('set-exp-types');
  if (!typesEl || !dep) return;

  // Întotdeauna activăm butonul Tip Nou când este selectat un departament
  const btnType = document.getElementById('btn-add-local-type');
  if (btnType) {
    btnType.style.opacity = '1';
    btnType.style.pointerEvents = 'auto';
  }

  if (!dep.types || dep.types.length === 0) {
    typesEl.innerHTML = '<div style="padding:20px; text-align:center; font-size:12px; color:var(--muted);">Nicio categorie definită.</div>';
    return;
  }

  // Sync master toggle
  const masterT = document.getElementById('exp-all-toggle');
  if (masterT) masterT.checked = dep.types.length > 0 && dep.types.every(t => t.is_expense);

  typesEl.innerHTML = dep.types.map(t => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid var(--border);">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:12px; color:var(--text);">${t.name}</span>
        ${t.is_local ? '<span style="font-size:8px; background:var(--accent); color:#fff; padding:1px 4px; border-radius:3px;">LOCAL</span>' : ''}
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        ${t.is_local ? `<button onclick="deleteLocalType('${dep.id}', '${t.id}', event)" style="background:none; border:none; cursor:pointer; color:var(--red); padding:0; display:flex; align-items:center; justify-content:center;" title="Șterge tip">×</button>` : ''}
        <label class="toggle">
          <input type="checkbox" class="cfg-type" value="${t.id}" data-dep="${dep.id}" ${t.is_expense ? 'checked' : ''}
            onchange="onExpTypeToggle('${dep.id}','${t.id}',this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  `).join('');
}

window.onExpDepToggle = function(depId, isChecked) {
  const dep = _expConfigDeps.find(d => d.id === depId);
  if (!dep) return;
  dep.is_expense = isChecked;
  dep.types.forEach(t => t.is_expense = isChecked);
  // Refresh right panel if this dept is selected
  const selectedRow = document.querySelector(`.exp-dep-row[data-id="${depId}"]`);
  if (selectedRow && selectedRow.style.background !== '') {
    expSelectDep(depId, selectedRow);
  }
}

window.onExpTypeToggle = function(depId, typeId, isChecked) {
  const dep = _expConfigDeps.find(d => d.id === depId);
  if (dep) { const t = dep.types.find(t => t.id === typeId); if (t) t.is_expense = isChecked; }
}

window.expTypesAll = function(isChecked) {
  // Find selected dept from highlighted row
  let depId = null;
  document.querySelectorAll('.exp-dep-row').forEach(r => {
    if (r.style.background && r.style.background !== '') depId = r.dataset.id;
  });
  if (!depId) return;
  const dep = _expConfigDeps.find(d => d.id === depId);
  if (!dep) return;
  dep.types.forEach(t => t.is_expense = isChecked);
  // Update visible type checkboxes
  document.querySelectorAll('#set-exp-types .cfg-type').forEach(cb => cb.checked = isChecked);
  // Sync master toggle
  const masterToggle = document.getElementById('exp-all-toggle');
  if (masterToggle) masterToggle.checked = isChecked;
}


window.saveExpensesConfig = async function() {
  const exclTypes = []; 
  const localDeps = [];
  const localTypes = [];
  
  _expConfigDeps.forEach(d => {
    if (d.is_local) localDeps.push({id: d.id, name: d.name});
    (d.types||[]).forEach(t => { 
      if(!t.is_expense && !exclTypes.includes(t.id)) exclTypes.push(t.id); 
      if(t.is_local) localTypes.push({id: t.id, name: t.name, department_id: d.id});
    }); 
  });
  
  try {
    const token = localStorage.getItem('cp2_token');
    const r = await fetch(API + '/api/admin/expenses_config', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        excluded_departments: [], 
        excluded_types: exclTypes,
        local_departments: localDeps,
        local_types: localTypes
      })
    });
    const res = await r.json();
    if(!res.success) console.error('Eroare la salvare configuratie cheltuieli');
    else console.log('Configuratie cheltuieli salvata:', exclTypes.length, 'tipuri excluse');
  } catch(e) { console.error(e); }
}

let _promptResolve = null;
window.customPrompt = function(title) {
  return new Promise(resolve => {
    _promptResolve = resolve;
    document.getElementById('custom-prompt-title').textContent = title;
    const input = document.getElementById('custom-prompt-input');
    input.value = '';
    document.getElementById('modal-custom-prompt').classList.add('show');
    setTimeout(() => input.focus(), 50);
  });
}
window.customPromptCancel = function() {
  document.getElementById('modal-custom-prompt').classList.remove('show');
  if(_promptResolve) { _promptResolve(null); _promptResolve = null; }
}
window.customPromptSubmit = function(e) {
  if(e) e.preventDefault();
  document.getElementById('modal-custom-prompt').classList.remove('show');
  const val = document.getElementById('custom-prompt-input').value;
  if(_promptResolve) { _promptResolve(val); _promptResolve = null; }
}

let _confirmResolve = null;
window.customConfirm = function(message) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('custom-confirm-message').textContent = message;
    document.getElementById('modal-custom-confirm').classList.add('show');
  });
}
window.customConfirmCancel = function() {
  document.getElementById('modal-custom-confirm').classList.remove('show');
  if(_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
}
window.customConfirmSubmit = function() {
  document.getElementById('modal-custom-confirm').classList.remove('show');
  if(_confirmResolve) { _confirmResolve(true); _confirmResolve = null; }
}

window.addLocalDepartment = async function() {
  const name = await customPrompt("Nume departament local:");
  if (!name || name.trim() === '') return;
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  _expConfigDeps.push({ id: id, name: name.trim(), types: [], is_local: true, is_expense: true });
  _expConfigDeps.sort((a,b) => {
     if(a.is_local !== b.is_local) return a.is_local ? 1 : -1;
     return a.name.localeCompare(b.name);
  });
  const depEl = document.getElementById('set-exp-deps');
  if(depEl) {
    depEl.innerHTML = _expConfigDeps.map(dep => `
      <div class="exp-dep-row" data-id="${dep.id}"
        style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid var(--border); cursor:pointer; transition:background .15s;"
        onclick="expSelectDep('${dep.id}', this)">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:12px; color:var(--text); font-weight:500;">${dep.name}</span>
          ${dep.is_local ? '<span style="font-size:8px; background:var(--accent); color:#fff; padding:1px 4px; border-radius:3px;">LOCAL</span>' : ''}
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${dep.is_local ? `<button onclick="deleteLocalDepartment('${dep.id}', event)" style="background:none; border:none; cursor:pointer; color:var(--red); padding:0; display:flex; align-items:center; justify-content:center;" title="Șterge departament">×</button>` : ''}
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" class="cfg-dep" value="${dep.id}" ${dep.is_expense ? 'checked' : ''}
              onchange="onExpDepToggle('${dep.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `).join('');
  }
  saveExpensesConfig();
}

window.deleteLocalDepartment = async function(id, event) {
  event.stopPropagation();
  const ok = await customConfirm('Ștergi acest departament local și toate tipurile lui?');
  if(!ok) return;
  _expConfigDeps = _expConfigDeps.filter(d => d.id !== id);
  const depEl = document.getElementById('set-exp-deps');
  if(depEl) {
    depEl.innerHTML = _expConfigDeps.map(dep => `
      <div class="exp-dep-row" data-id="${dep.id}"
        style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid var(--border); cursor:pointer; transition:background .15s;"
        onclick="expSelectDep('${dep.id}', this)">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:12px; color:var(--text); font-weight:500;">${dep.name}</span>
          ${dep.is_local ? '<span style="font-size:8px; background:var(--accent); color:#fff; padding:1px 4px; border-radius:3px;">LOCAL</span>' : ''}
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${dep.is_local ? `<button onclick="deleteLocalDepartment('${dep.id}', event)" style="background:none; border:none; cursor:pointer; color:var(--red); padding:0; display:flex; align-items:center; justify-content:center;" title="Șterge departament">×</button>` : ''}
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" class="cfg-dep" value="${dep.id}" ${dep.is_expense ? 'checked' : ''}
              onchange="onExpDepToggle('${dep.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `).join('');
    document.getElementById('set-exp-types').innerHTML = '';
  }
  saveExpensesConfig();
}

window.addLocalType = async function() {
  let depId = null;
  document.querySelectorAll('.exp-dep-row').forEach(r => {
    if (r.style.background && r.style.background !== '') depId = r.dataset.id;
  });
  if (!depId) {
    showAlert("Selectează mai întâi un departament din stânga!");
    return;
  }
  const dep = _expConfigDeps.find(d => d.id === depId);
  if (!dep) return;
  const name = await customPrompt("Nume tip cheltuială local:");
  if (!name || name.trim() === '') return;
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  dep.types.push({ id: id, name: name.trim(), is_expense: true, is_local: true });
  dep.types.sort((a,b) => {
     if(a.is_local !== b.is_local) return a.is_local ? 1 : -1;
     return a.name.localeCompare(b.name);
  });
  expSelectDep(depId, document.querySelector(`.exp-dep-row[data-id="${depId}"]`));
  saveExpensesConfig();
}

window.deleteLocalType = async function(depId, typeId, event) {
  event.stopPropagation();
  const ok = await customConfirm('Ștergi acest tip local?');
  if(!ok) return;
  const dep = _expConfigDeps.find(d => d.id === depId);
  if (dep) {
    dep.types = dep.types.filter(t => t.id !== typeId);
    expSelectDep(depId, document.querySelector(`.exp-dep-row[data-id="${depId}"]`));
    saveExpensesConfig();
  }
}

// ─── MANUAL EXPENSES & IMPORTS ──────────────────────────────────────────────

window._expenseTypes = [];

window.openAddExpenseModal = async function() {
  const dateInput = document.getElementById('me-date');
  if (!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-add-expense').classList.add('show');
  await window.fetchExpenseFormData();
}

window.fetchExpenseFormData = async function() {
  const dateVal = document.getElementById('me-date').value || new Date().toISOString().split('T')[0];
  try {
    const data = await api('/api/admin/expense_form_data?date=' + dateVal);
    
    window._expenseTypes = data.types || [];
    
    let depHtml = '<option value="">Alege...</option>';
    data.departments.forEach(d => depHtml += `<option value="${d.id}">${d.name}</option>`);
    const depSelect = document.getElementById('me-dep');
    const selectedDep = depSelect.value;
    depSelect.innerHTML = depHtml;
    if (data.departments.find(d => d.id === selectedDep)) depSelect.value = selectedDep;

    window.filterExpenseTypes();

    let locsHtml = '';
    const selectedLocs = Array.from(document.querySelectorAll('input[name="me-loc"]:checked')).map(c => c.value);
    
    data.locations.forEach(l => {
      const isChecked = selectedLocs.includes(l.id) ? 'checked' : '';
      locsHtml += `<label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer;"><input type="checkbox" name="me-loc" value="${l.id}" data-slots="${l.slots||0}" onchange="checkLocsSelection()" ${isChecked}> <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${l.name}">${l.name}</span> <span style="color:var(--accent); font-size:10px; font-weight:bold;">${l.slots > 0 ? `(${l.slots} sloturi)` : ''}</span></label>`;
    });
    document.getElementById('me-locs-container').innerHTML = locsHtml;
    
    // Uncheck "Selectează Tot" since we are rendering the boxes again, but preserve actual checkboxes state above
    const allCb = document.getElementById('me-loc-all');
    if (allCb) allCb.checked = false;
    
    checkLocsSelection();
  } catch(e) {
    console.error(e);
  }
}

window.filterExpenseTypes = function() {
  const depId = document.getElementById('me-dep').value;
  const typeSelect = document.getElementById('me-type');
  const selectedType = typeSelect.value;
  
  let typeHtml = '<option value="">Alege...</option>';
  const filtered = window._expenseTypes.filter(t => t.department_id === depId);
  filtered.forEach(t => typeHtml += `<option value="${t.id}">${t.name}</option>`);
  
  typeSelect.innerHTML = typeHtml;
  if (filtered.find(t => t.id === selectedType)) {
    typeSelect.value = selectedType;
  }
}

window.toggleAllLocs = function(cb) {
  const cbs = document.querySelectorAll('input[name="me-loc"]');
  cbs.forEach(c => c.checked = cb.checked);
  checkLocsSelection();
}

window.checkLocsSelection = function() {
  const cbs = document.querySelectorAll('input[name="me-loc"]:checked');
  const strat = document.getElementById('me-split-strategy');
  if (cbs.length > 1) {
    strat.style.display = 'block';
  } else {
    strat.style.display = 'none';
  }
  if (window.updateSplitPreview) window.updateSplitPreview();
}

window.updateSplitPreview = function() {
  const cbs = document.querySelectorAll('input[name="me-loc"]:checked');
  const preview = document.getElementById('me-split-preview');
  const amountInput = document.getElementById('me-amount');
  
  if (!preview) return;
  
  if (cbs.length <= 1 || !amountInput.value) {
    preview.innerHTML = '';
    return;
  }
  
  const amount = parseFloat(amountInput.value);
  if (isNaN(amount) || amount === 0) {
    preview.innerHTML = '';
    return;
  }
  
  let split_mode = 'equal';
  const radios = document.getElementsByName('split_mode');
  for (let r of radios) { if (r.checked) split_mode = r.value; }
  
  let html = '<div style="margin-bottom:4px;"><strong>Previzualizare sume pe locații:</strong></div><div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">';
  
  if (split_mode === 'equal') {
    const val = (amount / cbs.length).toFixed(2);
    cbs.forEach(c => {
      const name = c.nextElementSibling.title || c.nextElementSibling.innerText;
      html += `<div>• <span style="font-weight:600;">${name}</span>: <span style="color:var(--success); font-weight:bold;">${val} RON</span></div>`;
    });
  } else {
    let totalSlots = 0;
    cbs.forEach(c => totalSlots += parseInt(c.getAttribute('data-slots') || '0', 10));
    
    if (totalSlots === 0) {
      html += '<div style="color:var(--danger); grid-column: 1 / -1;">Locațiile selectate nu au sloturi setate. Suma nu poate fi împărțită proporțional.</div>';
    } else {
      cbs.forEach(c => {
        const slots = parseInt(c.getAttribute('data-slots') || '0', 10);
        const name = c.nextElementSibling.title || c.nextElementSibling.innerText;
        const val = ((amount * slots) / totalSlots).toFixed(2);
        html += `<div>• <span style="font-weight:600;">${name}</span> (${slots} ap): <span style="color:var(--success); font-weight:bold;">${val} RON</span></div>`;
      });
    }
  }
  html += '</div>';
  preview.innerHTML = html;
}

window.submitManualExpense = async function(e) {
  e.preventDefault();
  const cbs = document.querySelectorAll('input[name="me-loc"]:checked');
  if (cbs.length === 0) return showAlert('Te rog selectează cel puțin o locație.');
  
  const loc_ids = Array.from(cbs).map(c => c.value);
  let split_mode = 'equal';
  const radios = document.getElementsByName('split_mode');
  for (let r of radios) { if (r.checked) split_mode = r.value; }

  const payload = {
    date: document.getElementById('me-date').value,
    amount: parseFloat(document.getElementById('me-amount').value),
    explanation: document.getElementById('me-expl').value,
    department_id: document.getElementById('me-dep').value,
    expenditure_type_id: document.getElementById('me-type').value,
    loc_ids: loc_ids,
    split_mode: loc_ids.length > 1 ? split_mode : 'equal'
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerText = 'Se salvează...';

  try {
    const r = await fetch(API + '/api/admin/expenses', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('cp2_token')
      },
      body: JSON.stringify(payload)
    });
    const res = await r.json();
    if (res.success) {
      document.getElementById('modal-add-expense').classList.remove('show');
      e.target.reset();
      if (typeof loadExpensesData !== 'undefined') loadExpensesData();
      else if (typeof window.loadExpensesReport === 'function') window.loadExpensesReport();
    } else {
      showAlert('Eroare: ' + (res.error || 'Necunoscută'));
    }
  } catch(err) {
    showAlert('Eroare la salvare.');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Salvează Cheltuiala';
  }
}

window.toggleExpenseVisibility = async function(id) {
  try {
    const res = await api('/api/admin/expenses/' + id + '/toggle_hide', { method: 'POST' });
    if (res.success) {
      if (window.loadExpensesReport) {
        await window.loadExpensesReport();
      }
    } else {
      showAlert('Eroare la comutare vizibilitate: ' + (res.error || 'Necunoscută'));
    }
  } catch (e) {
    showAlert('Eroare rețea: ' + e);
  }
}

window.openImportExpenseModal = function() {
  document.getElementById('import-gs-link').value = '';
  document.getElementById('import-status').innerText = '';
  document.getElementById('import-preview-container').style.display = 'none';
  document.getElementById('btn-confirm-import').style.display = 'none';
  document.getElementById('btn-do-import').style.display = 'block';
  document.getElementById('modal-import-expense').classList.add('show');
}

window.submitImportExpense = async function(e) {
  e.preventDefault();
  const link = document.getElementById('import-gs-link').value;
  if (!link.includes('docs.google.com/spreadsheets')) return showAlert('Te rog introdu un link valid de Google Sheets.');

  const btn = document.getElementById('btn-do-import');
  const stat = document.getElementById('import-status');
  btn.disabled = true;
  btn.innerText = 'Se procesează...';
  stat.innerText = 'Se preiau datele din document. Te rog așteaptă...';
  stat.style.color = 'var(--text)';
  
  document.getElementById('import-preview-container').style.display = 'none';
  document.getElementById('btn-confirm-import').style.display = 'none';

  try {
    const r = await fetch(API + '/api/admin/expenses_import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: link, preview: true })
    });
    const res = await r.json();
    if (res.success) {
      if (res.preview_data && res.preview_data.length > 0) {
        stat.innerText = `S-au găsit ${res.preview_data.length} rânduri valide. Verifică datele și confirmă salvarea.`;
        stat.style.color = 'var(--blue)';
        
        let html = '';
        for (const p of res.preview_data) {
          html += `<tr>
            <td>${p.date}</td>
            <td>${p.location_name}</td>
            <td>${p.department_name}</td>
            <td>${p.category_name}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.explanation}">${p.explanation}</td>
            <td>${p.details || '-'}</td>
            <td class="num">${fmt(p.amount)}</td>
          </tr>`;
        }
        document.getElementById('import-preview-body').innerHTML = html;
        document.getElementById('import-preview-container').style.display = 'block';
        
        btn.style.display = 'none';
        document.getElementById('btn-confirm-import').style.display = 'block';
      } else {
        stat.innerText = 'Nu s-au găsit date valide în fișier (sau coloanele nu corespund).';
        stat.style.color = 'var(--orange)';
      }
    } else {
      stat.innerText = 'Eroare: ' + (res.error || 'Structura fișierului este incorectă.');
      stat.style.color = 'var(--red)';
    }
  } catch(err) {
    stat.innerText = 'Eroare la procesarea importului.';
    stat.style.color = 'var(--red)';
  } finally {
    btn.disabled = false;
    btn.innerText = 'Preia Datele';
  }
}

window.confirmImportExpense = async function() {
  const link = document.getElementById('import-gs-link').value;
  const btnC = document.getElementById('btn-confirm-import');
  const stat = document.getElementById('import-status');
  
  btnC.disabled = true;
  btnC.innerText = 'Se salvează...';
  stat.innerText = 'Se salvează datele în baza de date. Te rog așteaptă...';
  stat.style.color = 'var(--text)';
  
  try {
    const r = await fetch(API + '/api/admin/expenses_import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: link, preview: false })
    });
    const res = await r.json();
    if (res.success) {
      stat.innerText = `Succes! Au fost importate ${res.inserted_count} înregistrări.`;
      stat.style.color = 'var(--green)';
      setTimeout(() => {
        document.getElementById('modal-import-expense').classList.remove('show');
        if (typeof loadExpensesData !== 'undefined') loadExpensesData();
        else if (typeof window.loadExpensesReport === 'function') window.loadExpensesReport();
      }, 2000);
    } else {
      stat.innerText = 'Eroare: ' + (res.error || 'A apărut o problemă la salvare.');
      stat.style.color = 'var(--red)';
      btnC.disabled = false;
      btnC.innerText = 'Confirmă și Salvează';
    }
  } catch(err) {
    stat.innerText = 'Eroare la salvare.';
    stat.style.color = 'var(--red)';
    btnC.disabled = false;
    btnC.innerText = 'Confirmă și Salvează';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('edit-exp-dep')) {
    updateEditExpTypes();
  }
  if (document.getElementById('bulk-edit-dep')) {
    updateBulkEditTypes();
  }
});

// ============================================
// EXPENSE EDIT & BULK ACTIONS
// ============================================

window.toggleAllExpenses = function(cb) {
  const checkboxes = document.querySelectorAll('.exp-row-cb');
  checkboxes.forEach(c => c.checked = cb.checked);
  updateExpBulkToolbar();
}

window.updateExpBulkToolbar = function() {
  const count = document.querySelectorAll('.exp-row-cb:checked').length;
  const toolbar = document.getElementById('exp-bulk-toolbar');
  const countSpan = document.getElementById('exp-bulk-count');
  
  if (count > 0) {
    toolbar.style.display = 'flex';
    countSpan.innerText = count + ' selectate';
  } else {
    toolbar.style.display = 'none';
    const selectAll = document.getElementById('exp-select-all');
    if(selectAll) selectAll.checked = false;
  }
}

window.openEditExpense = async function(id) {
  const exp = _expensesData.find(e => String(e.id) === String(id));
  if (!exp) return appAlert('Nu am găsit cheltuiala.');
  
  // Fetch form data for dropdowns
  const data = await api('/api/admin/expense_form_data?date=' + exp.date);
  window._expenseTypes = data.types || [];
  const departments = data.departments || [];
  
  document.getElementById('edit-exp-id').value = exp.id;
  document.getElementById('edit-exp-date').value = exp.date;
  document.getElementById('edit-exp-amount').value = exp.amount;
  document.getElementById('edit-exp-expl').value = exp.explanation;
  
  const depSel = document.getElementById('edit-exp-dep');
  depSel.innerHTML = '';
  for (let d of departments) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    if (d.name === exp.department_name) opt.selected = true;
    depSel.appendChild(opt);
  }
  
  updateEditExpTypes();
  const typeSel = document.getElementById('edit-exp-type');
  for (let t of Array.from(typeSel.options)) {
    if (t.textContent === exp.expenditure_type_name) t.selected = true;
  }
  
  document.getElementById('modal-edit-expense').classList.add('show');
}

window.updateEditExpTypes = function() {
  const did = document.getElementById('edit-exp-dep').value;
  const sel = document.getElementById('edit-exp-type');
  sel.innerHTML = '';
  for (let t of (window._expenseTypes || []).filter(x => String(x.department_id) === String(did))) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  }
}

window.submitEditExpense = async function(e) {
  e.preventDefault();
  const id = document.getElementById('edit-exp-id').value;
  const payload = {
    date: document.getElementById('edit-exp-date').value,
    amount: parseFloat(document.getElementById('edit-exp-amount').value),
    explanation: document.getElementById('edit-exp-expl').value,
    department_id: document.getElementById('edit-exp-dep').value,
    expenditure_type_id: document.getElementById('edit-exp-type').value
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerText = 'Se salvează...';

  try {
    const r = await fetch(API + '/api/admin/expenses/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await r.json();
    if (res.success) {
      document.getElementById('modal-edit-expense').classList.remove('show');
      if (typeof window.loadExpensesReport === 'function') window.loadExpensesReport();
    } else {
      showAlert('Eroare: ' + (res.error || 'Necunoscută'));
    }
  } catch(err) {
    showAlert('Eroare la salvare.');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Salvează Modificările';
  }
}

window.bulkDeleteExpenses = async function() {
  const checked = document.querySelectorAll('.exp-row-cb:checked');
  if (checked.length === 0) return;
  
  appConfirm(`Ești sigur că vrei să ștergi ${checked.length} cheltuieli?`, async () => {
    const ids = Array.from(checked).map(c => c.value);
    
    try {
      const r = await fetch(API + '/api/admin/expenses/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids })
      });
      const res = await r.json();
      if (res.success) {
        document.getElementById('exp-bulk-toolbar').style.display = 'none';
        if(document.getElementById('exp-select-all')) document.getElementById('exp-select-all').checked = false;
        if (typeof window.loadExpensesReport === 'function') window.loadExpensesReport();
      } else {
        appAlert('Eroare: ' + (res.error || 'Nu s-a putut șterge.'));
      }
    } catch(e) {
      console.error(e);
      appAlert('Eroare la ștergerea bulk.');
    }
  });
}

window.openBulkEditExpenseModal = function() {
  const checked = document.querySelectorAll('.exp-row-cb:checked');
  if (checked.length === 0) return;
  
  document.getElementById('bulk-edit-count-display').innerText = checked.length;
  
  const depSel = document.getElementById('bulk-edit-dep');
  depSel.innerHTML = '<option value="">-- Fără modificare --</option>';
  for (let d of _departments) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    depSel.appendChild(opt);
  }
  
  document.getElementById('bulk-edit-date').value = '';
  document.getElementById('bulk-edit-type').innerHTML = '<option value="">-- Fără modificare --</option>';
  
  document.getElementById('modal-bulk-edit').classList.add('show');
}

window.updateBulkEditTypes = function() {
  const did = document.getElementById('bulk-edit-dep').value;
  const sel = document.getElementById('bulk-edit-type');
  sel.innerHTML = '<option value="">-- Fără modificare --</option>';
  if (!did) return;
  
  for (let t of _expTypes.filter(x => x.department_id === did)) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  }
}

window.submitBulkEdit = async function(e) {
  e.preventDefault();
  const checked = document.querySelectorAll('.exp-row-cb:checked');
  const ids = Array.from(checked).map(c => c.value);
  
  const payload = {
    ids: ids,
    date: document.getElementById('bulk-edit-date').value,
    department_id: document.getElementById('bulk-edit-dep').value,
    expenditure_type_id: document.getElementById('bulk-edit-type').value
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerText = 'Se aplică...';

  try {
    const r = await fetch(API + '/api/admin/expenses/bulk', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await r.json();
    if (res.success) {
      document.getElementById('modal-bulk-edit').classList.remove('show');
      document.getElementById('exp-bulk-toolbar').style.display = 'none';
      if(document.getElementById('exp-select-all')) document.getElementById('exp-select-all').checked = false;
      if (typeof window.loadExpensesReport === 'function') window.loadExpensesReport();
    } else {
      appAlert('Eroare: ' + (res.error || 'Necunoscută'));
    }
  } catch(err) {
    appAlert('Eroare la bulk edit.');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Aplică Modificările';
  }
}

// ============================================
// CUSTOM POPUPS
// ============================================
window.appConfirm = function(msg, callback) {
  let modal = document.getElementById('app-confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.id = 'app-confirm-modal';
    modal.innerHTML = `
      <div class="settings-panel" style="width:400px; max-width:90%;">
        <div class="settings-header">
          <div class="settings-title">Confirmare</div>
          <button class="settings-close" onclick="document.getElementById('app-confirm-modal').classList.remove('show')">×</button>
        </div>
        <div class="settings-body" style="padding:20px; text-align:center;">
          <p id="app-confirm-msg" style="margin-bottom:24px; font-size:14px; color:var(--text);"></p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button class="btn-ghost" style="color:var(--text);" onclick="document.getElementById('app-confirm-modal').classList.remove('show')">Anulează</button>
            <button class="btn-primary" id="app-confirm-btn" style="background:var(--red); border-color:var(--red);">Confirmă</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById('app-confirm-msg').innerText = msg;
  const btn = document.getElementById('app-confirm-btn');
  btn.onclick = () => {
    modal.classList.remove('show');
    if (callback) callback();
  };
  modal.classList.add('show');
}

window.appAlert = function(msg) {
  let modal = document.getElementById('app-alert-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.id = 'app-alert-modal';
    modal.innerHTML = `
      <div class="settings-panel" style="width:400px; max-width:90%;">
        <div class="settings-header">
          <div class="settings-title">Mesaj</div>
          <button class="settings-close" onclick="document.getElementById('app-alert-modal').classList.remove('show')">×</button>
        </div>
        <div class="settings-body" style="padding:20px; text-align:center;">
          <p id="app-alert-msg" style="margin-bottom:24px; font-size:14px; color:var(--text);"></p>
          <div style="display:flex; justify-content:center;">
            <button class="btn-primary" onclick="document.getElementById('app-alert-modal').classList.remove('show')">OK</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById('app-alert-msg').innerText = msg;
  modal.classList.add('show');
}

// ─── DISPOZITIVE ─────────────────────────────────────────────────────────────
let _dispData = [];
let _dispPage = 1;
let _dispPerPage = 50;

async function loadDispozitive() {
  try {
    const res = await fetch('/api/slots/inventory');
    if (!res.ok) throw new Error('API Error');
    _dispData = await res.json();
    _dispPage = 1;
    renderDispozitive();
  } catch (err) {
    console.error('Eroare loadDispozitive:', err);
    document.getElementById('disp-body').innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--red);">Eroare la încărcarea dispozitivelor</td></tr>`;
  }
}

window.renderDispozitive = function(forcePage) {
  if (forcePage) _dispPage = forcePage;
  const tbody = document.getElementById('disp-body');
  const term = (document.getElementById('disp-search')?.value || '').toLowerCase();
  
  let filtered = _dispData;
  if (term) {
    filtered = filtered.filter(d => 
      (d.cabinet||'').toLowerCase().includes(term) ||
      (d.provider||'').toLowerCase().includes(term) ||
      (d.tip_slot||'').toLowerCase().includes(term) ||
      (d.serial_nr||'').toLowerCase().includes(term) ||
      (d.locatie||'').toLowerCase().includes(term)
    );
  }
  
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted)">Nu s-au găsit dispozitive</td></tr>`;
    document.getElementById('disp-info').textContent = 'Arată 0 din 0 rânduri';
    document.getElementById('disp-pages').innerHTML = '';
    return;
  }
  
  const start = (_dispPage - 1) * _dispPerPage;
  const end = start + _dispPerPage;
  const pageData = filtered.slice(start, end);
  
  const maxAbsGgr = Math.max(1, ...filtered.map(x=>Math.abs(x.tot_ggr||0)));
  
  tbody.innerHTML = pageData.map((r, idx) => {
    const cc = cellCls(+r.tot_ggr||0, maxAbsGgr);
    const badge = r.status === 'Activ' 
      ? `<span style="padding:2px 8px; border-radius:12px; background:rgba(34,197,94,0.1); color:#22c55e; font-size:10px; font-weight:700;">ACTIV</span>`
      : `<span style="padding:2px 8px; border-radius:12px; background:rgba(239,68,68,0.1); color:#ef4444; font-size:10px; font-weight:700;">${(r.status||'INACTIV').toUpperCase()}</span>`;
      
    return `<tr>
      <td style="text-align:center; color:var(--muted); font-size:11px">${start + idx + 1}</td>
      <td>${badge}</td>
      <td><strong>${r.cabinet||'—'}</strong></td>
      <td>${r.serial_nr||'—'}</td>
      <td><span style="font-weight:600;color:var(--text)">${r.locatie||'Depozit'}</span></td>
      <td>${r.mix||'—'} / ${r.provider||'—'}</td>
      <td class="num">${r.tva_exp||'—'}</td>
      <td class="num">${fmt(r.tot_in)}</td>
      <td class="num ${cc}">${fmt(r.tot_ggr)}</td>
      <td class="num" style="padding-right:16px">${pill(r.rto_pct)}</td>
    </tr>`;
  }).join('');
  
  const totalPages = Math.ceil(filtered.length / _dispPerPage);
  document.getElementById('disp-info').textContent = `Arată ${start + 1} - ${Math.min(end, filtered.length)} din ${filtered.length} rânduri`;
  
  let pagesHtml = '';
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7) {
      if (p !== 1 && p !== totalPages && Math.abs(p - _dispPage) > 2) {
        if (p === 2 || p === totalPages - 1) pagesHtml += `<span style="padding:4px">...</span>`;
        continue;
      }
    }
    const act = p === _dispPage ? 'background:var(--accent);color:#fff;border-color:var(--accent)' : 'background:transparent;color:var(--text)';
    pagesHtml += `<button class="cal-nav" style="${act};font-size:12px;padding:4px 10px;border-radius:4px" onclick="_dispPage=${p};renderDispozitive()">${p}</button>`;
  }
  document.getElementById('disp-pages').innerHTML = pagesHtml;
}

window.changeDispPerPage = function(val) {
  _dispPerPage = parseInt(val);
  _dispPage = 1;
  renderDispozitive();
}

// ─── Location Details Calendar ─────────────────────────────────────────────────────────────
let ldDailyMonthData = {};
let ldHourlyDayData = {};
let ldCalViewDate = new Date();
let ldCurrentLocId = null;

async function renderLocDetailCalendar(locId, dateStr) {
  ldCurrentLocId = locId;
  ldCalViewDate = new Date(dateStr);
  await updateLdMonthCalendar(ldCalViewDate.getFullYear(), ldCalViewDate.getMonth());
}

async function updateLdMonthCalendar(y, m) {
  const mStart = `${y}-${String(m+1).padStart(2,'0')}-01`;
  const lastDay = new Date(y, m+1, 0).getDate();
  const mEnd = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  
  ldDailyMonthData = {};
  ldHourlyDayData = {};
  drawLdMonthGrid(y, m);
  drawLdHourGrid(mEnd);

  const dMonth = await api(`/api/daily?res=day&start=${mStart}&end=${mEnd}&loc_ids=${ldCurrentLocId}`);
  ldDailyMonthData = {};
  let maxValidDate = '0000-00-00';
  if (dMonth) {
    dMonth.forEach(r => { 
      ldDailyMonthData[r.date] = {ggr: r.ggr, tin:r.total_in, hh:r.hh, bet:r.bet||0}; 
      if (r.date > maxValidDate && r.total_in > 0) { maxValidDate = r.date; }
    });
  }

  let lastDataDate = mEnd;
  if (maxValidDate !== '0000-00-00' && maxValidDate <= mEnd) {
    lastDataDate = maxValidDate;
  }
  
  const dHour = await api(`/api/daily?res=hour&start=${lastDataDate}&end=${lastDataDate}&loc_ids=${ldCurrentLocId}`);
  ldHourlyDayData = {};
  if (dHour) {
    dHour.forEach(r => { ldHourlyDayData[r.date] = {ggr:r.ggr, tin:r.total_in, hh:r.hh, bet:r.bet||0}; });
  }

  drawLdMonthGrid(y, m);
  drawLdHourGrid(lastDataDate);
}

function drawLdMonthGrid(y, m) {
  document.getElementById('ld-cal-title').textContent = `${MO_RO[m]} ${y}`;
  const grid = document.getElementById('ld-calendar-grid'); grid.innerHTML = '';
  grid.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
  DA_RO.forEach(d => { const h=document.createElement('div'); h.className='cal-day-header'; h.textContent=d; grid.appendChild(h); });
  
  const first=new Date(y,m,1), last=new Date(y,m+1,0), today=new Date();
  let off=first.getDay()-1; if(off<0)off=6;
  
  let sumIn = 0, countIn = 0;
  const vals = [];
  for(let d=1; d<=last.getDate(); d++) {
    const k=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if(ldDailyMonthData[k]!==undefined){
      vals.push(ldDailyMonthData[k].ggr); 
      if(ldDailyMonthData[k].tin > 0) { sumIn += ldDailyMonthData[k].tin; countIn++; }
    }
  }
  const maxV=Math.max(...vals.filter(v=>v>0),1), minV=Math.min(...vals.filter(v=>v<0),-1);
  const avgIn = countIn > 0 ? sumIn / countIn : 1;
  
  for(let i=0;i<off;i++){ const e=document.createElement('div'); e.className='cal-day empty'; grid.appendChild(e); }
  for(let d=1;d<=last.getDate();d++){
    const k=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const row=ldDailyMonthData[k];
    const ggr=row?.ggr;
    const cell=document.createElement('div');
    const isT=today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===d;
    cell.className='cal-day'+(isT?' today':'')+(row===undefined?' cal-no-data':'');
    
    if(row!==undefined){
      const inten=ggr>=0?Math.min(1,ggr/maxV):Math.min(1,Math.abs(ggr)/Math.abs(minV));
      const alpha=(0.15+inten*0.5).toFixed(2);
      cell.style.background=ggr>=0?`rgba(16,185,129,${alpha})`:`rgba(239,68,68,${alpha})`;
      let inPct = countIn > 0 && row.tin > 0 ? ((row.tin / avgIn) - 1) * 100 : 0;
      let inArr = inPct >= 0 ? '↑' : '↓';
      let inColor = inPct >= 0 ? 'var(--success)' : 'var(--danger)';
      cell.innerHTML=`<div class="cal-day-num">${d}</div><div class="cal-day-val">${fmtK(ggr)}</div>`+
        `<div class="cal-day-metrics">IN: ${fmtK(row.tin)} <span style="color:${inColor}; font-size:9px;">${inArr}${Math.abs(inPct).toFixed(1)}%</span><br>BET:${fmtK(row.bet)} &bull; HH:${fmtK(row.hh)}</div>`;
    } else { 
      cell.innerHTML=`<div class="cal-day-num">${d}</div>`; 
    }
    grid.appendChild(cell);
  }
}

function drawLdHourGrid(selectedDate) {
  document.getElementById('ld-cal-hour-title').textContent = `Evoluție Orară - ${selectedDate}`;
  const grid=document.getElementById('ld-calendar-hour-grid'); grid.innerHTML='';
  grid.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
  let emptyHeaders = '';
  for(let i=0; i<7; i++) emptyHeaders += '<div class="cal-day-header" style="visibility:hidden;">&nbsp;</div>';
  grid.innerHTML = emptyHeaders;
  
  let sumIn = 0, countIn = 0;
  const vals = [];
  for(let i=0;i<24;i++){
    const h = (i+8)%24;
    const k = `${String(h).padStart(2,'0')}:00`;
    if(ldHourlyDayData[k]!==undefined){
      vals.push(ldHourlyDayData[k].ggr); 
      if(ldHourlyDayData[k].tin > 0) { sumIn += ldHourlyDayData[k].tin; countIn++; }
    }
  }
  const maxV=Math.max(...vals.filter(v=>v>0),1), minV=Math.min(...vals.filter(v=>v<0),-1);
  const avgIn = countIn > 0 ? sumIn / countIn : 1;
  
  for(let i=0;i<24;i++){
    const h = (i+8)%24;
    const k = `${String(h).padStart(2,'0')}:00`;
    const row=ldHourlyDayData[k]; const ggr=row?.ggr; const cell=document.createElement('div');
    cell.className='cal-day'+(row===undefined?' cal-no-data':'');
    if(row!==undefined){
      const inten=ggr>=0?Math.min(1,ggr/maxV):Math.min(1,Math.abs(ggr)/Math.abs(minV));
      const alpha=(0.15+inten*0.5).toFixed(2);
      cell.style.background=ggr>=0?`rgba(16,185,129,${alpha})`:`rgba(239,68,68,${alpha})`;
      let inPct = countIn > 0 && row.tin > 0 ? ((row.tin / avgIn) - 1) * 100 : 0;
      let inArr = inPct >= 0 ? '↑' : '↓';
      let inColor = inPct >= 0 ? 'var(--success)' : 'var(--danger)';
      cell.innerHTML=`<div class="cal-day-num">${k}</div><div class="cal-day-val">${fmtK(ggr)}</div>`+
        `<div class="cal-day-metrics">IN: ${fmtK(row.tin)} <span style="color:${inColor}; font-size:9px;">${inArr}${Math.abs(inPct).toFixed(1)}%</span><br>BET:${fmtK(row.bet)} &bull; HH:${fmtK(row.hh)}</div>`;
    } else { 
      cell.innerHTML=`<div class="cal-day-num">${k}</div>`; 
    }
    grid.appendChild(cell);
  }
  
  // Pad with empty cells to match the exact number of rows as the Month Calendar
  const y = ldCalViewDate.getFullYear(), m = ldCalViewDate.getMonth();
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  let off = first.getDay() - 1; if(off < 0) off = 6;
  const totalMonthCells = off + last.getDate();
  const numRows = Math.ceil(totalMonthCells / 7);
  const targetHourCells = numRows * 7;
  for(let i=24; i<targetHourCells; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }
}

document.getElementById('ld-cal-prev').addEventListener('click', async ()=>{
  if(!ldCurrentLocId) return;
  const m = ldCalViewDate.getMonth();
  ldCalViewDate.setMonth(m - 1);
  await updateLdMonthCalendar(ldCalViewDate.getFullYear(), ldCalViewDate.getMonth());
});
document.getElementById('ld-cal-next').addEventListener('click', async ()=>{
  if(!ldCurrentLocId) return;
  const m = ldCalViewDate.getMonth();
  ldCalViewDate.setMonth(m + 1);
  await updateLdMonthCalendar(ldCalViewDate.getFullYear(), ldCalViewDate.getMonth());
});


// --- RETENTION REPORT ---
async function loadRetentionReport() {
  const {s, e} = getPeriod();
  if (!s || !e) return;
  
  const tbody = document.getElementById('body-retentie');
  if(tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--muted); font-size:12px;">Se încarcă datele...</td></tr>';
  
  try {
    const data = await api(`/api/reports/retention?start=${s}&end=${e}`);
    
    document.getElementById('ret-kpi-promo').textContent = fmt(data.total_promo);
    document.getElementById('ret-kpi-recycled').textContent = fmt(data.total_recycled);
    document.getElementById('ret-kpi-rate').textContent = data.rate + '%';
    
    if (tbody) {
      if (!data.players || data.players.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--muted); font-size:12px;">Niciun jucător cu activitate promoțională în această perioadă.</td></tr>';
        return;
      }
      
      let html = '';
      data.players.forEach((p, idx) => {
        const promo = parseFloat(p.promo_amount) || 0;
        const recycled = parseFloat(p.total_recycled) || 0;
        const isHitAndRun = recycled === 0 && promo > 0;
        
        let hrBadge = isHitAndRun ? '<span style="background:var(--red);color:#fff;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700;letter-spacing:0.05em">DA (Fugit)</span>' : '<span style="color:var(--muted)">NU</span>';
        if (recycled > 0 && recycled < promo) hrBadge = '<span style="background:var(--yellow);color:#000;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700">Parțial</span>';
        if (recycled >= promo && promo > 0) hrBadge = '<span style="background:var(--green);color:#fff;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700">Reciclat 100%</span>';

        const locName = p.loc_name || 'Necunoscut';

        html += `
          <tr>
            <td style="padding-left:16px;">${idx + 1}</td>
            <td style="font-weight:600; color:var(--text);">${p.fname} ${p.lname} <span style="color:var(--muted); font-size:10px;">(#${p.player_id})</span></td>
            <td>${locName}</td>
            <td class="num" style="font-weight:600; color:var(--pink);">${fmt(promo)}</td>
            <td class="num" style="font-weight:600; color:var(--green);">${fmt(recycled)}</td>
            <td class="num" style="padding-right:16px;">${hrBadge}</td>
          </tr>
        `;
      });
      
      tableStates['retentie'] = { page: 1, limit: dLimit, rows: html.match(/<tr>[\s\S]*?<\/tr>/g) || [] };
      renderTablePaginated('retentie');
    }
  } catch(err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--red);">${err.message}</td></tr>`;
  }
}

function filterRetentionTable() {
  const input = document.getElementById('ret-search');
  if(!input) return;
  const filter = input.value.toLowerCase();
  const st = tableStates['retentie'];
  if(!st) return;
  
  if(!st.origRows) st.origRows = [...st.rows];
  
  if(!filter) {
    st.rows = [...st.origRows];
  } else {
    st.rows = st.origRows.filter(r => {
      const div = document.createElement('table');
      div.innerHTML = r;
      const text = div.textContent.toLowerCase();
      return text.includes(filter);
    });
  }
  delete st.parsedRows;
  st.page = 1;
  renderTablePaginated('retentie');
}

window.showGlobalHpTooltip = function(el) {
  const hpStr = el.getAttribute('data-hp');
  if (!hpStr) return;
  
  let tt = document.getElementById('global-hp-tooltip');
  if (!tt) {
    tt = document.createElement('div');
    tt.id = 'global-hp-tooltip';
    tt.style.position = 'fixed';
    tt.style.background = 'var(--surface)';
    tt.style.border = '1px solid var(--border)';
    tt.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    tt.style.padding = '12px';
    tt.style.borderRadius = '8px';
    tt.style.zIndex = '999999';
    tt.style.minWidth = '140px';
    tt.style.pointerEvents = 'none';
    tt.style.backdropFilter = 'blur(10px)';
    document.body.appendChild(tt);
  }
  const parts = hpStr.split(';');
  const maxHps = parts.map(p => {
    const [d, sum] = p.split('|');
    return { d, sum: parseFloat(sum) || 0 };
  }).sort((a,b) => b.sum - a.sum).slice(0, 5);
  
  const detailsStr = maxHps.map(x => `<div style="display:flex;justify-content:space-between;width:130px;margin-bottom:4px;font-size:11px;"><span>${(x.d||'').replace('202','2').substring(2)}</span><strong style="color:var(--green)">${fmt(x.sum)}</strong></div>`).join('');
  
  tt.innerHTML = `
    <div style="font-size:10px; font-weight:800; color:var(--text); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:4px;">Top Plăți Zilnice</div>
    ${detailsStr}
  `;
  tt.style.display = 'block';
  
  const rect = el.getBoundingClientRect();
  const ttRect = tt.getBoundingClientRect();
  tt.style.top = Math.max(10, rect.top + rect.height/2 - ttRect.height/2) + 'px';
  tt.style.left = (rect.left - ttRect.width - 15) + 'px';
};

window.hideGlobalHpTooltip = function() {
  const tt = document.getElementById('global-hp-tooltip');
  if (tt) tt.style.display = 'none';
};

// Mobile UI Adjustments
function adjustMobileUI() {
  const presets = document.querySelector('.timeline-presets');
  const modalContainer = document.getElementById('mobile-period-container');
  const topRow = document.querySelector('.timeline-top-row');
  
  if (window.innerWidth <= 600) {
    if (presets && modalContainer && presets.parentElement !== modalContainer) {
      modalContainer.appendChild(presets);
    }
  } else {
    if (presets && topRow && presets.parentElement !== topRow) {
      topRow.appendChild(presets);
    }
  }
}
window.addEventListener('resize', adjustMobileUI);
window.addEventListener('DOMContentLoaded', adjustMobileUI);
adjustMobileUI();

// ─── LUNARE REPORT ────────────────────────────────────────────────────────
let _lunareData = [];
let _lunareSort = { col: 'month', dir: 'desc' };

window.loadLunareReport = async function() {
  const serialsEl = document.getElementById('rep-lunare-serials');
  const serials = serialsEl ? serialsEl.value : '';
  const locCheckboxes = document.querySelectorAll('.lunare-loc-cb:checked');
  let customLoc = locParam();
  if (locCheckboxes && locCheckboxes.length > 0) {
    const vals = Array.from(locCheckboxes).map(cb => cb.value).filter(Boolean);
    if (vals.length > 0) customLoc = `&loc_ids=${vals.join(',')}`;
  }
  
  const { s, e } = getPeriod();
  showLoader(true);
  try {
    const data = await api(`/api/rapoarte/lunare?start=${s}&end=${e}&serials=${encodeURIComponent(serials)}${customLoc}`);
    _lunareData = data || [];
    renderLunareReport();
  } catch (err) {
    console.error('loadLunareReport error:', err);
    if (typeof showAlert === 'function') showAlert('Eroare la încărcarea raportului lunar.');
    else alert('Eroare la încărcarea raportului lunar.');
  } finally {
    showLoader(false);
  }
};

let _lunareTotalSortAsc = false;
window.sortLunareTotalMonths = function() {
  _lunareTotalSortAsc = !_lunareTotalSortAsc;
  renderLunareReport();
};

function renderLunareReport() {
  const body = document.getElementById('body-rep-lunare');
  const foot = document.getElementById('foot-rep-lunare');
  if (!body) return;
  
  if (!_lunareData || _lunareData.length === 0) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--muted);">Nu există date pentru selecția curentă.</td></tr>';
    if (foot) foot.innerHTML = '';
    return;
  }

  // Pre-calculate totals for the full dataset
  let tIn = 0, tOut = 0, tGgr = 0, tMkt = 0, tNgr = 0, tWin = 0, tBet = 0;
  const monthlyData = {};
  const locations = new Set();
  const globalSerials = new Set();
  
  _lunareData.forEach(r => {
    const inV = (+r.in_val || 0);
    const outV = (+r.out_val || 0);
    const ggrV = (+r.ggr || 0);
    const mktV = (+r.marketing || 0);
    const ngrV = (+r.ngr || 0);
    const winV = (+r.win || 0);
    const betV = (+r.bet || 0);
    tIn += inV;
    tOut += outV;
    tGgr += ggrV;
    tMkt += mktV;
    tNgr += ngrV;
    tWin += winV;
    tBet += betV;
    
    const daysActive = (+r.days_active || 0);
    if (r.serial_nr && daysActive >= 3) globalSerials.add(r.serial_nr);
    
    const m = r.month || 'Necunoscut';
    const loc = r.location_name || 'Necunoscut';
    locations.add(loc);
    
    if (!monthlyData[m]) monthlyData[m] = { in: 0, out: 0, ggr: 0, mkt: 0, ngr: 0, win: 0, bet: 0, serials: new Set(), locs: {} };
    if (!monthlyData[m].locs[loc]) monthlyData[m].locs[loc] = { in: 0, out: 0, ggr: 0, mkt: 0, ngr: 0, win: 0, bet: 0, serials: new Set() };
    
    if (r.serial_nr && daysActive >= 3) {
      monthlyData[m].serials.add(r.serial_nr);
      monthlyData[m].locs[loc].serials.add(r.serial_nr);
    }
    
    monthlyData[m].in += inV;
    monthlyData[m].out += outV;
    monthlyData[m].ggr += ggrV;
    monthlyData[m].mkt += mktV;
    monthlyData[m].ngr += ngrV;
    monthlyData[m].win += winV;
    monthlyData[m].bet += betV;
    
    monthlyData[m].locs[loc].in += inV;
    monthlyData[m].locs[loc].out += outV;
    monthlyData[m].locs[loc].ggr += ggrV;
    monthlyData[m].locs[loc].mkt += mktV;
    monthlyData[m].locs[loc].ngr += ngrV;
    monthlyData[m].locs[loc].win += winV;
    monthlyData[m].locs[loc].bet += betV;
  });

  const headTotal = document.getElementById('head-rep-lunare-total');
  const bodyTotal = document.getElementById('body-rep-lunare-total');
  const footTotal = document.getElementById('foot-rep-lunare-total');
  if (headTotal && bodyTotal) {
    const sortedLocs = Array.from(locations).sort((a,b) => a.localeCompare(b));
    const sortedMonths = Object.keys(monthlyData).sort((a,b) => _lunareTotalSortAsc ? a.localeCompare(b) : b.localeCompare(a));
    
    let headHtml = `<tr>
      <th style="cursor:pointer;" onclick="sortLunareTotalMonths()">Lună / Locație ${_lunareTotalSortAsc ? '↑' : '↓'}</th>
      <th class="num">Aparate</th>
      <th class="num">IN</th>
      <th class="num">IN Mediu</th>
      <th class="num">OUT</th>
      <th class="num">GGR</th>
      <th class="num">GGR Mediu</th>
      <th class="num">NGR</th>
      <th class="num">MKT Cost</th>
      <th class="num">WIN/BET %</th>
      <th class="num">WIN/BET NGR %</th>
    </tr>`;
    headTotal.innerHTML = headHtml;

    let totalHtml = '';
    sortedMonths.forEach(m => {
      const d = monthlyData[m];
      totalHtml += `<tr style="background:var(--surface2);">
        <td style="font-weight:700; border-top:1px solid var(--border);">${m} (TOTAL)</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border);">${d.serials.size}</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border);">${fmt(d.in)}</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border);">${d.serials.size > 0 ? fmt(d.in / d.serials.size) : 0}</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border);">${fmt(d.out)}</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border); color:${d.ggr >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(d.ggr)}</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border); color:${d.ggr >= 0 ? 'var(--green)' : 'var(--red)'}">${d.serials.size > 0 ? fmt(d.ggr / d.serials.size) : 0}</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border); color:${d.ngr >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(d.ngr)}</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border); color:var(--muted);">${fmt(d.mkt)}</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border);">${d.bet > 0 ? (d.win / d.bet * 100).toFixed(2) + '%' : '0.00%'}</td>
        <td class="num" style="font-weight:700; border-top:1px solid var(--border);">${d.bet > 0 ? ((d.win - d.mkt) / d.bet * 100).toFixed(2) + '%' : '0.00%'}</td>
      </tr>`;
      
      sortedLocs.forEach(loc => {
        if (!d.locs[loc]) return;
        const ld = d.locs[loc];
        if (ld.in === 0 && ld.out === 0 && ld.ggr === 0 && ld.mkt === 0 && (!ld.serials || ld.serials.size === 0)) return;

        totalHtml += `<tr>
          <td style="padding-left:20px; font-size:12px;">${loc}</td>
          <td class="num" style="font-weight:700; font-size:12px;">${ld.serials ? ld.serials.size : 0}</td>
          <td class="num" style="font-size:12px;">${fmt(ld.in)}</td>
          <td class="num" style="font-size:12px;">${(ld.serials && ld.serials.size > 0) ? fmt(ld.in / ld.serials.size) : 0}</td>
          <td class="num" style="font-size:12px;">${fmt(ld.out)}</td>
          <td class="num" style="font-weight:700; font-size:12px; color:${ld.ggr >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(ld.ggr)}</td>
          <td class="num" style="font-weight:700; font-size:12px; color:${ld.ggr >= 0 ? 'var(--green)' : 'var(--red)'}">${(ld.serials && ld.serials.size > 0) ? fmt(ld.ggr / ld.serials.size) : 0}</td>
          <td class="num" style="font-weight:700; font-size:12px; color:${ld.ngr >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(ld.ngr)}</td>
          <td class="num" style="font-size:12px; color:var(--muted);">${fmt(ld.mkt)}</td>
          <td class="num" style="font-weight:700; font-size:12px;">${ld.bet > 0 ? (ld.win / ld.bet * 100).toFixed(2) + '%' : '0.00%'}</td>
          <td class="num" style="font-weight:700; font-size:12px;">${ld.bet > 0 ? ((ld.win - ld.mkt) / ld.bet * 100).toFixed(2) + '%' : '0.00%'}</td>
        </tr>`;
      });
    });
    bodyTotal.innerHTML = totalHtml;
    
    if (footTotal) {
      let footHtml = `<tr style="background:var(--surface2); font-weight:800;">
        <td style="border-top:2px solid var(--border);">TOTAL PERIOADĂ (GLOBAL)</td>
        <td class="num" style="border-top:2px solid var(--border); font-weight:700;">${globalSerials.size}</td>
        <td class="num" style="border-top:2px solid var(--border);">${fmt(tIn)}</td>
        <td class="num" style="border-top:2px solid var(--border);">${globalSerials.size > 0 ? fmt(tIn / globalSerials.size) : 0}</td>
        <td class="num" style="border-top:2px solid var(--border);">${fmt(tOut)}</td>
        <td class="num" style="border-top:2px solid var(--border); color:${tGgr >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(tGgr)}</td>
        <td class="num" style="border-top:2px solid var(--border); color:${tGgr >= 0 ? 'var(--green)' : 'var(--red)'}">${globalSerials.size > 0 ? fmt(tGgr / globalSerials.size) : 0}</td>
        <td class="num" style="border-top:2px solid var(--border); color:${tNgr >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(tNgr)}</td>
        <td class="num" style="border-top:2px solid var(--border); color:var(--muted);">${fmt(tMkt)}</td>
        <td class="num" style="border-top:2px solid var(--border);">${tBet > 0 ? (tWin / tBet * 100).toFixed(2) + '%' : '0.00%'}</td>
        <td class="num" style="border-top:2px solid var(--border);">${tBet > 0 ? ((tWin - tMkt) / tBet * 100).toFixed(2) + '%' : '0.00%'}</td>
      </tr>`;
      footTotal.innerHTML = footHtml;
    }
  }

  // Prepare table state rows (formatted HTML strings)
  tableStates['rep-lunare'].rows = _lunareData.map(r => {
    const inVal = +r.in_val || 0;
    const outVal = +r.out_val || 0;
    const ggrVal = +r.ggr || 0;
    const mktVal = +r.marketing || 0;
    const ngrVal = +r.ngr || 0;
    const winVal = +r.win || 0;
    const betVal = +r.bet || 0;
    const pct = betVal > 0 ? (winVal / betVal * 100).toFixed(2) + '%' : '0.00%';
    const pctNgr = betVal > 0 ? ((winVal - mktVal) / betVal * 100).toFixed(2) + '%' : '0.00%';
    return `<tr>
      <td>${r.serial_nr || '—'}</td>
      <td>${r.month || '—'}</td>
      <td>${r.location_name || '—'}</td>
      <td>${r.provider || '—'}</td>
      <td>${r.cabinet || '—'}</td>
      <td class="num">${fmt(inVal)}</td>
      <td class="num">${fmt(outVal)}</td>
      <td class="num" style="font-weight:700; color:${ggrVal >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(ggrVal)}</td>
      <td class="num" style="font-weight:700; color:${ngrVal >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(ngrVal)}</td>
      <td class="num" style="color:var(--muted);">${fmt(mktVal)}</td>
      <td class="num">${pct}</td>
      <td class="num">${pctNgr}</td>
    </tr>`;
  });

  // Render using global paginator
  renderTablePaginated('rep-lunare');

  // Add the totals row to tfoot separately
  if (foot) {
    foot.innerHTML = `<tr style="background:var(--surface2); font-weight:800;">
      <td colspan="5">TOTAL (Toate paginile)</td>
      <td class="num">${fmt(tIn)}</td>
      <td class="num">${fmt(tOut)}</td>
      <td class="num" style="color:${tGgr >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(tGgr)}</td>
    </tr>`;
  }
}

window.toggleLunareDetails = function() {
  const container = document.getElementById('lunare-detaliat-container');
  const btn = document.getElementById('btn-toggle-lunare-detaliat');
  if (container) {
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      btn.textContent = isHidden ? 'Ascunde detaliat pe aparate' : 'Arată detaliat pe aparate';
    }
  }
};

window.sortLunare = function(colIdx, th) {
  sortTable('rep-lunare', colIdx, th);
};

window.exportLunareExcel = function() {
  if (!_lunareData || _lunareData.length === 0) {
    if (typeof showAlert === 'function') showAlert('Nu există date pentru export.');
    else alert('Nu există date pentru export.');
    return;
  }
  
  const monthlyData = {};
  const locations = new Set();
  _lunareData.forEach(r => {
    const m = r.month || 'Necunoscut';
    const loc = r.location_name || 'Necunoscut';
    locations.add(loc);
    if (!monthlyData[m]) monthlyData[m] = { in: 0, out: 0, ggr: 0, mkt: 0, ngr: 0, win: 0, bet: 0, serials: new Set(), locs: {} };
    if (!monthlyData[m].locs[loc]) monthlyData[m].locs[loc] = { in: 0, out: 0, ggr: 0, mkt: 0, ngr: 0, win: 0, bet: 0, serials: new Set() };
    
    const daysActive = (+r.days_active || 0);
    if (r.serial_nr && daysActive >= 3) {
      monthlyData[m].serials.add(r.serial_nr);
      monthlyData[m].locs[loc].serials.add(r.serial_nr);
    }
    
    const inV = (+r.in_val || 0);
    const outV = (+r.out_val || 0);
    const ggrV = (+r.ggr || 0);
    const mktV = (+r.marketing || 0);
    const ngrV = (+r.ngr || 0);
    const winV = (+r.win || 0);
    const betV = (+r.bet || 0);
    
    monthlyData[m].in += inV;
    monthlyData[m].out += outV;
    monthlyData[m].ggr += ggrV;
    monthlyData[m].mkt += mktV;
    monthlyData[m].ngr += ngrV;
    monthlyData[m].win += winV;
    monthlyData[m].bet += betV;
    
    monthlyData[m].locs[loc].in += inV;
    monthlyData[m].locs[loc].out += outV;
    monthlyData[m].locs[loc].ggr += ggrV;
    monthlyData[m].locs[loc].mkt += mktV;
    monthlyData[m].locs[loc].ngr += ngrV;
    monthlyData[m].locs[loc].win += winV;
    monthlyData[m].locs[loc].bet += betV;
  });
  const sortedMonths = Object.keys(monthlyData).sort((a,b) => b.localeCompare(a));
  const sortedLocs = Array.from(locations).sort((a,b) => a.localeCompare(b));
  
  const dataTotal = [];
  sortedMonths.forEach(m => {
    dataTotal.push({
      'Lună / Locație': `${m} (TOTAL)`,
      'Aparate': monthlyData[m].serials.size,
      'IN': monthlyData[m].in,
      'IN Mediu': monthlyData[m].serials.size > 0 ? (monthlyData[m].in / monthlyData[m].serials.size) : 0,
      'OUT': monthlyData[m].out,
      'GGR': monthlyData[m].ggr,
      'GGR Mediu': monthlyData[m].serials.size > 0 ? (monthlyData[m].ggr / monthlyData[m].serials.size) : 0,
      'NGR': monthlyData[m].ngr,
      'MKT Cost': monthlyData[m].mkt,
      'WIN/BET %': monthlyData[m].bet > 0 ? (monthlyData[m].win / monthlyData[m].bet * 100).toFixed(2) + '%' : '0.00%',
      'WIN/BET NGR %': monthlyData[m].bet > 0 ? ((monthlyData[m].win - monthlyData[m].mkt) / monthlyData[m].bet * 100).toFixed(2) + '%' : '0.00%'
    });
    
    sortedLocs.forEach(loc => {
      const ld = monthlyData[m].locs[loc];
      if (!ld) return;
      if (ld.in === 0 && ld.out === 0 && ld.ggr === 0 && ld.mkt === 0 && (!ld.serials || ld.serials.size === 0)) return;

      dataTotal.push({
        'Lună / Locație': `  ${loc}`,
        'Aparate': ld.serials ? ld.serials.size : 0,
        'IN': ld.in,
        'IN Mediu': (ld.serials && ld.serials.size > 0) ? (ld.in / ld.serials.size) : 0,
        'OUT': ld.out,
        'GGR': ld.ggr,
        'GGR Mediu': (ld.serials && ld.serials.size > 0) ? (ld.ggr / ld.serials.size) : 0,
        'NGR': ld.ngr,
        'MKT Cost': ld.mkt,
        'WIN/BET %': ld.bet > 0 ? (ld.win / ld.bet * 100).toFixed(2) + '%' : '0.00%',
        'WIN/BET NGR %': ld.bet > 0 ? ((ld.win - ld.mkt) / ld.bet * 100).toFixed(2) + '%' : '0.00%'
      });
    });
  });

  const dataDetaliat = _lunareData.map(r => ({
    'Serie': r.serial_nr || '',
    'Lună': r.month || '',
    'Locație': r.location_name || '',
    'Provider': r.provider || '',
    'Cabinet': r.cabinet || '',
    'IN': r.in_val || 0,
    'OUT': r.out_val || 0,
    'GGR': r.ggr || 0,
    'NGR': r.ngr || 0,
    'MKT Cost': r.marketing || 0,
    'WIN/BET %': (r.bet && +r.bet > 0) ? ((+r.win || 0) / (+r.bet) * 100).toFixed(2) + '%' : '0.00%',
    'WIN/BET NGR %': (r.bet && +r.bet > 0) ? (((+r.win || 0) - (+r.marketing || 0)) / (+r.bet) * 100).toFixed(2) + '%' : '0.00%'
  }));

  const wsTotal = XLSX.utils.json_to_sheet(dataTotal);
  const wsDetaliat = XLSX.utils.json_to_sheet(dataDetaliat);
  
  function formatWorksheet(ws) {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      let isTotalRow = false;
      const cellA = ws[XLSX.utils.encode_cell({r: R, c: 0})];
      if (cellA && cellA.v && cellA.v.toString().includes('(TOTAL)')) {
        isTotalRow = true;
      }
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({r: R, c: C});
        const cell = ws[cellAddress];
        if (!cell) continue;
        
        if (!cell.s) cell.s = {};
        if (!cell.s.font) cell.s.font = { name: "Arial", sz: 10 };
        
        if (isTotalRow || R === 0) {
          cell.s.font.bold = true;
          if (!cell.s.fill) cell.s.fill = { patternType: "solid" };
          if (R === 0) { // Header
             cell.s.fill.fgColor = { rgb: "F8FAFC" }; // Light grey for header
             cell.s.font.color = { rgb: "1E293B" };
          } else { // Total row
             cell.s.fill.fgColor = { rgb: "F1F5F9" };
          }
        }
        
        const headerCell = ws[XLSX.utils.encode_cell({r: 0, c: C})];
        const headerName = (headerCell && headerCell.v) ? headerCell.v.toString() : '';
        
        if (R > 0) {
           if (headerName.includes('GGR') || headerName.includes('NGR') || headerName.includes('WIN')) {
              const val = parseFloat(cell.v);
              if (!isNaN(val)) {
                  if (val > 0) {
                     cell.s.font.color = { rgb: "059669" }; // green
                  } else if (val < 0) {
                     cell.s.font.color = { rgb: "DC2626" }; // red
                  }
              }
           }
        }
        
        if (cell.t === 'n' && R > 0) {
          if (headerName === 'Aparate') {
            cell.z = '#,##0';
          } else if (headerName !== 'Serie') {
            cell.z = '#,##0.00';
          }
        }
      }
    }
  }
  
  formatWorksheet(wsTotal);
  formatWorksheet(wsDetaliat);
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsTotal, "Total pe Luni");
  XLSX.utils.book_append_sheet(workbook, wsDetaliat, "Detaliat");
  XLSX.writeFile(workbook, `raport_lunare_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// ─── FLOORPLAN EDITOR & VIEWER LOGIC ───────────────────────────────────────

let floorplanState = {
  locationId: null,
  machines: [], // list of machines from API
  positions: {}, // map of machine_id -> {x, y}
  background: null
};

async function loadAdminFloorplan() {
  const select = document.getElementById('fp-location-select');
  const locId = select.value;
  if (!locId) return;

  floorplanState.locationId = locId;
  
  // Fetch background settings
  try {
    const data = await apiAuth(`/api/floorplan/settings?location_id=${locId}`);
    const dropzone = document.getElementById('fp-dropzone');
    if (data.floorplan_bg) {
      floorplanState.background = data.floorplan_bg;
      const img = new Image();
      img.onload = function() {
        dropzone.style.aspectRatio = `${this.width} / ${this.height}`;
        dropzone.style.height = 'auto';
        dropzone.style.backgroundSize = '100% 100%';
        dropzone.style.backgroundImage = `url('${API}${data.floorplan_bg}')`;
        applyFpZoom();
      };
      img.src = `${API}${data.floorplan_bg}`;
    } else {
      floorplanState.background = null;
      dropzone.style.backgroundImage = 'none';
      dropzone.style.aspectRatio = '';
    }
  } catch(e) { console.error('Error loading floorplan settings', e); }

  // Fetch machines for this location
  try {
    const { s, e } = getPeriod();
    const machinesData = await api(`/api/machines?start=${s}&end=${e}&loc_ids=${locId}&fp_mode=1`);
    floorplanState.machines = machinesData;
  } catch(e) { console.error('Error loading machines', e); }

  // Fetch saved positions
  try {
    const positionsData = await apiAuth(`/api/floorplan/machines?location_id=${locId}`);
    floorplanState.positions = {};
    positionsData.forEach(p => {
      floorplanState.positions[p.machine_id] = { x: p.pos_x, y: p.pos_y };
    });
  } catch(e) { console.error('Error loading positions', e); }

  renderAdminFloorplan();
}

// === ZOOM & GRID ===
let fpZoomLevel = 1;

function fpZoom(delta) {
  fpZoomLevel = Math.max(0.5, Math.min(5, fpZoomLevel + delta));
  applyFpZoom();
}

function fpZoomReset() {
  fpZoomLevel = 1;
  applyFpZoom();
}

function applyFpZoom() {
  const dz = document.getElementById('fp-dropzone');
  const wrapper = document.getElementById('fp-dropzone-wrapper');
  if (!dz || !wrapper) return;
  
  // Măresc dimensiunile reale ale containerului
  // La zoom 1x = 100% width/height (se potrivește în wrapper)
  // La zoom 2x = 200% width/height (scroll apare)
  // Pătratele rămân 28px, doar planul crește
  if (dz.style.aspectRatio) {
    const [w, h] = dz.style.aspectRatio.split('/').map(Number);
    const imgAspect = w / h;
    if (wrapper.clientWidth > 0 && wrapper.clientHeight > 0) {
      const wrapperAspect = wrapper.clientWidth / wrapper.clientHeight;
      if (imgAspect > wrapperAspect) {
        dz.style.width = (100 * fpZoomLevel) + '%';
        dz.style.height = 'auto';
      } else {
        dz.style.width = ((imgAspect / wrapperAspect) * 100 * fpZoomLevel) + '%';
        dz.style.height = 'auto';
      }
    }
    dz.style.minHeight = 'auto';
    dz.style.margin = 'auto'; // Flex will handle centering
  } else {
    dz.style.width = (100 * fpZoomLevel) + '%';
    dz.style.height = (100 * fpZoomLevel) + '%';
    dz.style.minHeight = (500 * fpZoomLevel) + 'px';
    dz.style.margin = 'auto';
  }
  dz.style.backgroundSize = '100% 100%'; 
  dz.style.transform = 'none';
  
  if (fpZoomLevel <= 1) {
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.overflow = 'hidden';
  } else {
    wrapper.style.display = 'block';
    wrapper.style.alignItems = 'initial';
    wrapper.style.justifyContent = 'initial';
    wrapper.style.overflow = 'auto';
  }
  
  const label = document.getElementById('fp-zoom-label');
  if (label) label.textContent = Math.round(fpZoomLevel * 100) + '%';
}

function fpToggleGrid() {
  const dz = document.getElementById('fp-dropzone');
  const checked = document.getElementById('fp-grid-toggle')?.checked;
  if (!dz) return;
  if (checked) {
    // Grid de 5% (20 celule pe fiecare axă)
    dz.style.backgroundImage = (dz.style.backgroundImage.includes('url(') ? dz.style.backgroundImage + ',' : '') + 
      'linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)';
    dz.style.backgroundSize = (dz.style.backgroundSize ? dz.style.backgroundSize + ',' : 'contain,') + ' 5% 5%, 5% 5%';
  } else {
    // Păstrăm doar imaginea de fundal
    const bgImg = dz.style.backgroundImage;
    if (bgImg.includes('url(')) {
      const urlPart = bgImg.match(/url\([^)]+\)/);
      dz.style.backgroundImage = urlPart ? urlPart[0] : 'none';
      dz.style.backgroundSize = 'contain';
    } else {
      dz.style.backgroundImage = 'none';
      dz.style.backgroundSize = 'contain';
    }
  }
}


function fpRemoveSelected() {
  if (fpSelectedIds.size === 0) { 
    showAlert('Selecteaza cel putin un aparat de pe plan pentru a-l scoate.'); 
    return; 
  }
  fpSaveUndo();
  fpSelectedIds.forEach(id => {
    delete floorplanState.positions[id];
  });
  fpSelectedIds.clear();
  renderAdminFloorplan();
  showAlert('Aparatele selectate au fost scoase de pe plan și trimise înapoi în listă.');
}

// Scroll wheel zoom pe dropzone
document.addEventListener('wheel', function(e) {
  const wrapper = document.getElementById('fp-dropzone-wrapper');
  if (!wrapper || !wrapper.contains(e.target)) return;
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    fpZoom(e.deltaY < 0 ? 0.15 : -0.15);
  }
}, { passive: false });
function renderAdminFloorplan() {
  const listEl = document.getElementById('fp-machine-list');
  const dropzone = document.getElementById('fp-dropzone');
  
  listEl.innerHTML = '';
  dropzone.innerHTML = '';

  let total = floorplanState.machines.length;
  let placed = 0;

  // Default aranjare după poziție (numerică, altfel alfabetică, altfel după serie)
  floorplanState.machines.sort((a, b) => {
    const posA = String(a.position || a.serial_nr).toLowerCase();
    const posB = String(b.position || b.serial_nr).toLowerCase();
    
    const numA = parseInt(posA, 10);
    const numB = parseInt(posB, 10);
    
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA === numB) return posA.localeCompare(posB);
      return numA - numB;
    }
    return posA.localeCompare(posB);
  });

  floorplanState.machines.forEach(m => {
    const pos = floorplanState.positions[m.id];
    const posLabel = m.position || m.serial_nr;
    const isPlaced = (pos && pos.x != null && pos.y != null);
    if (isPlaced) placed++;

    const game = m.tip_slot || m.game_name || '-';
    const platform = m.cabinet || m.platform || '-';

    // 1. Elementul pentru lista laterală (Aparate) - îl creăm mereu
    const listCard = document.createElement('div');
    listCard.dataset.id = m.id;
    listCard.innerHTML = `
      <div style="font-size:11px; font-weight:800; color:var(--text); margin-bottom:2px; display:flex; justify-content:space-between;">
        <span>Pos: ${posLabel}</span>
        <span>${m.serial_nr}</span>
      </div>
      <div style="font-size:9px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${platform} &bull; ${game}
      </div>
    `;
    listCard.style.position = 'relative';
    listCard.style.padding = '8px';
    listCard.style.backgroundColor = 'var(--surface)';
    listCard.style.border = '1px solid var(--border)';
    listCard.style.borderRadius = '8px';
    listCard.title = `Seria: ${m.serial_nr}\nJoc: ${game}`;
    
    if (isPlaced) {
      listCard.className = 'fp-list-card'; // nu are clasa fp-machine ptr a nu fi dragged direct
      listCard.style.opacity = '0.5';
      listCard.style.cursor = 'pointer';
      // Marcaj vizual
      listCard.innerHTML += `<div style="position:absolute; top:6px; right:6px; background:var(--green); width:6px; height:6px; border-radius:50%;" title="Plasat pe plan"></div>`;
      
      // Dacă listCard e apăsat, selectăm/deselectăm aparatul pe plan
      listCard.onclick = () => {
        const mIdStr = String(m.id);
        if (fpSelectedIds.has(mIdStr) && fpSelectedIds.size === 1) {
          // Deselect if it's the only one selected
          fpSelectedIds.delete(mIdStr);
        } else {
          // Select only this one
          fpSelectedIds.clear();
          fpSelectedIds.add(mIdStr);
        }
        renderAdminFloorplan();
      };
      
      // Highlighting in list if currently selected
      if (fpSelectedIds.has(String(m.id))) {
        listCard.style.border = '2px solid var(--accent)';
        listCard.style.opacity = '1';
      }
    } else {
      listCard.className = 'fp-machine';
      listCard.dataset.serial = m.serial_nr;
      listCard.dataset.position = posLabel;
      listCard.style.cursor = 'grab';
      listCard.onmousedown = startDrag;
    }
    listEl.appendChild(listCard);

    // 2. Elementul pentru hartă (doar dacă e plasat)
    if (isPlaced) {
      const el = document.createElement('div');
      el.className = 'fp-machine fp-placed';
      el.dataset.id = m.id;
      el.dataset.serial = m.serial_nr;
      el.dataset.position = posLabel;
      el.onmousedown = startDrag;

      if (fpSelectedIds.has(String(m.id))) {
        el.classList.add('fp-selected');
      }

      el.style.position = 'absolute';
      el.style.left = pos.x + '%';
      el.style.top = pos.y + '%';
      el.style.transform = `translate(-50%, -50%) rotate(${pos.angle || 0}deg)`;
      el.textContent = posLabel;
      
      const rotHandle = document.createElement('div');
      rotHandle.className = 'fp-rotate-handle';
      rotHandle.style.position = 'absolute';
      rotHandle.style.top = '-10px';
      rotHandle.style.left = '50%';
      rotHandle.style.transform = 'translateX(-50%)';
      rotHandle.style.width = '12px';
      rotHandle.style.height = '12px';
      rotHandle.style.backgroundColor = 'var(--accent)';
      rotHandle.style.borderRadius = '50%';
      rotHandle.style.cursor = 'crosshair';
      rotHandle.style.display = 'none';
      el.appendChild(rotHandle);
      
      const ggr = m.tot_ggr || m.ggr || 0;
      const tIn = m.in_zi || m.tin || 0; 
      const tBet = m.tot_bet || m.bet || 0;
      el.title = `Seria: ${m.serial_nr}\nPlatforma: ${platform}\nJoc: ${game}\nGGR: ${fmt(ggr)}\nIN: ${fmt(tIn)}\nBET: ${fmt(tBet)}`;
      
      dropzone.appendChild(el);
    }
  });
  
  // Update countere
  const cTotal = document.getElementById('fp-counter-total');
  const cPlaced = document.getElementById('fp-counter-placed');
  const cUn = document.getElementById('fp-counter-unassigned');
  if (cTotal) cTotal.textContent = total;
  if (cPlaced) cPlaced.textContent = placed;
  if (cUn) {
    cUn.textContent = (total - placed);
    cUn.style.color = (total - placed) > 0 ? 'var(--red)' : 'var(--muted)';
  }
  
  // Afișăm labelurile grupurilor
  fpRenderGroupLabels();
}

let draggedElement = null;
let isDragging = false;
let fpSelectedIds = new Set();
let fpUndoStack = [];

function fpSaveUndo() {
  // Snapshot curent al tuturor pozițiilor
  fpUndoStack.push(JSON.parse(JSON.stringify(floorplanState.positions)));
  if (fpUndoStack.length > 50) fpUndoStack.shift(); // max 50 undo-uri
}

function fpUndo() {
  if (fpUndoStack.length === 0) return;
  floorplanState.positions = fpUndoStack.pop();
  renderAdminFloorplan();
}

// Ctrl+Z listener
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    const fp = document.getElementById('fp-dropzone');
    if (fp && fp.offsetParent !== null) {
      e.preventDefault();
      fpUndo();
    }
  }
});

function startDrag(e) {
  e.preventDefault();
  const el = e.currentTarget;
  const dropzone = document.getElementById('fp-dropzone');
  
  const wasInList = (el.parentElement !== dropzone);
  
  // Dacă e în lista stângă, mutăm pe plan pt drag
  if (wasInList) {
    const posLabel = el.dataset.position || el.dataset.serial;
    el.classList.add('fp-placed');
    el.textContent = posLabel;
    el.style.position = 'absolute';
    
    const dzRect = dropzone.getBoundingClientRect();
    const cx = ((e.clientX - dzRect.left) / dzRect.width) * 100;
    const cy = ((e.clientY - dzRect.top) / dzRect.height) * 100;
    el.style.left = cx + '%';
    el.style.top = cy + '%';
    dropzone.appendChild(el);
  }
  
  draggedElement = el;
  isDragging = false;
  
  const startMouseX = e.clientX;
  const startMouseY = e.clientY;
  const mainId = el.dataset.id;
  const isPartOfSelection = fpSelectedIds.has(mainId) && fpSelectedIds.size > 1;
  
  // Salvăm pozițiile inițiale ale tuturor elementelor selectate
  const startPositions = {};
  if (isPartOfSelection) {
    fpSelectedIds.forEach(id => {
      const sel = dropzone.querySelector(`[data-id="${id}"]`);
      if (sel) {
        startPositions[id] = { x: parseFloat(sel.style.left), y: parseFloat(sel.style.top) };
      }
    });
  }
  const mainStartX = parseFloat(el.style.left);
  const mainStartY = parseFloat(el.style.top);
  
  function onMove(ev) {
    const dx = ev.clientX - startMouseX;
    const dy = ev.clientY - startMouseY;
    if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      isDragging = true;
      fpSaveUndo(); // salvăm starea înainte de mutare
    }
    if (!isDragging) return;
    
    const dzRect = dropzone.getBoundingClientRect();
    // Delta în procente
    const dpx = (dx / dzRect.width) * 100;
    const dpy = (dy / dzRect.height) * 100;
    
    // Mută elementul principal (fără clamp, pentru a permite trecerea din listă)
    const newX = mainStartX + dpx;
    const newY = mainStartY + dpy;
    draggedElement.style.left = newX + '%';
    draggedElement.style.top = newY + '%';
    
    // Mută toate celelalte selectate cu același delta
    if (isPartOfSelection) {
      fpSelectedIds.forEach(id => {
        if (id === mainId) return;
        const sel = dropzone.querySelector(`[data-id="${id}"]`);
        if (sel && startPositions[id]) {
          sel.style.left = Math.max(0, Math.min(100, startPositions[id].x + dpx)) + '%';
          sel.style.top = Math.max(0, Math.min(100, startPositions[id].y + dpy)) + '%';
        }
      });
    }
  }
  
  function onUp(ev) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    
    if (draggedElement) {
      if (isDragging) {
        // Salvează pozițiile finale
        const mId = draggedElement.dataset.id;
        const oldPos = floorplanState.positions[mId] || {};
        floorplanState.positions[mId] = {
          x: parseFloat(draggedElement.style.left),
          y: parseFloat(draggedElement.style.top),
          angle: oldPos.angle || 0
        };
        // Salvează toate selectate
        if (isPartOfSelection) {
          fpSelectedIds.forEach(id => {
            if (id === mId) return;
            const sel = dropzone.querySelector(`[data-id="${id}"]`);
            if (sel) {
              const oldSelPos = floorplanState.positions[id] || {};
              floorplanState.positions[id] = {
                x: parseFloat(sel.style.left),
                y: parseFloat(sel.style.top),
                angle: oldSelPos.angle || 0
              };
            }
          });
        }
        renderAdminFloorplan(); // ca să updatăm și counterele
      } else {
        // Dacă nu s-a tras deloc, dar a fost din listă -> anulează și repune în listă
        if (wasInList) {
          delete floorplanState.positions[draggedElement.dataset.id];
          renderAdminFloorplan();
        } else {
          // Click fără drag pe plan → toggle selecție
          if (ev.shiftKey) {
            draggedElement.classList.toggle('fp-selected');
            const mId = draggedElement.dataset.id;
            if (draggedElement.classList.contains('fp-selected')) {
              fpSelectedIds.add(mId);
            } else {
              fpSelectedIds.delete(mId);
            }
          } else {
            // Click normal: selectăm aparatul + tot grupul lui
            document.querySelectorAll('.fp-selected').forEach(s => s.classList.remove('fp-selected'));
            fpSelectedIds.clear();
            draggedElement.classList.add('fp-selected');
            fpSelectedIds.add(draggedElement.dataset.id);
            fpSelectGroup(draggedElement.dataset.id);
          }
        }
      }
    }
    draggedElement = null;
    isDragging = false;
  }
  
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function fpAlignH() {
  if (fpSelectedIds.size < 2) { showAlert('Selecteaza minim 2 aparate (click + Shift+click) apoi aliniaza.'); return; }
  fpSaveUndo();
  const dropzone = document.getElementById('fp-dropzone');
  const gap = 2.8; // 2.8% of container width (machines are 2.4cqw width)
  
  // Colectăm elementele sortate după X curent
  const items = [];
  fpSelectedIds.forEach(id => {
    const el = dropzone.querySelector(`[data-id="${id}"]`);
    if (el) items.push({ id, el, x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
  });
  items.sort((a, b) => a.x - b.x);
  
  // Y = media, X = distribuit uniform de la primul
  const avgY = items.reduce((s, i) => s + i.y, 0) / items.length;
  const startX = items[0].x;
  
  items.forEach((item, i) => {
    const newX = Math.min(100, startX + i * gap);
    item.el.style.left = newX + '%';
    item.el.style.top = avgY + '%';
    floorplanState.positions[item.id] = { x: newX, y: avgY };
  });
}

function fpAlignV() {
  if (fpSelectedIds.size < 2) { showAlert('Selecteaza minim 2 aparate (click + Shift+click) apoi aliniaza.'); return; }
  fpSaveUndo();
  const dropzone = document.getElementById('fp-dropzone');
  const dzW = dropzone.offsetWidth || 800;
  const dzH = dropzone.offsetHeight || 600;
  const gap = 2.8 * (dzW / dzH); // Adjust percentage for height to match width
  
  // Colectăm elementele sortate după Y curent
  const items = [];
  fpSelectedIds.forEach(id => {
    const el = dropzone.querySelector(`[data-id="${id}"]`);
    if (el) items.push({ id, el, x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
  });
  items.sort((a, b) => a.y - b.y);
  
  // X = media, Y = distribuit uniform de la primul
  const avgX = items.reduce((s, i) => s + i.x, 0) / items.length;
  const startY = items[0].y;
  
  items.forEach((item, i) => {
    const newY = Math.min(100, startY + i * gap);
    item.el.style.left = avgX + '%';
    item.el.style.top = newY + '%';
    floorplanState.positions[item.id] = { x: avgX, y: newY };
  });
}

function fpDeselectAll() {
  document.querySelectorAll('.fp-selected').forEach(s => s.classList.remove('fp-selected'));
  fpSelectedIds.clear();
}

// === GRUPURI ===
function fpGetGroups() {
  if (!floorplanState.locationId) return [];
  const key = 'fp_groups_' + floorplanState.locationId;
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; }
}

function fpSaveGroups(groups) {
  if (!floorplanState.locationId) return;
  const key = 'fp_groups_' + floorplanState.locationId;
  localStorage.setItem(key, JSON.stringify(groups));
}

async function fpCreateGroup() {
  if (fpSelectedIds.size < 2) { showAlert('Selecteaza minim 2 aparate apoi creaza grupul.'); return; }
  
  const name = await customPrompt('Numele grupului (ex: Bell Link, P42 Curve, Cabinet A):');
  if (!name || !name.trim()) return;
  
  fpSaveUndo();
  const groups = fpGetGroups();
  
  // Scoatem aparatele din alte grupuri
  const selectedArr = Array.from(fpSelectedIds);
  groups.forEach(g => {
    g.machineIds = g.machineIds.filter(id => !selectedArr.includes(id));
  });
  // Curățăm grupuri goale
  const cleaned = groups.filter(g => g.machineIds.length > 0);
  
  cleaned.push({ name: name.trim(), machineIds: selectedArr });
  fpSaveGroups(cleaned);
  renderAdminFloorplan();
  showAlert('Grup "' + name.trim() + '" creat cu ' + selectedArr.length + ' aparate.');
}

function fpDeleteGroup() {
  if (fpSelectedIds.size === 0) { showAlert('Selecteaza un aparat din grup pentru a sterge grupul.'); return; }
  const groups = fpGetGroups();
  const firstId = Array.from(fpSelectedIds)[0];
  const grp = groups.find(g => g.machineIds.includes(firstId));
  if (!grp) { showAlert('Aparatul selectat nu apartine unui grup.'); return; }
  
  fpSaveUndo();
  const filtered = groups.filter(g => g !== grp);
  fpSaveGroups(filtered);
  renderAdminFloorplan();
  showAlert('Grupul "' + grp.name + '" a fost sters.');
}

function fpClearAllGroups() {
  if (confirm("Ești sigur că vrei să ștergi TOATE grupurile salvate pe acest dispozitiv pentru locația curentă?")) {
    fpSaveUndo();
    fpSaveGroups([]);
    renderAdminFloorplan();
    showAlert("Toate grupurile au fost șterse.");
  }
}

function fpGetGroupForMachine(machineId) {
  const groups = fpGetGroups();
  return groups.find(g => g.machineIds.includes(String(machineId)));
}

function fpSelectGroup(machineId) {
  const grp = fpGetGroupForMachine(String(machineId));
  if (!grp) return false;
  const dropzone = document.getElementById('fp-dropzone');
  grp.machineIds.forEach(id => {
    const el = dropzone.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('fp-selected');
      fpSelectedIds.add(id);
    }
  });
  return true;
}

function fpRenderGroupLabels() {
  const dropzone = document.getElementById('fp-dropzone');
  // Ștergem labelurile vechi
  dropzone.querySelectorAll('.fp-group-label').forEach(l => l.remove());
  
  const groups = fpGetGroups();
  groups.forEach(grp => {
    if (grp.machineIds.length === 0) return;
    // Calculăm centrul grupului
    let sumX = 0, sumY = 0, count = 0;
    grp.machineIds.forEach(id => {
      const pos = floorplanState.positions[id];
      if (pos) { sumX += pos.x; sumY += pos.y; count++; }
    });
    if (count === 0) return;
    
    const label = document.createElement('div');
    label.className = 'fp-group-label';
    label.style.position = 'absolute';
    label.style.left = (sumX / count) + '%';
    label.style.top = (sumY / count - 3) + '%';
    label.style.transform = 'translate(-50%, -100%)';
    label.style.background = 'rgba(99, 102, 241, 0.85)';
    label.style.color = 'white';
    label.style.padding = '2px 8px';
    label.style.borderRadius = '4px';
    label.style.fontSize = '9px';
    label.style.fontWeight = '600';
    label.style.whiteSpace = 'nowrap';
    label.style.pointerEvents = 'none';
    label.style.zIndex = '5';
    label.textContent = grp.name;
    dropzone.appendChild(label);
  });
}

async function saveFloorplanPositions() {
  if (!floorplanState.locationId) {
    showAlert("Alege locația mai întâi.");
    return;
  }
  const payload = {
    location_id: floorplanState.locationId,
    machines: []
  };
  for (const [mId, pos] of Object.entries(floorplanState.positions)) {
    const m = floorplanState.machines.find(x => x.id == mId);
    if (m) {
      payload.machines.push({
        machine_id: mId,
        serial_nr: m.serial_nr,
        pos_x: pos.x,
        pos_y: pos.y
      });
    }
  }
  try {
    const result = await apiAuth('/api/floorplan/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (result && result.success) showAlert("Pozițiile au fost salvate!", "Succes");
  } catch(e) {
    showAlert("Eroare la salvarea pozițiilor.");
    console.error(e);
  }
}

async function uploadFloorplanBg(input) {
  if (!floorplanState.locationId) {
    showAlert("Alege locația mai întâi.");
    input.value = "";
    return;
  }
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('location_id', floorplanState.locationId);

  try {
    const res = await fetch(API + '/api/floorplan/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('cp2_token') },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      floorplanState.background = data.url;
      document.getElementById('fp-dropzone').style.backgroundImage = `url('${API}${data.url}')`;
      showAlert("Schița a fost încărcată!", "Succes");
    } else {
      showAlert(data.error || "Eroare la încărcare.");
    }
  } catch(e) {
    showAlert("Eroare upload.");
    console.error(e);
  }
  input.value = "";
}

function initAdminFloorplan() {
  const select = document.getElementById('fp-location-select');
  if (!select) return;
  const locs = (filtersData && filtersData.locations) || [];
  if (locs.length > 0 && select.options.length <= 1) {
    select.innerHTML = '<option value="">Alege locația...</option>';
    locs.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = loc.name;
      select.appendChild(opt);
    });
    // Auto-select first location to prevent empty screen on refresh
    select.value = locs[0].id;
    loadAdminFloorplan();
  }
}

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#admin-floorplan') {
    initAdminFloorplan();
  } else if (window.location.hash === '#floorplan') {
    initGlobalFloorplan();
  }
});

// Populare dropdown pentru Harta Globală (meniul normal)
function initGlobalFloorplan() {
  const select = document.getElementById('global-fp-location-select');
  if (!select) return;
  const locs = (filtersData && filtersData.locations) || [];
  if (locs.length > 0 && select.options.length <= 1) {
    select.innerHTML = '<option value="">Alege locația...</option>';
    locs.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = loc.name;
      select.appendChild(opt);
    });
    select.value = locs[0].id;
    loadGlobalFloorplan();
  }
}

// Încărcare efectivă a Hărții Globale
async function loadGlobalFloorplan() {
  const select = document.getElementById('global-fp-location-select');
  const locId = select ? select.value : null;
  const wrapper = document.getElementById('global-fp-wrapper');
  const container = document.getElementById('global-fp-container');
  const emptyState = document.getElementById('global-fp-empty');
  const tableWrapper = document.getElementById('global-fp-table-wrapper');
  const leftTableWrapper = document.getElementById('global-fp-left-table-wrapper');

  if (!locId) {
    if (wrapper) wrapper.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  showLoader(true);
  try {
    const dateS = document.getElementById('date-start') ? document.getElementById('date-start').value : new Date().toISOString().split('T')[0];
    const dateE = document.getElementById('date-end') ? document.getElementById('date-end').value : new Date().toISOString().split('T')[0];
    const [machData, dataBg, posData] = await Promise.all([
      apiAuth(`/api/machines?start=${dateS}&end=${dateE}&loc_ids=${locId}&fp_mode=1`),
      apiAuth(`/api/floorplan/settings?location_id=${locId}`),
      apiAuth(`/api/floorplan/machines?location_id=${locId}`)
    ]);

    window._fpCurrentData = { machData, dataBg, posData };
    
    // Populate filters
    const cabSelect = document.getElementById('global-fp-cabinet-select');
    const prodSelect = document.getElementById('global-fp-producator-select');
    if (cabSelect && prodSelect) {
      const cabinets = [...new Set(machData.map(m => m.cabinet).filter(Boolean))].sort();
      const producers = [...new Set(machData.map(m => m.producator).filter(Boolean))].sort();
      
      cabSelect.innerHTML = '<option value="">Toate Cabinetele</option>' + cabinets.map(c => `<option value="${c}">${c}</option>`).join('');
      prodSelect.innerHTML = '<option value="">Toți Producătorii</option>' + producers.map(p => `<option value="${p}">${p}</option>`).join('');
      
      cabSelect.style.display = 'inline-block';
      prodSelect.style.display = 'inline-block';
    }

    renderGlobalFloorplanLocal();
  } catch(e) {
    console.error('Error rendering global floorplan', e);
    const wrapper = document.getElementById('global-fp-wrapper');
    const emptyState = document.getElementById('global-fp-empty');
    if(wrapper) wrapper.style.display = 'none';
    if(emptyState) emptyState.style.display = 'block';
  } finally {
    showLoader(false);
  }
}

function renderGlobalFloorplanLocal() {
  const wrapper = document.getElementById('global-fp-wrapper');
  const container = document.getElementById('global-fp-container');
  const emptyState = document.getElementById('global-fp-empty');
  const tableWrapper = document.getElementById('global-fp-table-wrapper');
  
  if (!window._fpCurrentData) return;
  let { machData, dataBg, posData } = window._fpCurrentData;
  const cabSelect = document.getElementById('global-fp-cabinet-select');
  const prodSelect = document.getElementById('global-fp-producator-select');
  const selCab = cabSelect ? cabSelect.value : '';
  const selProd = prodSelect ? prodSelect.value : '';

  if (!dataBg || !dataBg.floorplan_bg) {
    if (wrapper) wrapper.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  if (wrapper) wrapper.style.display = 'block';
  if (tableWrapper) tableWrapper.style.display = 'flex';
  
  const oldScrollTop = wrapper ? wrapper.scrollTop : 0;
  const oldScrollLeft = wrapper ? wrapper.scrollLeft : 0;
  const img = new Image();
  img.onload = function() {
    container.style.aspectRatio = `${this.width} / ${this.height}`;
    container.style.height = 'auto'; // Fix discrepancy
    container.style.backgroundSize = '100% 100%';
    applyGlobalFpZoom();
    if (wrapper) {
      wrapper.scrollTop = oldScrollTop;
      wrapper.scrollLeft = oldScrollLeft;
    }
    if (typeof makeWrapperDraggable === 'function') {
      makeWrapperDraggable('global-fp-scroll');
    }
  };
  img.src = `${API}${dataBg.floorplan_bg}`;
  container.style.backgroundImage = `url('${API}${dataBg.floorplan_bg}')`;
  container.innerHTML = '';
  container.onclick = (e) => {
    if (e.target === container) {
      clearFpMachineHighlights();
    }
  };
  const tableBody = document.getElementById('global-fp-table-body');
  if (tableBody) tableBody.innerHTML = '';
  const leftTableBody = document.getElementById('global-fp-left-table-body');
  if (leftTableBody) leftTableBody.innerHTML = '';
  
  let cabinetStats = {};
  let jocuriStats = {};
  let totalStats = { ggr: 0, tIn: 0, tTotalIn: 0 };

  const metric = globalFpSettings.metric || 'in_zi';
  const rules = globalFpSettings.rules || [];

  // Sort machData numerically by position or serial
  machData.sort((a,b) => {
    const posA = String(a.position || a.serial_nr).toLowerCase();
    const posB = String(b.position || b.serial_nr).toLowerCase();
    const numA = parseInt(posA, 10);
    const numB = parseInt(posB, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return posA.localeCompare(posB);
  });

  machData.forEach(md => {
    if (selCab && md.cabinet !== selCab) return;
    if (selProd && md.producator !== selProd) return;

    const p = posData.find(x => x.machine_id == md.id);
    const posLabel = md.position || md.serial_nr;
    const serie = md.serial_nr;
    const ggr = md.tot_ggr || md.ggr || 0;
    const tIn = md.in_zi || 0; // IN mediu
    const tTotalIn = md.tin || md.total_in || 0; // Total IN
    const tBet = md.tot_bet || md.bet || 0;
    const games = md.games || 0;
    const tBetMediu = games > 0 ? (tBet / games) : 0;
    const joc = md.tip_slot || '-';
    const cabinet = md.cabinet || '-';
    
    // Draw on map only if it has position
    if (p) {
      const el = document.createElement('div');
      el.id = `fp-machine-${md.id}`;
      el.style.position = 'absolute';
      el.style.left = p.pos_x + '%';
      el.style.top = p.pos_y + '%';
      el.style.transform = `translate(-50%, -50%) rotate(${p.angle || 0}deg)`;
      
      let val = md[metric] || 0;
      let bg = 'var(--surface2)';
      let col = 'var(--text)';
      
      if (rules.length > 0) {
        for (let r of rules) {
          if (val >= (r.min || 0) && val <= r.max) {
            bg = r.color;
            col = 'white'; 
            if (bg.toLowerCase() === '#fbbf24' || bg.toLowerCase() === 'yellow' || bg.toLowerCase() === '#ffffff') col = 'black';
            break;
          }
        }
      }

      const safeSerie = String(serie).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeJoc = String(joc).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeCabinet = String(cabinet).replace(/'/g, "\\'").replace(/"/g, '&quot;');

      el.innerHTML = `
        <div class="fp-machine-card" style="background:${bg}; color:${col}; width:2.4cqw; aspect-ratio:1/1; padding:0; border-radius:0.25cqw; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.5); cursor:pointer; transition: transform 0.2s, box-shadow 0.2s;" 
             onmouseenter="showFpTooltip(this, event, '${safeSerie}', '${safeJoc}', ${ggr}, ${tIn}, ${tTotalIn}, ${tBet}, '${safeCabinet}', ${tBetMediu})"
             onmousemove="moveFpTooltip(event)"
             onmouseleave="hideFpTooltip()">
          <div style="font-size:0.4cqw; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">${posLabel}</div>
          <div style="font-size:0.55cqw; font-weight:900; margin-top:1px;">${fmt(tIn)}</div>
          <div style="font-size:0.4cqw; font-weight:700; margin-top:1px; opacity:0.9;">G: ${fmt(ggr)}</div>
        </div>
      `;
      container.appendChild(el);
    }
    
    const realCab = md.cabinet || 'Necunoscut';
    const realJoc = md.tip_slot || '-';

    if (tableBody) {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.onclick = () => highlightFpMachine(md.id);
      tr.innerHTML = `
        <td style="padding:8px; border-bottom:1px solid var(--border); vertical-align:top;">
          <div style="display:flex; justify-content:flex-start; align-items:center; gap:8px;">
             <span style="font-weight:bold;">${posLabel}</span>
             <span style="font-weight:bold; color:var(--text);">${serie}</span>
             ${!p ? '<span style="color:var(--orange);font-size:10px; font-weight:bold;">(Neplasat)</span>' : ''}
          </div>
          <div style="font-size:10px; color:var(--muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;" title="${realCab} • ${realJoc}">${realCab} &bull; ${realJoc}</div>
        </td>
        <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; color:${ggr < 0 ? 'var(--red)' : 'var(--text)'}; font-weight:bold; vertical-align:top;">${fmt(ggr)}</td>
        <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; vertical-align:top;">
          <div style="font-weight:bold; color:var(--text);">${fmt(tIn)}</div>
          <div style="font-size:10px; color:var(--muted); margin-top:2px;">${fmt(tTotalIn)}</div>
        </td>
      `;
      tableBody.appendChild(tr);
    }
    
    // Cabinet stats
    if (!cabinetStats[realCab]) cabinetStats[realCab] = { cab: realCab, ggr: 0, tIn: 0, tTotalIn: 0, ids: [] };
    cabinetStats[realCab].ggr += ggr;
    cabinetStats[realCab].tIn += tIn;
    cabinetStats[realCab].tTotalIn += tTotalIn;
    cabinetStats[realCab].ids.push(md.id);

    // Jocuri stats
    if (!jocuriStats[realJoc]) jocuriStats[realJoc] = { joc: realJoc, ggr: 0, tIn: 0, tTotalIn: 0, ids: [] };
    jocuriStats[realJoc].ggr += ggr;
    jocuriStats[realJoc].tIn += tIn;
    jocuriStats[realJoc].tTotalIn += tTotalIn;
    jocuriStats[realJoc].ids.push(md.id);
    
    // Totals
    totalStats.ggr += ggr;
    totalStats.tIn += tIn;
    totalStats.tTotalIn += tTotalIn;
  });
  
  // Add total row to Aparate
  if (tableBody) {
     const tr = document.createElement('tr');
     tr.innerHTML = `
       <td style="padding:8px; border-bottom:1px solid var(--border); font-weight:900; background:var(--surface2);">TOTAL</td>
       <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; font-weight:900; background:var(--surface2); color:${totalStats.ggr < 0 ? 'var(--red)' : 'var(--text)'};">${fmt(totalStats.ggr)}</td>
       <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; background:var(--surface2); vertical-align:top;">
         <div style="font-weight:900;">${fmt(totalStats.tIn)}</div>
         <div style="font-size:10px; font-weight:900; color:var(--muted); margin-top:2px;">${fmt(totalStats.tTotalIn)}</div>
       </td>
     `;
     tableBody.appendChild(tr);
  }

  if (leftTableBody) {
    const cabs = Object.keys(cabinetStats).sort();
    cabs.forEach(k => {
      const s = cabinetStats[k];
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.onclick = () => highlightFpMachine(s.ids);
      tr.innerHTML = `
        <td style="padding:8px; border-bottom:1px solid var(--border); font-weight:bold;">${s.cab}</td>
        <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; color:${s.ggr < 0 ? 'var(--red)' : 'var(--text)'}; font-weight:bold; vertical-align:middle;">${fmt(s.ggr)}</td>
        <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; vertical-align:middle;">${fmt(s.tIn)}</td>
        <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; vertical-align:middle;">${fmt(s.tTotalIn)}</td>
      `;
      leftTableBody.appendChild(tr);
    });
    // Total Cabinete
     const tr = document.createElement('tr');
     tr.innerHTML = `
       <td style="padding:8px; border-bottom:1px solid var(--border); font-weight:900; background:var(--surface2);">TOTAL</td>
       <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; font-weight:900; background:var(--surface2); color:${totalStats.ggr < 0 ? 'var(--red)' : 'var(--text)'};">${fmt(totalStats.ggr)}</td>
       <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; font-weight:900; background:var(--surface2);">${fmt(totalStats.tIn)}</td>
       <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; font-weight:900; background:var(--surface2);">${fmt(totalStats.tTotalIn)}</td>
     `;
     leftTableBody.appendChild(tr);
  }
  
  const jocuriTableBody = document.getElementById('global-fp-jocuri-table-body');
  if (jocuriTableBody) {
    jocuriTableBody.innerHTML = '';
    const jocs = Object.keys(jocuriStats).sort();
    jocs.forEach(k => {
      const s = jocuriStats[k];
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.onclick = () => highlightFpMachine(s.ids);
      tr.innerHTML = `
        <td style="padding:8px; border-bottom:1px solid var(--border); font-weight:bold;">${s.joc}</td>
        <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; color:${s.ggr < 0 ? 'var(--red)' : 'var(--text)'}; font-weight:bold; vertical-align:middle;">${fmt(s.ggr)}</td>
        <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; vertical-align:middle;">${fmt(s.tIn)}</td>
        <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; vertical-align:middle;">${fmt(s.tTotalIn)}</td>
      `;
      jocuriTableBody.appendChild(tr);
    });
    // Total Jocuri
     const tr = document.createElement('tr');
     tr.innerHTML = `
       <td style="padding:8px; border-bottom:1px solid var(--border); font-weight:900; background:var(--surface2);">TOTAL</td>
       <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; font-weight:900; background:var(--surface2); color:${totalStats.ggr < 0 ? 'var(--red)' : 'var(--text)'};">${fmt(totalStats.ggr)}</td>
       <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; font-weight:900; background:var(--surface2);">${fmt(totalStats.tIn)}</td>
       <td style="padding:8px; border-bottom:1px solid var(--border); text-align:right; font-weight:900; background:var(--surface2);">${fmt(totalStats.tTotalIn)}</td>
     `;
     jocuriTableBody.appendChild(tr);
  }
}

// Upload schiță direct din pagina de vizualizare Floorplan
async function uploadGlobalFloorplanBg(input) {
  const select = document.getElementById('global-fp-location-select');
  const locId = select ? select.value : null;
  if (!locId) {
    showAlert("Alege locația mai întâi.");
    input.value = "";
    return;
  }
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('location_id', locId);

  showLoader(true);
  try {
    const res = await fetch(API + '/api/floorplan/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('cp2_token') },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showAlert("Schița a fost încărcată! Acum du-te la Editor Floorplan pentru a aranja aparatele.", "Succes");
      loadGlobalFloorplan(); // reload to show the new background
    } else {
      showAlert(data.error || "Eroare la încărcare.");
    }
  } catch(e) {
    showAlert("Eroare upload.");
    console.error(e);
  } finally {
    showLoader(false);
  }
  input.value = "";
}

async function renderLocDetailFloorplan(locId, machData) {
  const container = document.getElementById('ld-floorplan-container');
  const wrapper = document.getElementById('ld-floorplan-wrapper');
  if (!container || !wrapper) return;

  try {
    // Fetch floorplan config
    const dataBg = await apiAuth(`/api/floorplan/settings?location_id=${locId}`);
    
    // Cache bust on positions
    const posData = await apiAuth(`/api/floorplan/machines?location_id=${locId}&_t=${Date.now()}`);

    if (!dataBg.floorplan_bg || posData.length === 0) {
      wrapper.style.display = 'none';
      const btn = document.getElementById('ld-toggle-fp-btn');
      if (btn) btn.style.display = 'none';
      return;
    }
    
    wrapper.style.display = 'block';
    container.style.containerType = 'inline-size'; // Set container type for cqw
    const btn = document.getElementById('ld-toggle-fp-btn');
    if (btn) {
      btn.style.display = 'inline-flex';
      btn.innerHTML = 'Ascunde Harta';
    }
    const img = new Image();
    img.onload = function() {
      container.style.aspectRatio = `${this.width} / ${this.height}`;
      container.style.height = 'auto';
      container.style.backgroundSize = '100% 100%';
      if (typeof applyLocFpZoom === 'function') {
        applyLocFpZoom();
      }
    };
    img.src = `${API}${dataBg.floorplan_bg}`;
    container.style.backgroundImage = `url('${API}${dataBg.floorplan_bg}')`;
    container.innerHTML = ''; // clear

    // Folosim regulile globale în locul celor hardcodate
    const metric = globalFpSettings.metric || 'in_zi';
    const rules = globalFpSettings.rules || [];

    posData.forEach(p => {
      const md = machData.find(x => x.id == p.machine_id);
      const posLabel = md ? (md.position || md.serial_nr) : p.serial_nr;
      
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = p.pos_x + '%';
      el.style.top = p.pos_y + '%';
      el.style.transform = `translate(-50%, -50%) rotate(${p.angle || 0}deg)`;
      
      let in_mediu = md ? (md.in_zi || 0) : 0;
      let val = md ? (md[metric] || 0) : 0;
      let bg = 'var(--surface2)';
      let col = 'var(--text)';
      
      if (md && rules.length > 0) {
        for (let r of rules) {
          if (val >= (r.min || 0) && val <= r.max) {
            bg = r.color;
            col = 'white'; 
            if (bg.toLowerCase() === '#fbbf24' || bg.toLowerCase() === 'yellow' || bg.toLowerCase() === '#ffffff') col = 'black';
            break;
          }
        }
      }

      const tIn = md ? (md.in_zi || 0) : 0; // IN mediu
      const tTotalIn = md ? (md.tin || md.total_in || 0) : 0; // Total IN
      const tBet = md ? (md.tot_bet || md.bet || 0) : 0;
      const games = md ? (md.games || 0) : 0;
      const tBetMediu = games > 0 ? (tBet / games) : 0;
      const joc = md ? (md.tip_slot || '-') : '-';
      const cabinet = md ? (md.cabinet || '-') : '-';
      const serie = md ? md.serial_nr : p.serial_nr;
      const ggr = md ? (md.tot_ggr || md.ggr || 0) : 0;
      
      const safeSerie = String(serie).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeJoc = String(joc).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeCabinet = String(cabinet).replace(/'/g, "\\'").replace(/"/g, '&quot;');

      el.innerHTML = `
        <div class="fp-machine-card" style="background:${bg}; color:${col}; width:2.4cqw; aspect-ratio:1/1; border-radius:0.25cqw; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.3); cursor:pointer; transition: transform 0.2s, box-shadow 0.2s;" 
             onmouseenter="showFpTooltip(this, event, '${safeSerie}', '${safeJoc}', ${ggr}, ${tIn}, ${tTotalIn}, ${tBet}, '${safeCabinet}', ${tBetMediu})"
             onmousemove="moveFpTooltip(event)"
             onmouseleave="hideFpTooltip()">
          <div style="font-size:0.4cqw; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">${posLabel}</div>
          <div style="font-size:0.55cqw; font-weight:900; margin-top:1px;">${fmt(in_mediu)}</div>
          <div style="font-size:0.4cqw; font-weight:700; margin-top:1px; opacity:0.9;">G: ${fmt(ggr)}</div>
        </div>
      `;
      
      container.appendChild(el);
    });
    
    locFpZoomLevel = 1;
    if (typeof applyLocFpZoom === 'function') {
      applyLocFpZoom();
    }
    
    if (typeof makeWrapperDraggable === 'function') {
      makeWrapperDraggable('ld-floorplan-scroll');
    }

  } catch(e) {
    console.error('Error rendering floorplan viewer', e);
    const wrapper = document.getElementById('ld-floorplan-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    const btn = document.getElementById('ld-toggle-fp-btn');
    if (btn) btn.style.display = 'none';
  }
}

function toggleLocDetailFloorplan() {
  const wrapper = document.getElementById('ld-floorplan-wrapper');
  const btn = document.getElementById('ld-toggle-fp-btn');
  if (!wrapper) return;
  if (wrapper.style.display === 'none') {
    wrapper.style.display = 'block';
    if(btn) btn.innerHTML = 'Ascunde Harta';
  } else {
    wrapper.style.display = 'none';
    if(btn) btn.innerHTML = 'Arată Harta';
  }
}

// === MARQUEE SELECTION ===
let fpMarqueeActive = false;
let fpMarqueeStartX = 0;
let fpMarqueeStartY = 0;
let fpMarqueeEl = null;

document.addEventListener('mousedown', function(e) {
  const dropzone = document.getElementById('fp-dropzone');
  if (!dropzone) return;
  if (e.button !== 0) return; // Only left click
  
  // If we clicked on a machine, let startDrag handle it
  if (e.target.closest('.fp-machine') || e.target.closest('.fp-group-label')) return;
  
  // If we clicked inside the wrapper but outside a machine
  const wrapper = document.getElementById('fp-dropzone-wrapper');
  if (wrapper && wrapper.contains(e.target)) {
    e.preventDefault(); // prevent text selection
    fpMarqueeActive = true;
    
    if (!e.shiftKey) {
      fpDeselectAll();
    }
    
    const dzRect = dropzone.getBoundingClientRect();
    fpMarqueeStartX = e.clientX;
    fpMarqueeStartY = e.clientY;
    
    fpMarqueeEl = document.createElement('div');
    fpMarqueeEl.className = 'fp-marquee';
    fpMarqueeEl.style.position = 'fixed';
    fpMarqueeEl.style.border = '1px solid var(--accent)';
    fpMarqueeEl.style.backgroundColor = 'rgba(var(--accent-rgb, 59, 130, 246), 0.2)';
    fpMarqueeEl.style.pointerEvents = 'none';
    fpMarqueeEl.style.zIndex = '9999';
    document.body.appendChild(fpMarqueeEl);
    
    // Initial size 0
    updateMarqueeRect(e.clientX, e.clientY);
  }
});

document.addEventListener('mousemove', function(e) {
  if (!fpMarqueeActive || !fpMarqueeEl) return;
  updateMarqueeRect(e.clientX, e.clientY);
});

document.addEventListener('mouseup', function(e) {
  if (!fpMarqueeActive || !fpMarqueeEl) return;
  
  fpMarqueeActive = false;
  
  const mRect = fpMarqueeEl.getBoundingClientRect();
  fpMarqueeEl.remove();
  fpMarqueeEl = null;
  
  // Find all placed machines inside the marquee rectangle
  const dropzone = document.getElementById('fp-dropzone');
  if (!dropzone) return;
  
  const machines = dropzone.querySelectorAll('.fp-machine.fp-placed');
  machines.forEach(m => {
    const r = m.getBoundingClientRect();
    const overlap = !(r.right < mRect.left || 
                      r.left > mRect.right || 
                      r.bottom < mRect.top || 
                      r.top > mRect.bottom);
    if (overlap) {
      m.classList.add('fp-selected');
      fpSelectedIds.add(m.dataset.id);
    }
  });
});

function updateMarqueeRect(curX, curY) {
  const left = Math.min(fpMarqueeStartX, curX);
  const right = Math.max(fpMarqueeStartX, curX);
  const top = Math.min(fpMarqueeStartY, curY);
  const bottom = Math.max(fpMarqueeStartY, curY);
  
  fpMarqueeEl.style.left = left + 'px';
  fpMarqueeEl.style.top = top + 'px';
  fpMarqueeEl.style.width = (right - left) + 'px';
  fpMarqueeEl.style.height = (bottom - top) + 'px';
}

function fpAlignGrid(mode = 'horiz') {
  if (fpSelectedIds.size < 2) { showAlert('Selecteaza minim 2 aparate (click + drag sau Shift+click) apoi aliniaza careu.'); return; }
  fpSaveUndo();
  
  const dropzone = document.getElementById('fp-dropzone');
  const dzW = dropzone.offsetWidth || 800;
  const dzH = dropzone.offsetHeight || 600;
  const gapX = 2.8;
  const gapY = 2.8 * (dzW / dzH);
  
  const items = [];
  fpSelectedIds.forEach(id => {
    const el = dropzone.querySelector(`[data-id="${id}"]`);
    if (el) items.push({ id, el, x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
  });
  
  // Dacă e orizontal, sortăm rând cu rând (Y primar). Dacă e vertical, coloană cu coloană (X primar).
  if (mode === 'horiz') {
    items.sort((a, b) => (Math.abs(a.y - b.y) > gapY/2 ? a.y - b.y : a.x - b.x));
  } else {
    items.sort((a, b) => (Math.abs(a.x - b.x) > gapX/2 ? a.x - b.x : a.y - b.y));
  }
  
  const total = items.length;
  let dims = Math.ceil(Math.sqrt(total));
  
  const minX = Math.min(...items.map(i => i.x));
  const minY = Math.min(...items.map(i => i.y));
  
  items.forEach((item, index) => {
    let r, c;
    if (mode === 'horiz') {
      r = Math.floor(index / dims);
      c = index % dims;
    } else {
      c = Math.floor(index / dims);
      r = index % dims;
    }
    const newX = Math.min(100, minX + c * gapX);
    const newY = Math.min(100, minY + r * gapY);
    item.el.style.left = newX + '%';
    item.el.style.top = newY + '%';
    floorplanState.positions[item.id] = { ...floorplanState.positions[item.id], x: newX, y: newY };
  });
}

function fpFilterList() {
  const searchInput = document.getElementById('fp-search');
  if (!searchInput) return;
  const q = searchInput.value.toLowerCase();
  
  const listEl = document.getElementById('fp-machine-list');
  const cards = listEl.querySelectorAll('.fp-list-card, .fp-machine');
  
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    const title = (card.title || '').toLowerCase();
    if (text.includes(q) || title.includes(q)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// === ROTATION LOGIC ===
let isRotating = false;
let rotateStartAngle = 0;
let rotateStartMouseAngle = 0;
let rotatingElementId = null;

document.addEventListener('mousedown', function(e) {
  if (e.target.classList.contains('fp-rotate-handle')) {
    e.preventDefault();
    e.stopPropagation();
    isRotating = true;
    const machineEl = e.target.closest('.fp-machine');
    rotatingElementId = machineEl.dataset.id;
    
    const rect = machineEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    rotateStartMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    rotateStartAngle = floorplanState.positions[rotatingElementId].angle || 0;
    
    fpSaveUndo();
  }
});

document.addEventListener('mousemove', function(e) {
  if (isRotating && rotatingElementId) {
    const dropzone = document.getElementById('fp-dropzone');
    const machineEl = dropzone.querySelector(`[data-id="${rotatingElementId}"]`);
    if (!machineEl) return;
    
    const rect = machineEl.getBoundingClientRect();
    // Pentru a menține calculul corect, nu folosim centrul afectat de rotație
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const currentMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    let delta = currentMouseAngle - rotateStartMouseAngle;
    
    if (e.shiftKey) {
      delta = Math.round(delta / 15) * 15;
    }
    
    let newAngle = (rotateStartAngle + delta) % 360;
    
    floorplanState.positions[rotatingElementId].angle = newAngle;
    machineEl.style.transform = `translate(-50%, -50%) rotate(${newAngle}deg)`;
  }
});

document.addEventListener('mouseup', function(e) {
  if (isRotating) {
    isRotating = false;
    rotatingElementId = null;
  }
});


// === GLOBAL FLOORPLAN SETTINGS & ZOOM ===
let globalFpZoomLevel = 1;
let globalFpSettings = { metric: 'in_zi', rules: [ { min: 0, max: 200, color: '#ef4444' }, { min: 201, max: 500, color: '#fbbf24' }, { min: 501, max: 9999999, color: '#22c55e' } ] };

async function loadGlobalFpSettings() {
  try {
    const res = await apiAuth('/api/settings/floorplan');
    if (res && res.metric) {
      globalFpSettings = res;
      globalFpSettings.rules.forEach((r, idx) => {
         if (r.color && r.color.includes('var(--red)')) r.color = '#ef4444';
         if (r.color && r.color.includes('var(--green)')) r.color = '#22c55e';
         // Convert legacy rules to intervals if needed
         if (r.min === undefined) {
           r.min = idx === 0 ? 0 : (globalFpSettings.rules[idx-1].max + 1);
         }
      });
    }
  } catch(e) { console.error('Error loading fp settings', e); }
}

async function saveGlobalFpSettings() {
  const metric = document.getElementById('global-fp-metric').value;
  const rows = document.querySelectorAll('.fp-rule-row');
  let rules = [];
  rows.forEach(r => {
    const min = parseFloat(r.querySelector('.fp-rule-min').value) || 0;
    const max = parseFloat(r.querySelector('.fp-rule-max').value) || 0;
    const color = r.querySelector('.fp-rule-color').value;
    rules.push({ min, max, color });
  });
  rules.sort((a,b) => a.min - b.min);
  if (rules.length === 0) rules.push({ min: 0, max: 9999999, color: 'var(--green)' });
  
  const payload = { metric, rules };
  try {
    const res = await apiAuth('/api/settings/floorplan', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (res.success) {
      globalFpSettings = payload;
      closeGlobalFpSettings();
      loadGlobalFloorplan();
    }
  } catch(e) { showAlert('Eroare la salvare.'); }
}

function openGlobalFpSettings() {
  document.getElementById('global-fp-metric').value = globalFpSettings.metric;
  renderGlobalFpRules();
  document.getElementById('global-fp-settings-modal').style.display = 'flex';
}
function closeGlobalFpSettings() {
  document.getElementById('global-fp-settings-modal').style.display = 'none';
}

function renderGlobalFpRules() {
  const c = document.getElementById('global-fp-rules-container');
  c.innerHTML = '';
  globalFpSettings.rules.forEach((r, idx) => {
    addGlobalFpRuleRow(r.min !== undefined ? r.min : 0, r.max, r.color, idx);
  });
}

function addGlobalFpRuleRow(minVal = 0, maxVal = 1000, color = '#3b82f6', idx = -1) {
  const c = document.getElementById('global-fp-rules-container');
  const div = document.createElement('div');
  div.className = 'fp-rule-row';
  div.style = 'display:flex; gap:12px; align-items:center; background:var(--surface); padding:8px 12px; border-radius:8px; border:1px solid var(--border); margin-bottom:8px;';
  div.innerHTML = `
    <span style="font-size:12px; color:var(--text); font-weight:600;">Între</span>
    <input type="number" class="fp-rule-min" value="${minVal}" style="width:70px; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:12px; background:var(--surface2); color:var(--text);">
    <span style="font-size:12px; color:var(--text); font-weight:600;">și</span>
    <input type="number" class="fp-rule-max" value="${maxVal}" style="width:70px; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:12px; background:var(--surface2); color:var(--text);">
    <span style="font-size:12px; color:var(--text); font-weight:600;">colorează în</span>
    <input type="color" class="fp-rule-color" value="${color}" style="width:40px; height:30px; border:none; padding:0; background:none; cursor:pointer;">
    <button onclick="this.parentElement.remove()" style="margin-left:auto; background:var(--red); color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">X</button>
  `;
  c.appendChild(div);
}
function addGlobalFpRule() { addGlobalFpRuleRow(0, 1000); }

function globalFpZoom(delta) {
  globalFpZoomLevel = Math.max(0.5, Math.min(5, globalFpZoomLevel + delta));
  applyGlobalFpZoom();
}
function globalFpZoomReset() {
  globalFpZoomLevel = 1;
  applyGlobalFpZoom();
}

function applyGlobalFpZoom() {
  const dz = document.getElementById('global-fp-container');
  const wrapper = document.getElementById('global-fp-wrapper');
  if (!dz || !wrapper) return;
  
  if (dz.style.aspectRatio) {
    const [w, h] = dz.style.aspectRatio.split('/').map(Number);
    const imgAspect = w / h;
    if (wrapper.clientWidth > 0 && wrapper.clientHeight > 0) {
      const wrapperAspect = wrapper.clientWidth / wrapper.clientHeight;
      if (imgAspect > wrapperAspect) {
        dz.style.width = (100 * globalFpZoomLevel) + '%';
        dz.style.height = 'auto';
      } else {
        dz.style.width = ((imgAspect / wrapperAspect) * 100 * globalFpZoomLevel) + '%';
        dz.style.height = 'auto';
      }
    }
    dz.style.minHeight = 'auto';
    dz.style.margin = 'auto';
  } else {
    dz.style.width = (100 * globalFpZoomLevel) + '%';
    dz.style.height = (100 * globalFpZoomLevel) + '%';
    dz.style.minHeight = (500 * globalFpZoomLevel) + 'px';
    dz.style.margin = 'auto';
  }
  
  dz.style.backgroundSize = '100% 100%'; 
  dz.style.transform = 'none';
  
  const scroll = document.getElementById('global-fp-scroll');
  if (!scroll) return;
  
  if (globalFpZoomLevel <= 1) {
    scroll.style.display = 'flex';
    scroll.style.alignItems = 'center';
    scroll.style.justifyContent = 'center';
    scroll.style.overflow = 'hidden';
  } else {
    scroll.style.display = 'block';
    scroll.style.alignItems = 'initial';
    scroll.style.justifyContent = 'initial';
    scroll.style.overflow = 'auto';
  }
  const label = document.getElementById('global-fp-zoom-label');
  if (label) label.textContent = Math.round(globalFpZoomLevel * 100) + '%';
}

// === LOCATIE FLOORPLAN ZOOM ===
let locFpZoomLevel = 1;
window.locFpZoom = function(delta) {
  locFpZoomLevel = Math.max(0.5, Math.min(5, locFpZoomLevel + delta));
  applyLocFpZoom();
}
function applyLocFpZoom() {
  const dz = document.getElementById('ld-floorplan-container');
  const wrapper = document.getElementById('ld-floorplan-wrapper');
  if (!dz || !wrapper) return;
  
  if (dz.style.aspectRatio) {
    const [w, h] = dz.style.aspectRatio.split('/').map(Number);
    const imgAspect = w / h;
    if (wrapper.clientWidth > 0 && wrapper.clientHeight > 0) {
      const wrapperAspect = wrapper.clientWidth / wrapper.clientHeight;
      if (imgAspect > wrapperAspect) {
        dz.style.width = (100 * locFpZoomLevel) + '%';
        dz.style.height = 'auto';
      } else {
        dz.style.width = ((imgAspect / wrapperAspect) * 100 * locFpZoomLevel) + '%';
        dz.style.height = 'auto';
      }
    }
    dz.style.minHeight = 'auto';
    dz.style.margin = 'auto';
  } else {
    dz.style.width = (100 * locFpZoomLevel) + '%';
    dz.style.height = (100 * locFpZoomLevel) + '%';
    dz.style.minHeight = (500 * locFpZoomLevel) + 'px';
    dz.style.margin = 'auto';
  }
  
  dz.style.backgroundSize = '100% 100%'; 
  dz.style.transform = 'none';
  
  const scroll = document.getElementById('ld-floorplan-scroll');
  if (!scroll) return;
  
  if (locFpZoomLevel <= 1) {
    scroll.style.display = 'flex';
    scroll.style.alignItems = 'center';
    scroll.style.justifyContent = 'center';
    scroll.style.overflow = 'hidden';
  } else {
    scroll.style.display = 'block';
    scroll.style.alignItems = 'initial';
    scroll.style.justifyContent = 'initial';
    scroll.style.overflow = 'auto';
  }
}

window.locFpFullscreen = function() {
  const wrp = document.getElementById('ld-floorplan-wrapper');
  const tooltip = document.getElementById('fp-custom-tooltip');
  if (!wrp) return;
  if (!document.fullscreenElement) {
    if (tooltip) wrp.appendChild(tooltip);
    if (wrp.requestFullscreen) {
      wrp.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else if (wrp.webkitRequestFullscreen) {
      wrp.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

function makeWrapperDraggable(wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  if (wrapper.dataset.dragEnabled === 'true') return;
  wrapper.dataset.dragEnabled = 'true';
  
  let isDown = false;
  let startX;
  let startY;
  let scrollLeft;
  let scrollTop;

  wrapper.addEventListener('mousedown', (e) => {
    // Only pan if clicking on the background, not on machines or buttons
    if (e.target.closest('button') || e.target.closest('.fp-machine-card') || e.target.closest('.fp-rotate-handle')) return;
    
    isDown = true;
    wrapper.style.cursor = 'grabbing';
    startX = e.pageX - wrapper.offsetLeft;
    startY = e.pageY - wrapper.offsetTop;
    scrollLeft = wrapper.scrollLeft;
    scrollTop = wrapper.scrollTop;
  });
  
  wrapper.addEventListener('mouseleave', () => {
    isDown = false;
    wrapper.style.cursor = '';
  });
  
  wrapper.addEventListener('mouseup', () => {
    isDown = false;
    wrapper.style.cursor = '';
  });
  
  wrapper.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - wrapper.offsetLeft;
    const y = e.pageY - wrapper.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    wrapper.scrollLeft = scrollLeft - walkX;
    wrapper.scrollTop = scrollTop - walkY;
  });
}



function showFpTooltip(el, e, serie, joc, ggr, inZi, totalIn, bet, cabinet, betMediu) {
  const tt = document.getElementById('fp-custom-tooltip');
  if (!tt) return;
  document.getElementById('fp-tt-serie').textContent = 'Seria: ' + serie;
  document.getElementById('fp-tt-cabinet').textContent = cabinet;
  document.getElementById('fp-tt-joc').textContent = joc;
  document.getElementById('fp-tt-ggr').textContent = fmt(ggr);
  document.getElementById('fp-tt-in-zi').textContent = fmt(inZi);
  document.getElementById('fp-tt-total-in').textContent = fmt(totalIn);
  document.getElementById('fp-tt-bet').textContent = fmt(bet);
  document.getElementById('fp-tt-bet-mediu').textContent = fmt(betMediu);
  
  tt.style.display = 'block';
  
  // Position it next to cursor
  let x = e.clientX + 15;
  let y = e.clientY + 15;
  
  // keep on screen
  if (x + tt.offsetWidth > window.innerWidth) x = e.clientX - tt.offsetWidth - 15;
  if (y + tt.offsetHeight > window.innerHeight) y = e.clientY - tt.offsetHeight - 15;
  
  tt.style.left = x + 'px';
  tt.style.top = y + 'px';
}

function moveFpTooltip(e) {
  const tt = document.getElementById('fp-custom-tooltip');
  if (!tt || tt.style.display === 'none') return;
  let x = e.clientX + 15;
  let y = e.clientY + 15;
  if (x + tt.offsetWidth > window.innerWidth) x = e.clientX - tt.offsetWidth - 15;
  if (y + tt.offsetHeight > window.innerHeight) y = e.clientY - tt.offsetHeight - 15;
  tt.style.left = x + 'px';
  tt.style.top = y + 'px';
}

function hideFpTooltip() {
  const tt = document.getElementById('fp-custom-tooltip');
  if (tt) tt.style.display = 'none';
}

function switchFpTab(tabId) {
  const tA = document.getElementById('fp-tab-aparate');
  const tC = document.getElementById('fp-tab-cabinete');
  const tJ = document.getElementById('fp-tab-jocuri');
  const cA = document.getElementById('fp-content-aparate');
  const cC = document.getElementById('fp-content-cabinete');
  const cJ = document.getElementById('fp-content-jocuri');
  
  if(!tA || !tC || !tJ || !cA || !cC || !cJ) return;
  
  // reset all
  [tA, tC, tJ].forEach(t => {
    t.style.borderBottom = '2px solid transparent';
    t.style.color = 'var(--muted)';
    t.style.background = 'transparent';
  });
  [cA, cC, cJ].forEach(c => {
    c.style.display = 'none';
  });

  // active
  let tAct, cAct;
  if (tabId === 'aparate') { tAct = tA; cAct = cA; }
  else if (tabId === 'cabinete') { tAct = tC; cAct = cC; }
  else if (tabId === 'jocuri') { tAct = tJ; cAct = cJ; }

  if (tAct && cAct) {
    tAct.style.borderBottom = '2px solid var(--accent)';
    tAct.style.color = 'var(--text)';
    tAct.style.background = 'var(--surface)';
    cAct.style.display = 'block';
  }
}

// Stare globala pentru directia de sortare pe coloane
let fpSortDirs = {};

function sortFpTable(tbodyId, colIdx, type) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;

  const key = tbodyId + '_' + colIdx;
  fpSortDirs[key] = fpSortDirs[key] === 'asc' ? 'desc' : 'asc';
  const dir = fpSortDirs[key];

  rows.sort((a, b) => {
    const tdA = a.querySelectorAll('td')[colIdx];
    const tdB = b.querySelectorAll('td')[colIdx];
    if (!tdA || !tdB) return 0;

    // Extragem doar textul (ex. din tdA.innerText care ia si ce e in div-uri)
    let valA = tdA.innerText.trim();
    let valB = tdB.innerText.trim();

    if (type === 'num') {
      valA = parseFloat(valA.replace(/\./g, '').replace(',', '.')) || 0;
      valB = parseFloat(valB.replace(/\./g, '').replace(',', '.')) || 0;
      return dir === 'asc' ? valA - valB : valB - valA;
    } else {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    }
  });

  // Re-append in noua ordine
  rows.forEach(r => tbody.appendChild(r));
}

function toggleGlobalFpFullscreen() {
  const wrapper = document.getElementById('global-fp-wrapper');
  const tooltip = document.getElementById('fp-custom-tooltip');
  if (!wrapper) return;
  if (!document.fullscreenElement) {
    // Move tooltip inside wrapper so it's visible in fullscreen
    if (tooltip) wrapper.appendChild(tooltip);
    if (wrapper.requestFullscreen) {
      wrapper.requestFullscreen();
    } else if (wrapper.webkitRequestFullscreen) {
      wrapper.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    const tooltip = document.getElementById('fp-custom-tooltip');
    if (tooltip) document.body.appendChild(tooltip);
  }
});

let currentHighlightedFpIds = [];

function clearFpMachineHighlights() {
  currentHighlightedFpIds = [];
  const allMachines = document.querySelectorAll('#global-fp-container > div');
  allMachines.forEach(el => {
    const card = el.querySelector('.fp-machine-card');
    if (card) {
      card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
      card.style.border = 'none';
      card.style.transform = 'scale(1)';
      card.style.zIndex = '1';
    }
  });
}

function highlightFpMachine(machineIds) {
  const ids = Array.isArray(machineIds) ? machineIds : [machineIds];
  
  // Toggle logic if exactly the same machines are already selected
  if (ids.length === currentHighlightedFpIds.length && ids.every((val, index) => val === currentHighlightedFpIds[index])) {
    clearFpMachineHighlights();
    return;
  }

  clearFpMachineHighlights();
  currentHighlightedFpIds = ids;

  let firstEl = null;

  ids.forEach(id => {
    const selectedEl = document.getElementById(`fp-machine-${id}`);
    if (selectedEl) {
      if (!firstEl) firstEl = selectedEl;
      const card = selectedEl.querySelector('.fp-machine-card');
      if (card) {
        card.style.boxShadow = '0 0 8px 3px var(--purple)';
        card.style.border = '2px solid var(--purple)';
        card.style.transform = 'scale(1.1)';
        card.style.zIndex = '100';
      }
    }
  });
}

// Initial load settings
document.addEventListener('DOMContentLoaded', () => {
  loadGlobalFpSettings();
});


window.loadAnalizaRtpData = async function() {
  const { s, e } = getPeriod();
  const loc = document.getElementById('locationFilter') ? document.getElementById('locationFilter').value : '';
  const tbody = document.getElementById('body-analiza-rtp');
  
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:30px;"><div class="spinner"></div><br>Se generează matricea RTP...</td></tr>';
  }

  try {
    const url = `/api/analiza/rtp?start=${s}&end=${e}${loc ? '&location='+loc : ''}`;
    const data = await api(url);
    
    // Store raw data for filtering
    tableStates['analiza-rtp'].rawData = data;
    
    // Populate filter dropdowns
    const uniqueLocs = [...new Set(data.map(r => r.locatie).filter(Boolean))].sort();
    const uniqueMixes = [...new Set(data.map(r => r.producator).filter(Boolean))].sort();
    
    const selLoc = document.getElementById('flt-rtp-loc');
    const selMix = document.getElementById('flt-rtp-prod');
    
    if (selLoc) {
      selLoc.innerHTML = '<option value="">Toate</option>' + uniqueLocs.map(l => `<option value="${l}">${l}</option>`).join('');
    }
    if (selMix) {
      selMix.innerHTML = '<option value="">Toate</option>' + uniqueMixes.map(m => `<option value="${m}">${m}</option>`).join('');
    }

    // Map JSON to HTML rows
    tableStates['analiza-rtp'].rows = data.map((r, i) => {
      const diffColor = r.diff > 0 ? '#ef4444' : (r.diff < 0 ? '#10b981' : 'var(--text)');
      return `
        <tr style="${r.is_active ? '' : 'opacity:0.8;'}">
          <td style="text-align:center;">${i + 1}</td>
          <td style="text-align:left;">
            ${r.is_active ? '' : '<span class="badge" style="background:var(--danger); color:white; padding:2px 6px; font-size:10px; margin-right:6px; border-radius:4px;">RETRAS</span>'}
            ${r.locatie}
          </td>
          <td style="text-align:left;">${r.producator}</td>
          <td style="text-align:left;">${r.tip}</td>
          <td style="text-align:left;">${r.serial}</td>
          <td style="text-align:center;">${(r.install_date ? Math.max(1, Math.floor((new Date() - new Date(r.install_date.replace(' ', 'T'))) / (1000 * 60 * 60 * 24))) : 0)}</td>
          <td style="text-align:right;">${fmt(r.total_in, 2)}</td>
          <td style="text-align:right;">${fmt(r.total_out, 2)}</td>
          <td style="text-align:right;">${fmt(r.marketing, 2)}</td>
          <td style="text-align:right;"><b>${fmt(r.ggr, 2)}</b></td>
          <td style="text-align:right; color:#eab308; font-weight:bold;">${r.real_rtp.toFixed(2)}%</td>
          <td style="text-align:right; color:#3b82f6;">${r.theoretical_rtp.toFixed(2)}%</td>
          <td style="text-align:right; color:${diffColor}; font-weight:bold;">${r.diff > 0 ? '+' : ''}${r.diff.toFixed(2)}%</td>
        </tr>
      `;
    });
    
    tableStates['analiza-rtp'].filteredRows = null;
    tableStates['analiza-rtp'].page = 1;

    
    const countEl = document.getElementById('analiza-rtp-count');
    if (countEl) countEl.innerText = data.length;
    
    // Calculați totalurile pentru RTP Teoretic table
    let tIn = 0, tOut = 0, tMkt = 0, tGgr = 0;
    data.forEach(r => {
        tIn += r.total_in || 0;
        tOut += r.total_out || 0;
        tMkt += r.marketing || 0;
        tGgr += r.ggr || 0;
    });
    
    const overallRtp = tIn > 0 ? (tOut / tIn) * 100 : 0;
    
    const foot = document.getElementById('foot-analiza-rtp');
    if (foot) {
        foot.innerHTML = `
            <tr>
                <th colspan="6" style="text-align:right; padding:12px;">TOTAL:</th>
                <th style="text-align:right; padding:12px;">${fmt(tIn, 2)}</th>
                <th style="text-align:right; padding:12px;">${fmt(tOut, 2)}</th>
                <th style="text-align:right; padding:12px;">${fmt(tMkt, 2)}</th>
                <th style="text-align:right; padding:12px;">${fmt(tGgr, 2)}</th>
                <th style="text-align:right; color:#eab308; padding:12px;">${overallRtp.toFixed(2)}%</th>
                <th colspan="2"></th>
            </tr>
        `;
    }
    

    renderTablePaginated('analiza-rtp');

  } catch(err) {
    console.error(err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:red; padding:30px;">Eroare: ${err.message}</td></tr>`;
  }
}

window.filterRtpTable = function() {
  const loc = document.getElementById('flt-rtp-loc').value.toLowerCase();
  const prod = document.getElementById('flt-rtp-prod').value.toLowerCase();
  const serial = document.getElementById('flt-rtp-serial').value.toLowerCase();
  const zile = document.getElementById('flt-rtp-zile').value.toLowerCase();
  
  if (!tableStates['analiza-rtp'].rawData) return;
  
  if (!loc && !prod && !serial && !zile) {
    tableStates['analiza-rtp'].filteredRows = null;
    document.getElementById('analiza-rtp-count').innerText = tableStates['analiza-rtp'].rawData.length;
  } else {
    tableStates['analiza-rtp'].filteredRows = tableStates['analiza-rtp'].rawData.map((r, i) => {
      const matchLoc = r.locatie.toLowerCase().includes(loc);
      const matchProd = (r.producator + ' ' + r.tip).toLowerCase().includes(prod);
      const matchSerial = r.serial.toLowerCase().includes(serial);
      const calcZile = (r.install_date ? Math.max(1, Math.floor((new Date() - new Date(r.install_date.replace(' ', 'T'))) / (1000 * 60 * 60 * 24))) : 0);
      const matchZile = String(calcZile).includes(zile);
      if (matchLoc && matchProd && matchSerial && matchZile) {
        return tableStates['analiza-rtp'].rows[i];
      }
      return null;
    }).filter(row => row !== null);
    document.getElementById('analiza-rtp-count').innerText = tableStates['analiza-rtp'].filteredRows.length;
  }
  
  tableStates['analiza-rtp'].page = 1;
  renderTablePaginated('analiza-rtp');
};

window.loadAnalizaResetsData = async function() {
  const tbody = document.getElementById('body-analiza-resets');
  
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px;"><div class="spinner"></div><br>Se generează raportul...</td></tr>';
  }

  try {
    const url = `/api/analiza/resets`;
    const data = await api(url);
    
    // Store raw data for filtering
    tableStates['analiza-resets'].rawData = data;
    
    let tIn = 0;
    let tOut = 0;
    let tGgr = 0;

    // Populate filter dropdowns
    const uniqueLocs = [...new Set(data.map(r => r.locatie).filter(Boolean))].sort();
    const uniqueMixes = [...new Set(data.map(r => r.tip).filter(Boolean))].sort();
    
    const selLoc = document.getElementById('flt-resets-loc');
    const selMix = document.getElementById('flt-resets-mix');
    
    if (selLoc) {
      selLoc.innerHTML = '<option value="">Toate</option>' + uniqueLocs.map(l => `<option value="${l}">${l}</option>`).join('');
    }
    if (selMix) {
      selMix.innerHTML = '<option value="">Toate</option>' + uniqueMixes.map(m => `<option value="${m}">${m}</option>`).join('');
    }

    // Map JSON to HTML rows
    tableStates['analiza-resets'].rows = data.map((r, i) => {
      tIn += r.total_in;
      tOut += r.total_out;
      tGgr += r.ggr;
      return `
        <tr style="transition: background 0.2s; ${r.is_active ? '' : 'opacity:0.8;'}" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
          <td style="text-align:center;">${i + 1}</td>
          <td style="text-align:left;">
            ${r.is_active ? '' : '<span class="badge" style="background:var(--danger); color:white; padding:2px 6px; font-size:10px; margin-right:6px; border-radius:4px;">RETRAS</span>'}
            ${r.locatie}
          </td>
          <td style="text-align:left;">${r.cabinet || r.producator || '-'}</td>
          <td style="text-align:left;">${r.tip}</td>
          <td style="text-align:left;">${r.serial}</td>
          <td style="text-align:center; color:#3b82f6;">${r.data_reset}</td>
          <td style="text-align:center;">${r.zile}</td>
          <td style="text-align:right;">${fmt(r.total_in, 2)}</td>
          <td style="text-align:right;">${fmt(r.total_out, 2)}</td>
          <td style="text-align:right; font-weight:bold; color:${r.ggr > 0 ? '#10b981' : '#ef4444'};">${fmt(r.ggr, 2)}</td>
          <td style="text-align:right; color:#eab308; font-weight:bold;">${r.real_rtp.toFixed(2)}%</td>
        </tr>
      `;
    });
    
    // Remove the manual setting of filteredRows and totals
    // Call filterAnalizaResetsTable to apply the initial 'Doar În Sală' filter and calculate totals
    filterAnalizaResetsTable();

  } catch(err) {
    console.error(err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red; padding:30px;">Eroare: ${err.message}</td></tr>`;
  }
};

window.openMachineDetails = async function(serial) {
  // Hide all other pages
  document.querySelectorAll('.rep-page').forEach(p => p.style.display = 'none');
  
  const page = document.getElementById('analiza-machine-details');
  if (!page) return;
  page.style.display = 'block';
  
  // Reset contents and show loading
  document.getElementById('md-serial').innerText = serial;
  document.getElementById('md-mix').innerText = '...';
  document.getElementById('md-loc').innerText = '...';
  document.getElementById('md-stat-in').innerText = '0.00';
  document.getElementById('md-stat-out').innerText = '0.00';
  document.getElementById('md-stat-jp').innerText = '0.00';
  
  document.getElementById('body-md-loc').innerHTML = '<tr><td colspan="10" style="text-align:center;"><div class="spinner"></div></td></tr>';
  document.getElementById('body-md-res').innerHTML = '<tr><td colspan="3" style="text-align:center;"><div class="spinner"></div></td></tr>';
  document.getElementById('body-md-pay').innerHTML = '<tr><td colspan="6" style="text-align:center;"><div class="spinner"></div></td></tr>';
  
  try {
    const data = await api(`/api/machine/${serial}/details`);
    
    // Quick stats
    if (data.location_history && data.location_history.length > 0) {
      document.getElementById('md-loc').innerText = data.location_history[0].location_name;
    }
    document.getElementById('md-stat-in').innerText = fmt(data.stats.total_in, 2);
    document.getElementById('md-stat-out').innerText = fmt(data.stats.total_out, 2);
    document.getElementById('md-stat-jp').innerText = fmt(data.stats.total_jp, 2);
    
    // Mix - find from original table or data
    const row = tableStates['analiza-resets']?.rawData?.find(r => r.serial == serial);
    if (row) document.getElementById('md-mix').innerText = row.tip;
    
    // Initialize Table States for the three tabs
    tableStates['md-loc'] = { page: 1, limit: 10, tbody: 'body-md-loc', pagination: 'pg-md-loc', rows: [] };
    tableStates['md-res'] = { page: 1, limit: 10, tbody: 'body-md-res', pagination: 'pg-md-res', rows: [] };
    tableStates['md-pay'] = { page: 1, limit: 10, tbody: 'body-md-pay', pagination: 'pg-md-pay', rows: [] };
    
    // 1. Location History
    let t_loc_in = 0, t_loc_out = 0, t_loc_jp = 0, t_loc_hh = 0, t_loc_ggr = 0;
    if (data.location_history && data.location_history.length > 0) {
      tableStates['md-loc'].rows = data.location_history.map((l, i) => {
        const _in = parseFloat(l.total_in) || 0;
        const _out = parseFloat(l.total_out) || 0;
        const _jp = parseFloat(l.total_jp) || 0;
        const _hh = parseFloat(l.total_hh) || 0;
        const _ggr = _in - _out;
        const _rtp = _in > 0 ? (_out / _in) * 100 : 0;
        
        t_loc_in += _in; t_loc_out += _out; t_loc_jp += _jp; t_loc_hh += _hh; t_loc_ggr += _ggr;
        
        return `
          <tr>
            <td style="text-align:center;">${i+1}</td>
            <td style="text-align:left; font-weight:bold;">${l.location_name}</td>
            <td style="text-align:center;">${l.created_at}</td>
            <td style="text-align:center;">${l.deleted_at}</td>
            <td style="text-align:right;">${fmt(_in, 2)}</td>
            <td style="text-align:right;">${fmt(_out, 2)}</td>
            <td style="text-align:right;">${fmt(_jp, 2)}</td>
            <td style="text-align:right;">${fmt(_hh, 2)}</td>
            <td style="text-align:right; font-weight:bold; color:${_ggr >= 0 ? 'var(--success)' : 'var(--danger)'};">${fmt(_ggr, 2)}</td>
            <td style="text-align:right; font-weight:bold; color:var(--warning);">${_rtp.toFixed(2)}%</td>
          </tr>
        `;
      });
    }
    document.getElementById('md-loc-tot-in').innerText = fmt(t_loc_in, 2);
    document.getElementById('md-loc-tot-out').innerText = fmt(t_loc_out, 2);
    document.getElementById('md-loc-tot-jp').innerText = fmt(t_loc_jp, 2);
    document.getElementById('md-loc-tot-hh').innerText = fmt(t_loc_hh, 2);
    document.getElementById('md-loc-tot-ggr').innerText = fmt(t_loc_ggr, 2);
    document.getElementById('md-loc-tot-rtp').innerText = (t_loc_in > 0 ? ((t_loc_out/t_loc_in)*100).toFixed(2) : '0.00') + '%';
    renderTablePaginated('md-loc');
    
    // 2. Resets History
    if (data.resets_history && data.resets_history.length > 0) {
      tableStates['md-res'].rows = data.resets_history.map((r, i) => `
        <tr>
          <td style="text-align:center;">${i+1}</td>
          <td style="text-align:center; color:var(--accent); font-weight:600;">${r.date}</td>
          <td style="text-align:left;">${r.location_name}</td>
        </tr>
      `);
      document.getElementById('md-res-tot').innerText = data.resets_history.length;
    } else {
      document.getElementById('md-res-tot').innerText = '0';
    }
    renderTablePaginated('md-res');
    
    // 3. Large Payouts
    let t_pay_out = 0, t_pay_jp = 0, t_pay_hh = 0;
    if (data.large_payouts && data.large_payouts.length > 0) {
      tableStates['md-pay'].rows = data.large_payouts.map((p, i) => {
        const _o = parseFloat(p.out) || 0;
        const _j = parseFloat(p.jackpot) || 0;
        const _h = parseFloat(p.hh) || 0;
        t_pay_out += _o; t_pay_jp += _j; t_pay_hh += _h;
        return `
          <tr>
            <td style="text-align:center;">${i+1}</td>
            <td style="text-align:center;">${p.date}</td>
            <td style="text-align:left;">${p.location_name}</td>
            <td style="text-align:right; color:var(--danger); font-weight:bold;">${fmt(_o, 2)}</td>
            <td style="text-align:right; color:var(--warning); font-weight:bold;">${fmt(_j, 2)}</td>
            <td style="text-align:right; color:#a855f7; font-weight:bold;">${fmt(_h, 2)}</td>
          </tr>
        `;
      });
    }
    document.getElementById('md-pay-tot-out').innerText = fmt(t_pay_out, 2);
    document.getElementById('md-pay-tot-jp').innerText = fmt(t_pay_jp, 2);
    document.getElementById('md-pay-tot-hh').innerText = fmt(t_pay_hh, 2);
    renderTablePaginated('md-pay');
    
    
    // 4. ONJN History
    try {
      const onjnData = await api(`/api/onjn/slots/${serial}/history`);
      const timeline = document.getElementById('md-onjn-timeline');
      if (!onjnData || onjnData.length === 0) {
        timeline.innerHTML = '<div style="color:var(--muted); text-align:center;">Nu există istoric ONJN pentru acest aparat.</div>';
      } else {
        timeline.innerHTML = onjnData.map(ev => {
          if (ev.history_event_type === 'decision') {
            return `
              <div style="padding:12px 0; border-bottom:1px solid var(--border); display:flex; align-items:flex-start; gap:12px;">
                <div style="width:12px; height:12px; border-radius:50%; background:var(--success); margin-top:4px;"></div>
                <div>
                  <div style="font-weight:700; font-size:14px; color:var(--text);">Decizie: ${ev.decision_number || '-'}</div>
                  <div style="font-size:12px; color:var(--muted); margin-bottom:4px;">Dată Decizie: ${ev.decision_date || '-'} | Tip: ${ev.type || '-'}</div>
                  <div style="font-size:12px; color:var(--muted);">Total Sloturi Aprobate: ${ev.total_slots || 0}</div>
                  ${ev.location_id ? `<div style="font-size:12px; color:var(--muted);">De la: ${ev.location_id} ${ev.location_id_dest ? `→ ${ev.location_id_dest}` : ''}</div>` : ''}
                </div>
              </div>
            `;
          } else if (ev.history_event_type === 'notification') {
             return `
              <div style="padding:12px 0; border-bottom:1px solid var(--border); display:flex; align-items:flex-start; gap:12px;">
                <div style="width:12px; height:12px; border-radius:50%; background:var(--accent); margin-top:4px;"></div>
                <div>
                  <div style="font-weight:700; font-size:14px; color:var(--text);">Notificare (${ev.level}): ${ev.notification_number || '-'}</div>
                  <div style="font-size:12px; color:var(--muted); margin-bottom:4px;">Tip: ${ev.type || '-'} | Dată: ${ev.date || '-'}</div>
                  <div style="font-size:12px; color:var(--muted);">Transmisă la: ${ev.transmission_date || '-'} | Status: ${ev.status || '-'}</div>
                </div>
              </div>
            `;
          }
        }).join('');
      }
    } catch(err) {
      document.getElementById('md-onjn-timeline').innerHTML = `<div style="color:var(--danger); text-align:center;">Eroare la încărcarea istoricului ONJN: ${err.message}</div>`;
    }
    
  } catch(err) {
    console.error(err);
    document.getElementById('body-md-loc').innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">Eroare: ${err.message}</td></tr>`;
    document.getElementById('body-md-res').innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">Eroare: ${err.message}</td></tr>`;
    document.getElementById('body-md-pay').innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Eroare: ${err.message}</td></tr>`;
  }
};

window.closeMachineDetails = function() {
  document.getElementById('analiza-machine-details').style.display = 'none';
  document.getElementById('analiza-resets').style.display = 'block';
};

window.filterAnalizaResetsTable = function() {
  const fLoc = (document.getElementById('flt-resets-loc')?.value || '').toLowerCase();
  const fMix = (document.getElementById('flt-resets-mix')?.value || '').toLowerCase();
  const fSerial = (document.getElementById('flt-resets-serial')?.value || '').toLowerCase();
  
  if (!tableStates['analiza-resets'].rawData) return;
  
  const fActive = document.getElementById('flt-resets-active-only')?.checked;
  
  let tIn = 0, tOut = 0, tGgr = 0;
  
  if (!fLoc && !fMix && !fSerial && !fActive) {
    tableStates['analiza-resets'].filteredRows = null;
    
    // Sum all if no filter
    tableStates['analiza-resets'].rawData.forEach(r => {
      tIn += r.total_in || 0;
      tOut += r.total_out || 0;
      tGgr += r.ggr || 0;
    });
  } else {
    tableStates['analiza-resets'].filteredRows = tableStates['analiza-resets'].rawData.map((r, i) => {
      const matchLoc = !fLoc || (r.locatie || '').toLowerCase().includes(fLoc);
      const matchMix = !fMix || (r.tip || '').toLowerCase().includes(fMix);
      const matchSerial = !fSerial || (r.serial || '').toLowerCase().includes(fSerial);
      const matchActive = !fActive || r.is_active === true;
      
      if (matchLoc && matchMix && matchSerial && matchActive) {
        tIn += r.total_in || 0;
        tOut += r.total_out || 0;
        tGgr += r.ggr || 0;
        return tableStates['analiza-resets'].rows[i];
      }
      return null;
    }).filter(row => row !== null);
  }
  
  document.getElementById('analiza-resets-total-in').innerText = fmt(tIn, 2);
  document.getElementById('analiza-resets-total-out').innerText = fmt(tOut, 2);
  document.getElementById('analiza-resets-total-ggr').innerText = fmt(tGgr, 2);
  document.getElementById('analiza-resets-total-rtp').innerText = (tIn > 0 ? ((tOut / tIn) * 100).toFixed(2) : '0.00') + '%';
  
  tableStates['analiza-resets'].page = 1;
  renderTablePaginated('analiza-resets');
};

window.changeTableLimit = function(key) {
  const select = document.getElementById(key + '-limit');
  if (!select) return;
  const val = select.value;
  tableStates[key].limit = val === 'all' ? 'all' : parseInt(val, 10);
  tableStates[key].page = 1;
  renderTablePaginated(key);
};

window.prevTablePage = function(key) {
  if (tableStates[key].page > 1) {
    tableStates[key].page--;
    renderTablePaginated(key);
  }
};

window.nextTablePage = function(key) {
  const st = tableStates[key];
  const dataLen = st.filteredRows ? st.filteredRows.length : (st.rows ? st.rows.length : 0);
  if (st.limit === 'all') return;
  const totalPages = Math.ceil(dataLen / st.limit);
  if (st.page < totalPages) {
    st.page++;
    renderTablePaginated(key);
  }
};

// Patch renderTablePaginated to update custom page info span if it exists
const originalRenderTablePaginated = renderTablePaginated;
renderTablePaginated = function(key) {
  originalRenderTablePaginated(key);
  const st = tableStates[key];
  if (!st) return;
  const customInfo = document.getElementById(key + '-page-info');
  if (customInfo) {
    const dataLen = st.filteredRows ? st.filteredRows.length : (st.rows ? st.rows.length : 0);
    const totalPages = st.limit === 'all' ? 1 : Math.ceil(dataLen / st.limit);
    customInfo.innerText = `Pagina ${st.page} din ${totalPages > 0 ? totalPages : 1}`;
  }
};

window.switchMdTab = function(tab, event) {
  const tabs = document.getElementById('analiza-machine-details').querySelectorAll('.md-tab');
  tabs.forEach(t => {
    t.style.borderBottomColor = 'transparent';
    t.style.color = 'var(--text-muted)';
  });
  event.target.style.borderBottomColor = 'var(--accent)';
  event.target.style.color = 'var(--accent)';

  document.getElementById('md-content-loc').style.display = 'none';
  document.getElementById('md-content-res').style.display = 'none';
  document.getElementById('md-content-pay').style.display = 'none';
  document.getElementById('md-content-' + tab).style.display = 'block';
};
async function copyLunareTable(btn) {
  if (!btn || !(btn instanceof Element)) {
    btn = document.querySelector('button[title="Copiază Tabelul (Google Sheets)"]');
  }

  if (typeof _lunareData === 'undefined' || !_lunareData || _lunareData.length === 0) {
    showToast('Nu există date pentru a fi copiate!', 'error');
    return;
  }
  
  const originalHtml = btn ? btn.innerHTML : '';
  const originalColor = btn ? btn.style.color : '';
  const originalBorder = btn ? btn.style.borderColor : '';

  const showSuccessState = () => {
    if (btn) {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      btn.style.color = '#10b981';
      btn.style.borderColor = '#10b981';
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.color = originalColor;
        btn.style.borderColor = originalBorder;
      }, 3000);
    }
  };
  
  // Re-build dataTotal just like exportLunareExcel
  const monthlyData = {};
  _lunareData.forEach(r => {
    const m = r.month || 'Necunoscut';
    const loc = r.location_name || 'Necunoscut';
    if (!monthlyData[m]) {
      monthlyData[m] = { in: 0, out: 0, ggr: 0, ngr: 0, mkt: 0, win: 0, bet: 0, serials: new Set(), locs: {} };
    }
    if (!monthlyData[m].locs[loc]) {
      monthlyData[m].locs[loc] = { in: 0, out: 0, ggr: 0, ngr: 0, mkt: 0, win: 0, bet: 0, serials: new Set() };
    }
    
    monthlyData[m].in += (+r.in_val || 0);
    monthlyData[m].out += (+r.out_val || 0);
    monthlyData[m].ggr += (+r.ggr || 0);
    monthlyData[m].ngr += (+r.ngr || 0);
    monthlyData[m].mkt += (+r.marketing || 0);
    monthlyData[m].win += (+r.win || 0);
    monthlyData[m].bet += (+r.bet || 0);
    
    const daysActive = (+r.days_active || 0);
    if (r.serial_nr && daysActive >= 3) {
      monthlyData[m].serials.add(r.serial_nr);
      monthlyData[m].locs[loc].serials.add(r.serial_nr);
    }
    
    monthlyData[m].locs[loc].in += (+r.in_val || 0);
    monthlyData[m].locs[loc].out += (+r.out_val || 0);
    monthlyData[m].locs[loc].ggr += (+r.ggr || 0);
    monthlyData[m].locs[loc].ngr += (+r.ngr || 0);
    monthlyData[m].locs[loc].mkt += (+r.marketing || 0);
    monthlyData[m].locs[loc].win += (+r.win || 0);
    monthlyData[m].locs[loc].bet += (+r.bet || 0);
  });

  const dataTotal = [];
  const sortedMonths = Object.keys(monthlyData).sort((a,b) => b.localeCompare(a));
  
  sortedMonths.forEach(m => {
    const sortedLocs = Object.keys(monthlyData[m].locs).sort();
    dataTotal.push({
      'Lună / Locație': `${m} (TOTAL)`,
      'Aparate': monthlyData[m].serials.size,
      'IN': monthlyData[m].in,
      'IN Mediu': monthlyData[m].serials.size > 0 ? (monthlyData[m].in / monthlyData[m].serials.size) : 0,
      'OUT': monthlyData[m].out,
      'GGR': monthlyData[m].ggr,
      'GGR Mediu': monthlyData[m].serials.size > 0 ? (monthlyData[m].ggr / monthlyData[m].serials.size) : 0,
      'NGR': monthlyData[m].ngr,
      'MKT Cost': monthlyData[m].mkt,
      'WIN/BET %': monthlyData[m].bet > 0 ? (monthlyData[m].win / monthlyData[m].bet * 100).toFixed(2) + '%' : '0.00%',
      'WIN/BET NGR %': monthlyData[m].bet > 0 ? ((monthlyData[m].win - monthlyData[m].mkt) / monthlyData[m].bet * 100).toFixed(2) + '%' : '0.00%'
    });
    
    sortedLocs.forEach(loc => {
      const ld = monthlyData[m].locs[loc];
      if (!ld) return;
      if (ld.in === 0 && ld.out === 0 && ld.ggr === 0 && ld.mkt === 0 && (!ld.serials || ld.serials.size === 0)) return;

      dataTotal.push({
        'Lună / Locație': `  ${loc}`,
        'Aparate': ld.serials ? ld.serials.size : 0,
        'IN': ld.in,
        'IN Mediu': (ld.serials && ld.serials.size > 0) ? (ld.in / ld.serials.size) : 0,
        'OUT': ld.out,
        'GGR': ld.ggr,
        'GGR Mediu': (ld.serials && ld.serials.size > 0) ? (ld.ggr / ld.serials.size) : 0,
        'NGR': ld.ngr,
        'MKT Cost': ld.mkt,
        'WIN/BET %': ld.bet > 0 ? (ld.win / ld.bet * 100).toFixed(2) + '%' : '0.00%',
        'WIN/BET NGR %': ld.bet > 0 ? ((ld.win - ld.mkt) / ld.bet * 100).toFixed(2) + '%' : '0.00%'
      });
    });
  });

  let html = `<table style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px;">`;
  html += `<thead><tr>`;
  const headers = Object.keys(dataTotal[0]);
  headers.forEach(h => {
     html += `<th style="background-color: #F8FAFC; color: #1E293B; font-weight: bold; border: 1px solid #E2E8F0; padding: 4px;">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;
  
  const roFormat = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const roFormatInt = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  
  dataTotal.forEach(row => {
     const isTotal = row['Lună / Locație'].includes('(TOTAL)');
     const bg = isTotal ? '#F1F5F9' : '#FFFFFF';
     const fw = isTotal ? 'bold' : 'normal';
     html += `<tr style="background-color: ${bg}; font-weight: ${fw};">`;
     headers.forEach(h => {
       let val = row[h];
       let v = parseFloat(val);
       let color = '#000000';
       if (!isNaN(v) && (h.includes('GGR') || h.includes('NGR') || h.includes('WIN'))) {
         if (v > 0) color = '#059669'; // green
         else if (v < 0) color = '#DC2626'; // red
       }
       
       let text = val;
       if (typeof val === 'number') {
         if (h === 'Aparate') text = roFormatInt.format(val);
         else text = roFormat.format(val);
       }
       
       html += `<td style="border: 1px solid #E2E8F0; padding: 4px; color: ${color}; text-align: ${typeof val === 'number' || val.toString().includes('%') ? 'right' : 'left'}">${text}</td>`;
     });
     html += `</tr>`;
  });
  html += `</tbody></table>`;
  
  let textStr = headers.join('\t') + '\n' + dataTotal.map(r => headers.map(h => {
       let val = r[h];
       if (typeof val === 'number' && h !== 'Aparate') return roFormat.format(val).replace(/\./g, '');
       return val;
  }).join('\t')).join('\n');
  
  let clipboardApiSupported = !!(navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined');

  if (clipboardApiSupported) {
    try {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([textStr], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
      
      navigator.clipboard.write(data).then(() => {
        showToast('Tabelul a fost copiat în memorie (cu formatare)! Poți da Paste direct în Google Sheets.', 'success');
        showSuccessState();
      }).catch(err => {
        console.error('Clipboard API a eșuat...', err);
        showToast('Eroare la copiere. Încearcă direct din Excel.', 'error');
      });
      return;
    } catch (err) {
      console.error('ClipboardItem error, falling back to execCommand...', err);
      clipboardApiSupported = false;
    }
  }
  
  if (!clipboardApiSupported) {
    // Fallback (pentru browsere mai vechi sau HTTP/Localhost) - Sincron!
    try {
      const div = document.createElement('div');
      div.innerHTML = html;
      div.style.position = 'fixed';
      div.style.pointerEvents = 'none';
      div.style.opacity = 0;
      div.style.left = '-9999px';
      document.body.appendChild(div);
      
      const sel = window.getSelection();
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNode(div);
      sel.addRange(range);
      
      const ok = document.execCommand('copy');
      sel.removeAllRanges();
      document.body.removeChild(div);
      
      if (ok) {
         showToast('Tabelul a fost copiat în memorie (cu formatare)! Poți da Paste.', 'success');
         showSuccessState();
      } else {
         showToast('Browserul a blocat copierea.', 'error');
      }
    } catch(e) {
      showToast('Eroare la copiere (drepturi insuficiente).', 'error');
    }
  }
}

window.updateLocSelectText = function() {
  const cbs = document.querySelectorAll('.lunare-loc-cb:checked');
  const span = document.getElementById('loc-select-text');
  if (!span) return;
  if (cbs.length === 0) span.innerText = 'Toate locațiile';
  else if (cbs.length === 1) span.innerText = '1 locație selectată';
  else span.innerText = `${cbs.length} locații selectate`;
};

window.updateExpLocSelectText = function() {
  const cbs = document.querySelectorAll('.exp-loc-cb:checked');
  const span = document.getElementById('exp-loc-select-text');
  if (!span) return;
  if (cbs.length === 0) span.innerText = 'Toate locațiile';
  else if (cbs.length === 1) span.innerText = '1 locație selectată';
  else span.innerText = `${cbs.length} locații selectate`;
  applyExpFilters();
};

document.addEventListener('click', (e) => {
  const trigger = document.getElementById('loc-select-trigger');
  const dd = document.getElementById('loc-dropdown');
  if (trigger && dd) {
    if (!trigger.contains(e.target) && !dd.contains(e.target)) {
      dd.style.display = 'none';
    }
  }

  const expTrigger = document.getElementById('exp-loc-select-trigger');
  const expDd = document.getElementById('exp-loc-dropdown');
  if (expTrigger && expDd) {
    if (!expTrigger.contains(e.target) && !expDd.contains(e.target)) {
      expDd.style.display = 'none';
    }
  }
});


// --- CONTRACTS MODULE ---
let _contractsData = [];

window.loadContracts = async function() {
  if (typeof showLoader === 'function') showLoader(true);
  try {
    const res = await api('/api/contracts');
    _contractsData = res || [];
    populateContractFilters();
    renderContractsTable();
  } catch (e) {
    if (typeof showAlert === 'function') showAlert('Eroare încărcare contracte: ' + e);
  } finally {
    if (typeof showLoader === 'function') showLoader(false);
  }
}

let _contractsSortCol = null;
let _contractsSortAsc = true;

window.sortContractsTable = function(col) {
  if (_contractsSortCol === col) {
    _contractsSortAsc = !_contractsSortAsc;
  } else {
    _contractsSortCol = col;
    _contractsSortAsc = true;
  }
  
  // Update header arrows
  ['tip', 'locatie', 'detalii', 'valabilitate', 'valoare'].forEach(c => {
    const el = document.getElementById('sort-contracts-' + c);
    if (el) el.innerText = (c === _contractsSortCol) ? (_contractsSortAsc ? ' ↑' : ' ↓') : '';
  });
  
  renderContractsTable();
};

window.renderContractsTable = function() {
  const tb = document.getElementById('contracts-tbody');
  if (!tb) return;
  
  const filterLoc = document.getElementById('filter-contract-location').value;
  const filterType = document.getElementById('filter-contract-type').value;

  let filteredContracts = _contractsData;
  if (filterLoc) {
    filteredContracts = filteredContracts.filter(c => (c.locations || []).some(l => String(l.location_id) === String(filterLoc)));
  }
  if (filterType) {
    filteredContracts = filteredContracts.filter(c => c.type === filterType);
  }

  if (_contractsSortCol) {
    filteredContracts.sort((a, b) => {
      let va = a[_contractsSortCol];
      let vb = b[_contractsSortCol];
      
      if (_contractsSortCol === 'tip') {
        va = (a.type || '') + (a.owner_name || '');
        vb = (b.type || '') + (b.owner_name || '');
      } else if (_contractsSortCol === 'locatie') {
        va = (a.locations && a.locations[0]) ? ((typeof filtersData !== 'undefined' && filtersData.locations) || []).find(x => x.id === a.locations[0].location_id)?.name || '' : '';
        vb = (b.locations && b.locations[0]) ? ((typeof filtersData !== 'undefined' && filtersData.locations) || []).find(x => x.id === b.locations[0].location_id)?.name || '' : '';
      } else if (_contractsSortCol === 'detalii') {
        va = a.contract_number || ''; 
        vb = b.contract_number || '';
      } else if (_contractsSortCol === 'valabilitate') {
        va = a.end_date || '9999-12-31'; 
        vb = b.end_date || '9999-12-31';
      } else if (_contractsSortCol === 'valoare') {
        va = parseFloat(a.total_amount) || 0; 
        vb = parseFloat(b.total_amount) || 0;
      }

      if (va < vb) return _contractsSortAsc ? -1 : 1;
      if (va > vb) return _contractsSortAsc ? 1 : -1;
      return 0;
    });
  }

  let totalEur = 0;
  let totalRon = 0;
  let totalM2 = 0;
  
  if (filteredContracts.length === 0) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Niciun contract găsit</td></tr>';
    document.getElementById('kpi-contract-count').innerText = '0';
    document.getElementById('kpi-contract-lei').innerText = '0 RON';
    document.getElementById('kpi-contract-eur').innerText = '0 €';
    const countEl = document.getElementById('contracts-record-count');
    if (countEl) countEl.innerText = 'Total înregistrări: 0';
    return;
  }
  
  tableStates.contracts.rows = filteredContracts.map((c, idx) => {
    if (c.currency === 'RON' || c.currency === 'LEI') totalRon += parseFloat(c.total_amount) || 0;
    else if (c.currency === 'EUR') totalEur += parseFloat(c.total_amount) || 0;

    totalM2 += parseFloat(c.m2) || 0;

    // Format locations summary
    const locNames = (c.locations || []).map(l => {
      const locObj = ((typeof filtersData !== 'undefined' && filtersData.locations) || []).find(x => x.id === l.location_id);
      const name = locObj ? locObj.name : 'Loc necunoscut';
      const addr = c.address ? c.address : (locObj && locObj.address ? locObj.address : null);
      let html = (c.locations.length > 1) ? `<strong>${name}</strong> (${fmt(l.amount)})` : `<strong>${name}</strong>`;
      if (addr) html += `<br><span style="font-size:11px; color:var(--text)">${addr}</span>`;
      return html;
    });
    const locSummary = locNames.length > 0 ? locNames.join('<br><br>') : '<span style="color:var(--text-muted)">Neasignat</span>';
    
    // Remaining time logic
    let remainingStr = '-';
    if (c.end_date) {
      const end = new Date(c.end_date);
      const now = new Date();
      if (end > now) {
        const diffTime = Math.abs(end - now);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 60) {
          remainingStr = `${Math.floor(diffDays / 30)} luni rămase`;
        } else {
          remainingStr = `${diffDays} zile rămase`;
        }
      } else {
        remainingStr = `<span style="color:var(--red); font-weight:bold;">Expirat</span>`;
      }
    }
    
    let typeHtml = `<strong>${c.type || '-'}</strong>`;
    if (c.owner_name) typeHtml += `<br><span style="font-size:11px; color:var(--muted)">${c.owner_name}</span>`;

    let locHtml = locSummary;
    let detaliiContractHtml = '';
    if (c.contract_number) detaliiContractHtml += `<span style="font-size:11px; font-weight:600; color:var(--text)">Nr. ${c.contract_number}</span>`;
    if (c.m2) detaliiContractHtml += `${c.contract_number ? '<br>' : ''}<span style="font-size:11px; color:var(--muted)">${c.m2} m²</span>`;
    if (!detaliiContractHtml) detaliiContractHtml = '-';

    let valabilHtml = `<span style="font-size:0.9em;">De la: ${c.start_date || '-'} <br> Până la: ${c.end_date || '-'}</span>`;

    let statusHtml = '';
    if (remainingStr !== '-') statusHtml += `<strong style="color:var(--accent); font-size:11px;">⏱ ${remainingStr}</strong>`;
    if (c.notice_period_months && c.notice_period_months > 0) statusHtml += `<br><span style="font-size:11px; color:var(--muted)">Preaviz: ${c.notice_period_months} luni</span>`;

    const mainFiles = (c.files || []).filter(f => !f.is_annex);
    const annexFiles = (c.files || []).filter(f => f.is_annex);
    
    html += `
      <tr>
        <td style="width:40px; text-align:center; position:sticky; left:0; z-index:1; background:var(--surface); border-right:1px solid var(--border);"><input type="checkbox" class="contract-chk" value="${c.id}" onchange="checkBulkDeleteBtn()"></td>
        <td style="color:var(--text-muted);width:40px;">${idx + 1}</td>
        <td>${typeHtml}</td>
        <td>${locHtml}</td>
        <td>${detaliiContractHtml}</td>
        <td>${valabilHtml}</td>
        <td>${statusHtml}</td>
        <td class="num" style="font-weight:700">
          ${fmt(c.total_amount)} ${c.currency === 'EUR' ? '€' : c.currency}
          ${c.currency === 'EUR' ? `<br><span style="font-size:10px; color:var(--muted); font-weight:normal;">(${fmt(c.total_amount * EUR_RATE)} RON)</span>` : ''}
        </td>
        <td style="text-align:center;">
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            ${(c.files && c.files.length > 0) ? `
            <button onclick="viewContractPdfs('${c.id}')" style="width:32px; height:32px; border-radius:50%; background:var(--red); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; color:white; transition:0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" title="Vezi PDF-uri (${c.files.length})">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </button>` : ''}
            <button onclick="openContractFilesModal('${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--accent); transition:0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'" title="Gestionează Fișiere">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            </button>
            <button onclick="openContractModal('${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); transition:0.2s;" onmouseover="this.style.borderColor='var(--text)'" onmouseout="this.style.borderColor='var(--border)'" title="Modifică">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button onclick="deleteContract('${c.id}')" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Șterge">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  
  document.getElementById('kpi-contract-count').innerText = filteredContracts.length;
  document.getElementById('kpi-contract-lei').innerText = fmt(totalRon) + ' RON';
  document.getElementById('kpi-contract-eur').innerHTML = `${fmt(totalEur)} €<br><span style="font-size:12px; color:var(--muted); font-weight:normal;">(${fmt(totalEur * EUR_RATE)} RON)</span><br><span style="font-size:10px; color:var(--muted); font-weight:normal;">Curs BNR: ${EUR_RATE.toFixed(4)}</span>`;
  
  tb.innerHTML = html;
  
  // Render footer
  const tfootHtml = `
    <tr>
      <td colspan="4" style="text-align:right; font-weight:700;">TOTAL:</td>
      <td style="font-weight:700; color:var(--text);">${fmt(totalM2)} m²</td>
      <td colspan="2"></td>
      <td class="num" style="font-weight:700; color:var(--text);">
        <span style="color:var(--muted); font-size:10px;">LEI:</span> ${fmt(totalRon)} RON<br>
        <span style="color:var(--muted); font-size:10px;">EUR:</span> ${fmt(totalEur)} €<br>
        <span style="color:var(--muted); font-size:10px; font-weight:normal;">(${fmt(totalEur * EUR_RATE)} RON)</span>
      </td>
      <td></td>
    </tr>
  `;
  const tfootEl = document.getElementById('contracts-tfoot');
  if (tfootEl) tfootEl.innerHTML = tfootHtml;

  const countEl = document.getElementById('contracts-record-count');
  if (countEl) countEl.innerText = `Total înregistrări: ${filteredContracts.length}`;
}

window.populateContractFilters = function() {
  const locSel = document.getElementById('filter-contract-location');
  const typeSel = document.getElementById('filter-contract-type');
  if (!locSel || !typeSel) return;
  
  // preserve selections
  const curLoc = locSel.value;
  const curType = typeSel.value;
  
  locSel.innerHTML = '<option value="">Toate Locațiile</option>';
  typeSel.innerHTML = '<option value="">Toate Tipurile</option>';
  
  if (typeof filtersData !== 'undefined' && filtersData.locations) {
    filtersData.locations.forEach(l => {
      locSel.innerHTML += `<option value="${l.id}">${l.name}</option>`;
    });
  }
  
  const uniqueTypes = [...new Set(_contractsData.map(c => c.type).filter(Boolean))];
  uniqueTypes.forEach(t => {
    typeSel.innerHTML += `<option value="${t}">${t}</option>`;
  });
  
  locSel.value = curLoc;
  typeSel.value = curType;
};

window.toggleAllContracts = function(cb) {
  const chks = document.querySelectorAll('.contract-chk');
  chks.forEach(c => c.checked = cb.checked);
  window.checkBulkDeleteBtn();
};

window.checkBulkDeleteBtn = function() {
  const chks = document.querySelectorAll('.contract-chk:checked');
  const btn = document.getElementById('btn-bulk-delete');
  if (btn) btn.style.display = chks.length > 0 ? 'inline-block' : 'none';
};

window.bulkDeleteContracts = async function() {
  const chks = document.querySelectorAll('.contract-chk:checked');
  if (!chks.length) return;
  const ok = await customConfirm(`Sigur ștergi ${chks.length} contracte selectate?`);
  if (!ok) return;
  
  for (const c of chks) {
    try {
      await api(`/api/contracts/${c.value}`, 'DELETE');
    } catch(e) { console.error(e); }
  }
  
  const sa = document.getElementById('contract-select-all');
  if (sa) sa.checked = false;
  window.checkBulkDeleteBtn();
  loadContracts();
};

window.exportContractsExcel = function() {
  const data = [['Nr', 'Tip Contract', 'Furnizor/Client', 'Locatii', 'Adresa', 'Valoare', 'Moneda', 'Start', 'End', 'Detalii']];
  
  _contractsData.forEach((c, idx) => {
    let locs = (c.locations || []).map(l => {
      let lo = ((typeof filtersData !== 'undefined' && filtersData.locations) || []).find(x => x.id === l.location_id);
      return lo ? lo.name : 'Neasignat';
    }).join('; ');
    
    data.push([
      idx + 1,
      c.type || '',
      c.owner_name || '',
      locs,
      c.address || '',
      c.total_amount || 0,
      c.currency || 'LEI',
      c.start_date || '',
      c.end_date || '',
      c.details || ''
    ]);
  });
  
  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contracte");
    XLSX.writeFile(wb, `Contracte_${new Date().toISOString().split('T')[0]}.xlsx`);
  } else {
    alert("Librăria pentru Excel nu s-a încărcat!");
  }
};

window.openContractModal = function(id = null) {
  try {
    if (id && typeof id === 'object') id = null; // Ignore Event objects
    
    const modal = document.getElementById('contract-modal');
    if (!modal) {
      alert('Eroare: modalul contract-modal nu a fost găsit în pagină.');
      return;
    }
    
    const form = document.getElementById('contract-form');
    if (form) form.reset();
    else alert('Eroare: contract-form nu a fost găsit.');
    
    const idField = document.getElementById('contract-id');
    if (idField) idField.value = id || '';
  
  const fileInput = document.getElementById('contract-upload-file');
  if (fileInput) fileInput.value = '';
  const fileSpan = document.getElementById('contract-upload-filename');
  if (fileSpan) fileSpan.innerText = '';
  
  // Build location select options
  const locSelect = document.getElementById('contract-location');
  let locHtml = '<option value="">-- Fără locație specifică --</option>';
  ((typeof filtersData !== 'undefined' && filtersData.locations) || []).forEach(loc => {
    locHtml += `<option value="${loc.id}">${loc.name}</option>`;
  });
  locSelect.innerHTML = locHtml;
  
  if (id) {
    document.getElementById('contract-modal-title').innerText = 'Modifică Contract';
    const c = _contractsData.find(x => x.id === id);
    if (c) {
      document.getElementById('contract-type').value = c.type || '';
      if (document.getElementById('contract-number')) {
        document.getElementById('contract-number').value = c.contract_number || '';
      }
      if (document.getElementById('contract-address')) {
        document.getElementById('contract-address').value = c.address || '';
      }
      document.getElementById('contract-currency').value = c.currency || 'LEI';
      if (document.getElementById('contract-currency-label')) {
        document.getElementById('contract-currency-label').innerText = c.currency || 'LEI';
      }
      document.getElementById('contract-start').value = c.start_date || '';
      document.getElementById('contract-end').value = c.end_date || '';
      document.getElementById('contract-details').value = c.details || '';
      document.getElementById('contract-total').value = window.formatNumberValue(c.total_amount || 0);
      if (document.getElementById('contract-m2')) {
        document.getElementById('contract-m2').value = c.m2 || '';
      }
      if (document.getElementById('contract-notice')) {
        document.getElementById('contract-notice').value = c.notice_period_months || '';
      }
      if (document.getElementById('contract-sublease')) {
        document.getElementById('contract-sublease').value = (c.sublease_agreement === true) ? 'true' : (c.sublease_agreement === false ? 'false' : '');
      }
      if (document.getElementById('contract-auto-expense')) {
        document.getElementById('contract-auto-expense').checked = c.auto_expense === true;
      }
      if (document.getElementById('contract-owner')) {
        document.getElementById('contract-owner').value = c.owner_name || '';
      }
      
      if (c.locations && c.locations.length > 0) {
        locSelect.value = c.locations[0].location_id;
      }
    }
  } else {
    document.getElementById('contract-modal-title').innerText = 'Adaugă Contract';
    if (document.getElementById('contract-currency-label')) {
      document.getElementById('contract-currency-label').innerText = 'LEI';
    }
  }
  
  modal.classList.add('show');
  } catch (e) {
    alert('Eroare JS în openContractModal: ' + e.message);
  }
}

window.saveContract = async function() {
  const id = document.getElementById('contract-id').value;
  const payload = {
    type: document.getElementById('contract-type').value,
    currency: document.getElementById('contract-currency').value,
    start_date: document.getElementById('contract-start').value,
    end_date: document.getElementById('contract-end').value,
    details: document.getElementById('contract-details').value,
    contract_number: document.getElementById('contract-number') ? document.getElementById('contract-number').value : null,
    address: document.getElementById('contract-address') ? document.getElementById('contract-address').value : null,
    total_amount: window.parseNumberInput(document.getElementById('contract-total').value),
    m2: document.getElementById('contract-m2') ? document.getElementById('contract-m2').value : null,
    notice_period_months: document.getElementById('contract-notice') ? document.getElementById('contract-notice').value : null,
    sublease_agreement: document.getElementById('contract-sublease') ? document.getElementById('contract-sublease').value : null,
    auto_expense: document.getElementById('contract-auto-expense') ? document.getElementById('contract-auto-expense').checked : false,
    owner_name: document.getElementById('contract-owner') ? document.getElementById('contract-owner').value : null,
    locations: []
  };
  
  const locVal = document.getElementById('contract-location').value;
  if (locVal) {
    payload.locations.push({
      location_id: locVal,
      amount: parseFloat(payload.total_amount) || 0
    });
  }
  
  try {
    const url = id ? '/api/contracts/' + id : '/api/contracts';
    const method = id ? 'PUT' : 'POST';
    const res = await api(url, { 
      method, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload) 
    });
    if (res.success) {
      const finalId = id || res.id;
      
      // Handle file upload if selected
      const fileInput = document.getElementById('contract-upload-file');
      if (fileInput && fileInput.files.length > 0 && finalId) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('is_annex', 'false');
        
        try {
          const fRes = await fetch(`/api/contracts/${finalId}/files`, {
            method: 'POST',
            body: formData
          });
          const fData = await fRes.json();
          if (!fData.success) {
            showAlert('Contractul a fost salvat, dar fișierul nu a putut fi încărcat: ' + (fData.error || 'Necunoscut'));
          }
        } catch (e) {
          showAlert('Eroare rețea la încărcare fișier: ' + e);
        }
      }
      
      document.getElementById('contract-modal').classList.remove('show');
      loadContracts();
    } else {
      showAlert('Eroare salvare: ' + (res.error || 'Necunoscută'));
    }
  } catch (e) {
    showAlert('Eroare rețea: ' + e);
  }
}

window.deleteContract = async function(id) {
  const ok = await customConfirm('Sigur dorești să ștergi acest contract?');
  if (!ok) return;
  try {
    const res = await api('/api/contracts/' + id, { method: 'DELETE' });
    if (res.success) {
      loadContracts();
    } else {
      showAlert('Eroare ștergere: ' + (res.error || 'Necunoscută'));
    }
  } catch (e) {
    showAlert('Eroare rețea: ' + e);
  }
}

// === FILES MANAGEMENT ===

let _currentContractFilesId = null;

window.openContractFilesModal = function(id) {
  _currentContractFilesId = id;
  const modal = document.getElementById('contract-files-modal');
  if (!modal) return;
  
  renderContractFilesList();
  modal.classList.add('show');
}

window.renderContractFilesList = function() {
  const list = document.getElementById('contract-files-list');
  if (!list) return;
  
  const c = _contractsData.find(x => x.id === _currentContractFilesId);
  if (!c || !c.files || c.files.length === 0) {
    list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted)">Niciun fișier atașat</div>';
    return;
  }
  
  let html = '';
  const sortedFiles = [...c.files].sort((a, b) => (a.is_annex === b.is_annex ? 0 : a.is_annex ? 1 : -1));
  sortedFiles.forEach(f => {
    const badge = f.is_annex ? '<span style="background:var(--surface); padding:2px 6px; border-radius:4px; font-size:0.8em; margin-right:10px;">Anexă</span>' : '<span style="background:var(--accent); color:white; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-right:10px;">Contract</span>';
    
    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; border-bottom:1px solid var(--border); gap:12px;">
        <div style="display:flex; align-items:center; flex:1; min-width:0;">
          ${badge}
          <a href="/api/contracts/files/${f.id}/download" target="_blank" style="color:var(--text); text-decoration:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; font-size:13px;" title="${f.filename}">${(f.filename)}</a>
        </div>
        <button onclick="deleteContractFile('${f.id}')" style="background:var(--surface); border:1px solid var(--border); border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--red); transition:0.2s; flex-shrink:0;" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'" title="Șterge fișier">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;
  });
  list.innerHTML = html;
}

window.uploadContractFile = async function() {
  if (!_currentContractFilesId) return;
  
  const fileInput = document.getElementById('contract-file-input');
  if (!fileInput.files || fileInput.files.length === 0) {
    showAlert('Selectează un fișier mai întâi.');
    return;
  }
  
  const isAnnex = document.getElementById('contract-file-is-annex').checked;
  
  let hasError = false;
  let lastError = '';
  
  fileInput.disabled = true;
  
  for (let i = 0; i < fileInput.files.length; i++) {
    const formData = new FormData();
    formData.append('file', fileInput.files[i]);
    formData.append('is_annex', isAnnex);
    
    try {
      const res = await fetch('/api/contracts/' + _currentContractFilesId + '/files', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) {
        hasError = true;
        lastError = data.error || 'Necunoscută';
      }
    } catch (e) {
      hasError = true;
      lastError = e.message;
    }
  }
  
  fileInput.disabled = false;
  fileInput.value = '';
  
  if (hasError) {
    showAlert('Eroare la încărcarea unuia sau mai multor fișiere: ' + lastError);
  }
  
  await loadContracts();
  renderContractFilesList();
}

window.deleteContractFile = async function(fileId) {
  const ok = await customConfirm('Sigur dorești să ștergi acest fișier?');
  if (!ok) return;
  try {
    const res = await api('/api/contracts/files/' + fileId, { method: 'DELETE' });
    if (res.success) {
      await loadContracts();
      renderContractFilesList();
    } else {
      showAlert('Eroare ștergere fișier: ' + (res.error || 'Necunoscută'));
    }
  } catch (e) {
    showAlert('Eroare rețea: ' + e);
  }
}

// === PDF IN-APP VIEWER ===
let _currentPdfFiles = [];
let _currentPdfIndex = 0;

window.viewContractPdfs = function(contractId) {
  const c = _contractsData.find(x => x.id === contractId);
  if (!c || !c.files || c.files.length === 0) return;
  
  _currentPdfFiles = [...c.files].sort((a, b) => (a.is_annex === b.is_annex ? 0 : a.is_annex ? 1 : -1));
  _currentPdfIndex = 0;
  
  updatePdfViewer();
  const modal = document.getElementById('pdf-viewer-modal');
  if (modal) modal.classList.add('show');
}

window.changePdf = function(dir) {
  _currentPdfIndex += dir;
  if (_currentPdfIndex < 0) _currentPdfIndex = 0;
  if (_currentPdfIndex >= _currentPdfFiles.length) _currentPdfIndex = _currentPdfFiles.length - 1;
  updatePdfViewer();
}

window.updatePdfViewer = function() {
  const f = _currentPdfFiles[_currentPdfIndex];
  if (!f) return;
  
  const titleEl = document.getElementById('pdf-viewer-title');
  if (titleEl) titleEl.innerText = f.filename || 'Document PDF';
  
  const iframe = document.getElementById('pdf-iframe');
  if (iframe) iframe.src = '/api/contracts/files/' + f.id + '/download';
  
  const counter = document.getElementById('pdf-counter');
  const btnPrev = document.getElementById('pdf-prev-btn');
  const btnNext = document.getElementById('pdf-next-btn');
  
  if (_currentPdfFiles.length > 1) {
    if (counter) {
      counter.style.display = 'inline-block';
      counter.innerText = `${_currentPdfIndex + 1} / ${_currentPdfFiles.length}`;
    }
    if (btnPrev) {
      btnPrev.style.display = 'inline-block';
      btnPrev.disabled = (_currentPdfIndex === 0);
      btnPrev.style.opacity = btnPrev.disabled ? '0.3' : '1';
      btnPrev.style.cursor = btnPrev.disabled ? 'default' : 'pointer';
    }
    if (btnNext) {
      btnNext.style.display = 'inline-block';
      btnNext.disabled = (_currentPdfIndex === _currentPdfFiles.length - 1);
      btnNext.style.opacity = btnNext.disabled ? '0.3' : '1';
      btnNext.style.cursor = btnNext.disabled ? 'default' : 'pointer';
    }
  } else {
    if (counter) counter.style.display = 'none';
    if (btnPrev) btnPrev.style.display = 'none';
    if (btnNext) btnNext.style.display = 'none';
  }
}

window.deleteCurrentPdf = async function() {
  const f = _currentPdfFiles[_currentPdfIndex];
  if (!f) return;
  
  const ok = await customConfirm('Sigur dorești să ștergi acest PDF?');
  if (!ok) return;
  
  try {
    const res = await api('/api/contracts/files/' + f.id, { method: 'DELETE' });
    if (res.success) {
      await loadContracts(); // update _contractsData in background
      _currentPdfFiles.splice(_currentPdfIndex, 1);
      
      if (_currentPdfFiles.length === 0) {
        document.getElementById('pdf-viewer-modal').classList.remove('show');
      } else {
        if (_currentPdfIndex >= _currentPdfFiles.length) {
          _currentPdfIndex = _currentPdfFiles.length - 1;
        }
        updatePdfViewer();
      }
      
      // Update the other modal if it happens to be open
      if (document.getElementById('contract-files-modal').classList.contains('show')) {
        renderContractFilesList();
      }
    } else {
      showAlert('Eroare ștergere PDF: ' + (res.error || 'Necunoscută'));
    }
  } catch (e) {
    showAlert('Eroare rețea: ' + e);
  }
}

window.openSmartImportModal = function() {
  const locSelect = document.getElementById('smart-import-location');
  if (locSelect && typeof filtersData !== 'undefined' && filtersData.locations) {
    locSelect.innerHTML = '<option value="">-- Selectează Locația --</option>';
    filtersData.locations.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.text = l.name;
      locSelect.appendChild(opt);
    });
  }
  document.getElementById('smart-import-files').value = '';
  document.getElementById('smart-import-file-label').innerText = 'Click sau trage fișierele aici (maxim 20)';
  document.getElementById('smart-import-progress-container').style.display = 'none';
  document.getElementById('smart-import-submit-btn').disabled = false;
  document.getElementById('smart-import-modal').classList.add('show');
};

window.updateSmartImportFileCount = function(input) {
  const label = document.getElementById('smart-import-file-label');
  if (input.files && input.files.length > 0) {
    label.innerText = `${input.files.length} fișiere selectate`;
    label.style.color = 'var(--accent)';
  } else {
    label.innerText = 'Click sau trage fișierele aici (maxim 20)';
    label.style.color = 'var(--text)';
  }
};

window.uploadSmartContracts = async function() {
  const locId = document.getElementById('smart-import-location').value;
  if (!locId) {
    if (typeof showAlert === 'function') showAlert('Te rog să selectezi o locație.');
    else alert('Te rog să selectezi o locație.');
    return;
  }
  
  const filesInput = document.getElementById('smart-import-files');
  if (!filesInput.files || filesInput.files.length === 0) {
    if (typeof showAlert === 'function') showAlert('Selectează cel puțin un fișier PDF.');
    else alert('Selectează cel puțin un fișier PDF.');
    return;
  }
  
  const files = Array.from(filesInput.files);
  const total = files.length;
  
  document.getElementById('smart-import-submit-btn').disabled = true;
  document.getElementById('smart-import-progress-container').style.display = 'block';
  
  let successCount = 0;
  
  for (let i = 0; i < total; i++) {
    const file = files[i];
    document.getElementById('smart-import-status-text').innerText = `Analizăm: ${file.name}...`;
    document.getElementById('smart-import-counter').innerText = `${i+1}/${total}`;
    document.getElementById('smart-import-progress-bar').style.width = `${((i)/total)*100}%`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('location_id', locId);
    
    try {
      const res = await fetch(`${API_BASE}/api/contracts/smart-import`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: formData
      });
      if (res.ok) {
        successCount++;
      } else {
        const err = await res.json();
        console.error('Smart Import Error:', err);
      }
    } catch (e) {
      console.error(e);
    }
  }
  
  document.getElementById('smart-import-progress-bar').style.width = `100%`;
  document.getElementById('smart-import-status-text').innerText = `Finalizat! Extrase cu succes: ${successCount} din ${total}`;
  
  setTimeout(() => {
    document.getElementById('smart-import-modal').classList.remove('show');
    loadContractsData(); // Refresh table
  }, 2000);
};
