
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

function gameThumbUrl(name, id) {
  if (id && String(id).length > 20) {
    // Standard UUID based image path from CDN
    return `https://cdn.cashpot.ro/cashpot/t1/thumbnail_games/${id}.png`;
  }
  
  // Try to lookup UUID by name
  if (name && typeof GAME_UUIDS !== 'undefined') {
    if (GAME_UUIDS[name]) return `https://cdn.cashpot.ro/cashpot/t1/thumbnail_games/${GAME_UUIDS[name]}.png`;
    
    // Fallback: the database sometimes returns duplicated/corrupted names like "20 Super Hot20 Super Hot" or "100 Burning Ho100 Burning Hot".
    // Find the longest official game name that is contained within the corrupted text.
    let longestMatch = null;
    for (let key in GAME_UUIDS) {
      if (name.includes(key) || key.includes(name)) {
        if (!longestMatch || key.length > longestMatch.length) longestMatch = key;
      }
    }
    if (longestMatch && GAME_UUIDS[longestMatch]) {
      return `https://cdn.cashpot.ro/cashpot/t1/thumbnail_games/${GAME_UUIDS[longestMatch]}.png`;
    }
  }

  if (!name) return 'https://cdn.cashpot.ro/cashpot/t1/thumbnail_games/placeholder.png';
  
  let slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://cdn.cashpot.ro/cashpot/t1/thumbnail_games/${slug}.png`;
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
              onerror="this.src='https://cdn.cashpot.ro/cashpot/t1/thumbnail_games/placeholder.png'; this.style.opacity='0.3'">
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
function showLoader(v){document.getElementById('loader').classList.toggle('show',v);}
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

  if (hash.startsWith('#rapoarte/ore')) { loadKPI(s,e); loadHourlyReport(); }
  else if (hash.startsWith('#rapoarte/hh')) { loadKPI(s,e); loadHhReport(); }
  else if (hash.startsWith('#rapoarte/marketing')) { loadKPI(s,e); loadMarketingReport(); }
  else if (hash.startsWith('#rapoarte/clienti')) { loadKPI(s,e); loadClientiReport(); }
  else if (hash.startsWith('#rapoarte/cashout')) { loadKPI(s,e); loadRapoarteCashout(); }
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
  else if (hash.startsWith('#admin/sloturi')) loadAdminSloturi();
  else if (hash.startsWith('#live')) { /* live se gestioneaza prin hashchange */ }
  else loadAll();
};
async function api(path) {
  const r = await fetch(API + path);
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
  provideri: { page: 1, limit: 'all', rows: [] },
  tipuri: { page: 1, limit: dLimit, rows: [] },
  cabinete: { page: 1, limit: dLimit, rows: [] },
  aparate: { page: 1, limit: dLimit, rows: [] },
  clienti: { page: 1, limit: dLimit, rows: [] },
  'rep-hourly': { page: 1, limit: dLimit, rows: [] },
  'rep-clienti': { page: 1, limit: dLimit, rows: [] },
  'hh-players': { page: 1, limit: dLimit, rows: [] }
};

function renderTablePaginated(key) {
  const st = tableStates[key];
  if(!st) return;
  const tbody = document.getElementById('body-' + key);
  const pgWrap = document.getElementById('pg-' + key);
  
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
  
  let rowsToRender = st.rows;
  if (st.sortCol !== undefined) {
    if (!st.parsedRows) {
      st.parsedRows = st.rows.map(html => {
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
    if(rowsToRender.length <= 10 && st.limit === 'all') {
      pgWrap.style.display = 'none';
      return;
    }
    pgWrap.style.display = 'flex';
    const totalPages = st.limit === 'all' ? 1 : Math.ceil(st.rows.length / st.limit);
    const startNum = st.limit === 'all' ? 1 : ((st.page-1)*st.limit + 1);
    const endNum = st.limit === 'all' ? st.rows.length : Math.min(st.page*st.limit, st.rows.length);
    
    pgWrap.innerHTML = `
      <div class="pg-controls" style="gap:12px;">
        <span class="pg-info" style="font-size:12px;">Afișează</span>
        <select onchange="changeLimit('${key}', this.value)" class="glass-select" style="padding:4px 30px 4px 12px; font-size:12px; background-color: transparent;">
          <option value="10" ${st.limit==10?'selected':''}>10</option>
          <option value="15" ${st.limit==15?'selected':''}>15</option>
          <option value="25" ${st.limit==25?'selected':''}>25</option>
          <option value="50" ${st.limit==50?'selected':''}>50</option>
          <option value="all" ${st.limit==='all'?'selected':''}>Toți</option>
        </select>
        <button class="settings-btn" onclick="exportToExcel('${key}')" style="padding:4px 12px; font-size:11px; margin-left:8px; border:1px solid var(--border);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px; vertical-align:-2px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Excel
        </button>
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
  // Clone table to remove ignore elements or change them before export if needed
  const wb = XLSX.utils.table_to_book(table, { sheet: "Data" });
  XLSX.writeFile(wb, `Export_${key}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
  document.getElementById('native-date-start').value=yMd(s);
  document.getElementById('native-date-end').value=yMd(e);
  document.getElementById('date-start').value=yMd(s);
  document.getElementById('date-end').value=yMd(e);
  document.getElementById('tl-range-display').textContent=`${yMd(s)} ➔ ${yMd(e)}`;
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
  btn.addEventListener('click',()=>{
    if (btn.tagName === 'SELECT' || btn.id === 'btn-month-multi') return;
    document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
    const sel = document.getElementById('preset-month-select');
    if(sel) sel.value = '';
    btn.classList.add('active');applyPreset(btn.dataset.preset);
    autoSetTrend();
    reloadCurrentView();
  });
});

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
    const s = new Date(y, m, 1);
    let e = new Date(y, parseInt(m)+1, 0);
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
  grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
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
        htmlTip += `<tr style="color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.1)">`;
        htmlTip += `<th style="text-align:left;padding-bottom:4px;width:38%">Sala</th><th style="text-align:right;padding-bottom:4px;width:22%">IN</th><th style="text-align:right;padding-bottom:4px;width:22%">GGR</th><th style="text-align:right;padding-bottom:4px;width:18%">HH</th></tr>`;
        row.locs.forEach(l => {
          htmlTip += `<tr><td style="padding:3px 0;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${l.locatie}">${l.locatie}</td><td style="text-align:right;padding:3px 0;color:#94a3b8">${fmtK(l.in)}</td><td style="text-align:right;padding:3px 0" class="tt-val ${l.ggr>=0?'pos':'neg'}">${fmtK(l.ggr)}</td><td style="text-align:right;padding:3px 0" class="tt-val hl">${l.hh>0?fmtK(l.hh):'—'}</td></tr>`;
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
        tt.onmouseleave = () => { window.globalTooltipTimer = setTimeout(() => { tt.style.display = 'none'; }, 100); };
      };
      const _hideTooltip = () => { window.globalTooltipTimer = setTimeout(() => { const tt = document.getElementById('global-tooltip'); if (tt) tt.style.display = 'none'; }, 150); };
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
  grid.style.gridTemplateColumns = 'repeat(6, 1fr)';
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
        htmlTip += `<div class="tt-divider"></div><table style="width:100%; border-collapse:collapse; font-size:10px; table-layout:fixed;"><tr style="color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.1);"><th style="text-align:left; padding-bottom:4px; width:40%;">Locație</th><th style="text-align:right; padding-bottom:4px; width:25%;">GGR</th><th style="text-align:right; padding-bottom:4px; width:15%;">IN</th><th style="text-align:right; padding-bottom:4px; width:20%;">HH</th></tr>`;
        row.locs.forEach(l => { htmlTip += `<tr><td style="padding:4px 0; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${l.locatie}">${l.locatie}</td><td style="text-align:right; padding:4px 0;" class="tt-val ${l.ggr>=0?'pos':'neg'}">${fmtK(l.ggr)}</td><td style="text-align:right; padding:4px 0;" class="tt-val">${fmtK(l.in)}</td><td style="text-align:right; padding:4px 0;" class="tt-val hl">${fmtK(l.hh)}</td></tr>`; });
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
        tt.onmouseleave = () => { window.globalTooltipTimer = setTimeout(() => { tt.style.display = 'none'; }, 100); };
      };
      const _hideHourTooltip = () => { window.globalTooltipTimer = setTimeout(() => { const tt = document.getElementById('global-tooltip'); if (tt) tt.style.display = 'none'; }, 150); };
      
      cell.addEventListener('mouseenter', _showHourTooltip);
      cell.addEventListener('mouseleave', _hideHourTooltip);
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => {
        window.openHourAnalysis(selectedDate, k);
      });
    } else { cell.innerHTML=`<div class="cal-day-num">${k}</div>`; }
    grid.appendChild(cell);
  });
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
    const mkt = d.marketing||0, bet = d.bet||0;
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
      <div class="kpi-card" style="padding:16px;">
        <div class="kpi-label">Games</div>
        <div class="kpi-value" style="font-size:20px;">${fmt(d.games)}</div>
        <div class="kpi-sub">Bet Mediu: <strong>${(bet / Math.max(1, d.games||1)).toFixed(4)} RON</strong></div>
      </div>
    `;

    // 2. Trend Chart & Calendar
    renderLocDetailChart(dailyData);
    renderLocDetailCalendar(locId, e);

    // 3. Machines Table
    renderLocDetailMachines(machData);

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
  _locMachData = data ? [...data].sort((a,b) => (b.ggr||0) - (a.ggr||0)) : [];
  _locMachFiltered = [..._locMachData];
  
  // Populate Top 10 / Bottom 10
  const top10 = _locMachData.slice(0, 10);
  const bottom10 = [..._locMachData].reverse().slice(0, 10);
  
  const renderMiniRow = (r) => `
    <tr>
      <td style="padding-left:16px;">
        <div style="font-weight:600; color:var(--text);">${r.cabinet||'—'}</div>
        <div style="font-size:10px; color:var(--muted);">${r.serial_nr||''}</div>
      </td>
      <td>${r.provider||'—'}</td>
      <td class="num" style="font-weight:600; color:${(r.ggr||0)>=0 ? 'var(--green)' : 'var(--red)'};">${fmt(r.ggr)}</td>
    </tr>
  `;
  
  const topBody = document.getElementById('ld-top-machines-body');
  const bottomBody = document.getElementById('ld-bottom-machines-body');
  if (topBody) topBody.innerHTML = top10.length ? top10.map(renderMiniRow).join('') : '<tr><td colspan="3" style="text-align:center;padding:10px;">Fără date</td></tr>';
  if (bottomBody) bottomBody.innerHTML = bottom10.length ? bottom10.map(renderMiniRow).join('') : '<tr><td colspan="3" style="text-align:center;padding:10px;">Fără date</td></tr>';

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
      <td style="text-align:center; color:var(--muted); font-size:11px">${i+1}</td>
      <td><strong>${r.cabinet||'—'}</strong><div style="font-size:10px;color:var(--muted)">SN: ${r.serial_nr||'—'}</div></td>
      <td>${r.provider||'—'}</td>
      <td>${r.tip_slot||'—'}</td>
      <td class="num">${fmt(r.total_in)}</td>
      <td class="num">${fmt(r.bet)}</td>
      <td class="num ${cc}">${fmt(r.ggr)}</td>
      <td class="num">${pill(r.hold_pct)}</td>
      <td class="num">${fmt(r.jackpot)}</td>
      <td class="num">${fmt(r.games)}</td>
      <td class="num">${bonusCost(bPct)}</td>
    </tr>`;
  });

  const avgHold = tIn>0 ? (tGgr/tIn)*100 : 0;
  const avgBonus = tBet>0 ? (tMkt/tBet)*100 : 0;

  tfoot.innerHTML = `<tr style="font-weight:800; background:var(--surface2);">
    <td colspan="4">TOTAL</td>
    <td class="num">${fmt(tIn)}</td>
    <td class="num">${fmt(tBet)}</td>
    <td class="num">${fmt(tGgr)}</td>
    <td class="num">${pill(avgHold)}</td>
    <td class="num">${fmt(tJp)}</td>
    <td class="num">${fmt(tGames)}</td>
    <td class="num">${bonusCost(avgBonus)}</td>
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
function getPeriod(){return{s:document.getElementById('date-start').value,e:document.getElementById('date-end').value};}
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
  return `<div style="margin-top:4px; text-align:right;"><span class="kpi-trend ${c}" style="font-size:9px; padding:2px 4px;">${a}${Math.abs(pct).toFixed(1)}%</span></div>`;
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
  
  (filtersData.locations||[]).forEach(l=>{
    if(!ex.includes(String(l.id)) && fs) {
      if (perms.locations && perms.locations.length > 0 && !perms.locations.includes(l.id)) return;
      fs.innerHTML+=`<option value="${l.id}">${l.name}</option>`;
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

  const marketingCost = (d.jackpot || 0) + (d.hh || 0) + (d.cashback || 0);
  const ngrCalculated = (d.ggr || 0) + marketingCost;

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
    const isExpensesPage = window.location.hash === '#cheltuieli' || window.location.hash.startsWith('#cheltuieli/') || window.location.hash.startsWith('#rapoarte/cheltuieli');
    expEl.textContent = isExpensesPage ? 'AVG/zi: ' + fmt(d.nr_zile ? d.net_profit/d.nr_zile : 0) + ' RON' : 'Cheltuieli: ' + fmt(d.expenses) + ' RON';
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
  trendChart=new Chart(document.getElementById('trend-chart').getContext('2d'),{
    plugins: [window.ChartDataLabels],
    data:{
      labels:finalData.map(r=>formatLabel(r.luna)),
      datasets:[
        {type:'bar',label:'Total IN',data:finalData.map(r=>r.total_in),
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
        y1:{position:'left',
          ticks:{color:'#6366f1',callback:v=>v>=1000000?(v/1000000).toFixed(1)+'M':(v/1000).toFixed(0)+'k'},
          grid:{color:'rgba(255,255,255,.04)'},
          title:{display:true,text:'Total IN (RON)',color:'#6366f1',font:{size:10}}},
        y2:{position:'right',
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

  let tIn=0,tGgr=0,tJp=0,tHh=0,tCb=0,tGm=0,tMkt=0,tBet=0,tClientiCard=0,tClientiTotal=0;
  data.forEach(r => tGgr += +r.ggr||0);
  const maxG=Math.max(1,...data.map(r=>Math.abs(parseFloat(r.ggr||0))));
  tableStates.locatii.rows=data.map((r, i)=>{
    tIn+=+r.total_in||0;tJp+=+r.jackpot||0;tHh+=+r.hh||0;
    tCb+=+r.cashback||0;tGm+=+r.games||0;tMkt+=+r.marketing||0;tBet+=+r.bet||0;
    tClientiCard+=+(r.clienti_card||0); tClientiTotal+=+(r.clienti_total||0);
    const cc=cellCls(+r.ggr||0,maxG);
    const prev = prevData.find(x => x.id === r.id);
    const currE = currExclData.find(x => x.id === r.id);
    const inB = c ? tBadge(currE?.total_in, prev?.total_in) : '';
    const ggrB = c ? tBadge(currE?.ggr, prev?.ggr) : '';
    
    const isOneDay = (+r.zile === 1);
    let clientiVal;
    if (isOneDay) {
      clientiVal = r.clienti_total > 0 ? String(Math.round(r.clienti_total)) : '—';
    } else {
      const avg = r.zile > 0 ? (r.clienti_total||0) / r.zile : 0;
      clientiVal = avg > 0 ? String(Math.round(avg)) : '—';
    }

    return`<tr>
      <td style="text-align:center; color:var(--muted); font-size:11px">${i+1}</td>
      <td><span class="drill-link" onclick="drillTo('location',${r.id},'${(r.locatie||'').replace(/'/g,"\\'")}')">${r.locatie||'—'}</span></td>
      <td style="text-align:center">${r.buc}</td><td style="text-align:center">${r.zile}</td><td class="num">${clientiVal}</td>
      <td class="num">${fmt(r.total_in)}${inB}</td>
      <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
      <td class="num">${fmtE(r.ggr)}</td>
      <td class="num">${fmt(r.jackpot)}</td><td class="num">${fmt(r.hh)}</td><td class="num">${fmt(r.cashback)}</td><td class="num">${fmt(r.roata||0)}</td><td class="num" style="color:var(--blue)">${fmt(r.raffles||0)}</td>
      <td class="num">${fmt(r.games)}</td><td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td>
    </tr>`;
  });
  renderTablePaginated('locatii');

  // Actualizează header Clienți/zi dinamic (coloana 5)
  const clientiHeader = document.querySelector('#tab-locatii thead th:nth-child(5)');
  if (clientiHeader) {
    const anyOneDayH = data.every(r => +r.zile === 1);
    clientiHeader.textContent = anyOneDayH ? 'Clienți' : 'Clienți/zi';
  }

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
  
  const anyOneDay2 = data.every(r => +r.zile === 1);
  let footerClienti;
  if (anyOneDay2) {
    footerClienti = tClientiTotal > 0 ? `<strong>${Math.round(tClientiTotal)}</strong>` : '—';
  } else {
    const totalZile = data.reduce((s,r) => s + (+r.zile||0), 0.01);
    const avgCl = tClientiTotal / totalZile;
    footerClienti = avgCl > 0 ? `<strong>${Math.round(avgCl)}</strong>` : '—';
  }
  document.getElementById('foot-locatii').innerHTML=`<tr style="font-weight:700">
    <td colspan="2">TOTAL / MEDIE</td>
    <td style="text-align:center">${totalBuc}</td>
    <td style="text-align:center">—</td>
    <td class="num">${footerClienti}</td>
    <td class="num">${fmt(tIn)}${totalInBadge}</td>
    <td class="num">${fmt(tGgr)}${totalGgrBadge}</td>
    <td class="num">${fmtE(tGgr)}</td>
    <td class="num">${fmt(tJp)}</td>
    <td class="num">${fmt(tHh)}</td>
    <td class="num">${fmt(tCb)}</td>
    <td class="num">${fmt(tRoata)}</td>
    <td class="num" style="color:var(--blue)">${fmt(tRaffles)}</td>
    <td class="num">${fmt(tGm)}</td>
    <td class="num">${pill(avgHold)}</td>
    <td class="num">${bonusCost(avgBonusCost)}</td>
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
    return`<tr>
      <td>${i+1}</td>
      <td><span class="drill-link" onclick="drillTo('provider',${r.id},'${(r.provider||'').replace(/'/g,"\\'")}')"><img src="${getProviderLogo(r.provider)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(r.provider||'P')}&background=random&color=fff&rounded=true'" class="prov-logo" alt="icon"> ${r.provider||'—'}</span></td>
      <td>${r.buc}</td><td>${r.zile}</td>
      <td class="num">${fmt(r.total_in)}${inB}</td>
      <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
      <td class="num">${fmtE(r.ggr)}</td>
      <td class="num">${fmt(r.jackpot)}</td><td class="num">${fmt(r.cashback)}</td><td class="num">${fmt(r.roata||0)}</td><td class="num" style="color:var(--blue)">${fmt(r.raffles||0)}</td>
      <td class="num">${fmt(r.games)}</td><td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td>
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
    const w = Math.sqrt(wRaw) * 100; // Smoother visual proportions
    const finalW = Math.max(3, w); // minimum 3% width so it's not just a dot
    const color = isNeg ? 'var(--red)' : CHART_COLORS[i % CHART_COLORS.length];
    
    html += `
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width: 100px; display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <img src="${getProviderLogo(r.provider)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(r.provider||'P')}&background=random&color=fff&rounded=true'" style="width:20px; height:20px; border-radius:50%; object-fit:contain; background:var(--surface);">
          <span style="font-size:11px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.provider || 'Necunoscut'}</span>
        </div>
        <div style="flex:1; display:flex; align-items:center; gap:8px;">
          <div style="flex:1; background:var(--surface); height:8px; border-radius:4px; overflow:hidden; display:flex; justify-content:${isNeg ? 'flex-end' : 'flex-start'};">
            <div style="width:${w}%; background:${color}; height:100%; border-radius:4px;"></div>
          </div>
          <span style="font-size:11px; font-weight:700; color:${color}; width:45px; text-align:${isNeg ? 'left' : 'right'};">${fmtK(val)}</span>
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
    return`<tr>
      <td>${i+1}</td>
      <td><strong>${r.provider||'—'}</strong></td><td>${r.cabinet||'—'}</td><td><img src="/slot_icon.png" class="slot-icon" alt="icon"> ${r.tip_slot||'—'}</td><td>${r.buc}</td>
      <td class="num">${fmt(r.total_in)}${inB}</td>
      <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
      <td class="num">${fmtE(r.ggr)}</td>
      <td class="num">${fmt(r.games)}</td><td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td>
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
    return`<tr>
      <td>${i+1}</td>
      <td><strong>${r.provider||'Necunoscut'}</strong></td><td><span class="drill-link" onclick="drillTo('cabinet',0,'${(r.cabinet||'').replace(/'/g,"\\'")}')"><img src="/slot_icon.png" class="slot-icon" alt="icon"> ${r.cabinet||'—'}</span></td>
      <td>${r.buc}</td>
      <td class="num">${fmt(r.total_in)}${inB}</td>
      <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
      <td class="num">${fmtE(r.ggr)}</td>
      <td class="num">${fmt(r.games)}</td><td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td>
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
        <td class="num">${fmt(r.total_in)}${inB}</td><td class="num">${fmt(r.in_zi)}</td>
        <td class="num ${cc}">${fmt(r.ggr)}${ggrB}</td>
        <td class="num">${fmtE(r.ggr)}</td>
        <td class="num">${fmt(r.jackpot)}</td><td class="num">${fmt(r.hh)}</td><td class="num">${fmt(r.cashback)}</td>
        <td class="num">${fmt(r.games)}</td><td class="num">${pill(r.hold_pct)}</td><td class="num">${bonusCost(r.bonus_cost_pct||0)}</td>
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
}

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

let _loadAllRunning = false;
async function loadAll(){
  if (_loadAllRunning) return;
  _loadAllRunning = true;
  const{s,e}=getPeriod();
  if(!s||!e){ _loadAllRunning = false; return; }
  showLoader(true);
  try{
    await Promise.all([loadKPI(s,e),loadTrend(s,e),loadLocations(s,e),loadProviders(s,e),loadTypes(s,e),loadCabinets(s,e),loadCalendars(s,e),loadMachines(),loadTop10Games(),loadDashClienti(s,e)]);
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
  finally{ showLoader(false); }
  loadTop10Games();
  // Eliberăm lock-ul după 1s pentru a preveni apeluri duble rapide
  setTimeout(() => { _loadAllRunning = false; }, 1000);
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
      const cashouts = data.latest_cashouts || [];
      if (cashouts.length === 0) {
        cashoutsContainer.innerHTML = '<div style="color:var(--muted); text-align:center; padding-top:20px;">Nu există date recente.</div>';
      } else {
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
        cashoutsContainer.innerHTML = chHtm;
      }
    }
  } catch(e) { if(container) container.innerHTML = `<div style="color:red;padding:10px">ERROR: ${e.toString()}</div>`; console.error('loadDashboardLiveCard error:', e); }
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
  applyPreset('month');
  // dispatch AFTER filters+period are ready so hash-specific loaders have data
  window.dispatchEvent(new Event('hashchange'));
  if(window.location.hash === '' || window.location.hash === '#dashboard') await loadAll();
}, 0);

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
Chart.defaults.color = savedTheme === 'light' ? '#64748b' : '#94a3b8';
Chart.defaults.borderColor = savedTheme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.06)';
document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  Chart.defaults.color = next === 'light' ? '#64748b' : '#94a3b8';
  Chart.defaults.borderColor = next === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.06)';
  
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
});

// ─── Views & Reports ──────────────────────────────────────────────────────
window.addEventListener('hashchange', () => {
  const fullHash = window.location.hash;
  const rawHash = (fullHash.split('?')[0]).replace('#', '') || 'dashboard';
  const parts = rawHash.split('/');
  const mainHash = parts[0];
  const subHash = parts[1];
  
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
  if (kpiSection) kpiSection.style.display = mainHash === 'live' ? 'none' : 'grid';

  const targetView = document.getElementById('view-' + mainHash);
  if(targetView) targetView.classList.add('active');
  
  const targetBtn = document.querySelector(`.sidebar .nav-item[href="#${mainHash}"]`) || document.querySelector('.sidebar .nav-item');
  if(targetBtn) targetBtn.classList.add('active');

  // Hide period selector on Live (irrelevant for real-time data)
  const tlSection = document.querySelector('.timeline-section');
  if(tlSection) tlSection.style.display = mainHash === 'live' ? 'none' : '';

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
    if(window.innerWidth <= 1024) toggleSidebar();
    
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
      }
    } else {
      window.location.hash = 'rapoarte/ore';
    }
  } else {
    document.getElementById('subnav-rapoarte').style.display = 'none';
  }
  
  if(mainHash === 'analize') {
    document.getElementById('subnav-rapoarte').style.display = 'none';
    const anView = document.getElementById('view-day-analysis');
    if(anView) anView.classList.add('active');
    loadAnalize();
  }
  if(mainHash === 'admin') {
    const adminView = document.getElementById('view-admin-' + subHash);
    if(adminView) adminView.classList.add('active');
    if(subHash === 'utilizatori') loadAdminUtilizatori();
    if(subHash === 'sloturi') loadAdminSloturi();
  }
  if(mainHash === 'live') loadLive();
  if(mainHash === 'dashboard') loadAll();

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
        tableStates['hh-players'].rows = ['<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--muted);">Nu au fost găsiți jucători activi în orele de HH.</td></tr>'];
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

    if (!_liveTimer) {
      // _liveTimer = setInterval(loadLive, 10000); // Dezactivat pentru a preveni refresh-ul continuu
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
  // _liveTimer = setInterval(() => {
  //   if(document.getElementById('view-live')?.classList.contains('active')) loadLive();
  // }, 30000); // Dezactivat pentru a preveni refresh-ul continuu
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
                  onerror="this.src='https://cdn.cashpot.ro/cashpot/t1/thumbnail_games/placeholder.png'; this.style.opacity='0.3'">
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
          <td class="num" style="font-weight:700; color:var(--success);">${fmt(s.in)}</td>
          <td class="num">${fmt(s.out)}</td>
          <td class="num" style="font-weight:800; color:${s.ggr < 0 ? 'var(--danger)' : 'var(--success)'}">${fmt(s.ggr)}</td>
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
      const ggr = s.ggr || 0;
      const sIn = s.in || 0;
      const sBet = s.bet || 0;
      
      const prodMix = (s.mix || s.producator || '');
      const mach = prodMix.trim().length > 2 ? prodMix.trim() : (s.serial_nr || 'Necunoscut');
      if (!machStats[mach]) machStats[mach] = 0;
      machStats[mach] += sIn; // activity metric = IN on machine days
      
      const day = s.created_at.split(' ')[0].substring(5); // MM-DD
      // Only count unique (machine, day) once in charts to avoid spikes
      if (s.counted !== false) {
        if (!dayStats[day]) dayStats[day] = { in:0, bet:0, ggr:0 };
        dayStats[day].in  += sIn;
        dayStats[day].bet += sBet;
        dayStats[day].ggr += ggr;
        
        const hr = new Date(s.created_at).getHours();
        if (!isNaN(hr)) {
          hourStats[hr].in  += sIn;
          hourStats[hr].bet += sBet;
          hourStats[hr].ggr += ggr;
        }
        
        totalIn  += sIn;
        totalOut += (s.out || 0);
        totalBet += sBet;
        totalGGR += ggr;
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
    document.getElementById('pd-history-body').innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--red);">Eroare la preluarea datelor jucătorului.</td></tr>';
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
    logout(false);
    throw new Error('Unauthorized');
  }
  return res.json();
}

async function checkAuth() {
  const token = localStorage.getItem('cp2_token');
  if (!token) {
    document.getElementById('view-login').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
    const globalHeader = document.getElementById('global-header');
    if (globalHeader) globalHeader.style.display = 'none';
    const appBody = document.getElementById('app-body');
    if (appBody) appBody.style.display = 'none';
    document.querySelector('.sidebar').style.display = 'none';
    return;
  }
  try {
    currentUser = await apiAuth('/api/me');
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    const globalHeader = document.getElementById('global-header');
    if (globalHeader) globalHeader.style.display = 'flex';
    const appBody = document.getElementById('app-body');
    if (appBody) appBody.style.display = 'flex';
    document.querySelector('.sidebar').style.display = 'flex';
    
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
        if (!perms.pages.includes(mainHash) && perms.pages.length > 0) {
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
        applyPreset('month');
        window.dispatchEvent(new Event('hashchange'));
        if (window.location.hash === '' || window.location.hash === '#dashboard') await loadAll();
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

function logout(callApi = true) {
  if (callApi) {
    apiAuth('/api/logout', {method: 'POST'}).catch(e=>e);
  }
  localStorage.removeItem('cp2_token');
  window.location.hash = '';
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('view-login').style.display = 'flex';
  document.getElementById('view-register').style.display = 'none';
  currentUser = null;
}

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
  const avatarInput = document.getElementById('eu-avatar');
  const avatar = avatarInput ? avatarInput.value.trim() : '';
  const pages = Array.from(document.querySelectorAll('.eu-page-cb:checked')).map(cb => cb.value);
  const locations = Array.from(document.querySelectorAll('.eu-loc-cb:checked')).map(cb => parseInt(cb.value, 10));
  const permissions = JSON.stringify({ pages, locations, avatar });
  const name = nume + (prenume ? ' ' + prenume : '');
  if (!nume || !email) return showAlert('Numele și Email-ul sunt obligatorii!');
  try {
    const res = await apiAuth(`/api/users/${id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name, email, phone, permissions})
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
    sidebar.classList.toggle('collapsed');
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

    // Update KPI cards for PL page
    const totalExp = expData.reduce((sum, r) => sum + (r.amount || 0), 0);
    const vOnlyExp = document.getElementById('v-only-expenses');
    if (vOnlyExp) vOnlyExp.textContent = fmt(totalExp) + ' RON';
    
    let months = 1;
    if (s && e) {
      const diffDays = (new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24);
      months = Math.max(1, diffDays / 30.44);
    }
    const vExpMonth = document.getElementById('v-expenses-month');
    if (vExpMonth) vExpMonth.textContent = 'AVG/lună: ' + fmt(totalExp / months) + ' RON';
    
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
    
    // Update Total Cheltuieli KPI directly from data (no extra API call needed)
    const totalExp = _expensesData.reduce((sum, r) => sum + (r.amount || 0), 0);
    const vOnlyExp = document.getElementById('v-only-expenses');
    if (vOnlyExp) vOnlyExp.textContent = fmt(totalExp) + ' RON';
    
    // Calculate months for average
    let months = 1;
    if (s && e) {
      const diffDays = (new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24);
      months = Math.max(1, diffDays / 30.44);
    }
    const vExpMonth = document.getElementById('v-expenses-month');
    if (vExpMonth) vExpMonth.textContent = 'AVG/lună: ' + fmt(totalExp / months) + ' RON';
    
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
  
  const plBtn = document.getElementById('exp-tab-btn-pl');
  if(plBtn) {
    plBtn.style.borderBottomColor = (tab === 'pl') ? 'var(--accent)' : 'transparent';
    plBtn.style.color = (tab === 'pl') ? 'var(--accent)' : 'var(--muted)';
  }
  
  document.getElementById('exp-tab-summary').style.display = (tab === 'summary') ? 'block' : 'none';
  document.getElementById('exp-tab-details').style.display = (tab === 'details') ? 'block' : 'none';
  
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

window.renderExpSummary = function() {
  const q = (document.getElementById('exp-search')?.value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = typeof getExpFiltered === 'function' ? getExpFiltered() : _expensesData.filter(r => !q || [r.explanation, r.location_name, r.department_name, r.vendor_name, r.expenditure_type_name].join(' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q));

  // Categorii ca rânduri, locații ca coloane
  const depsMap = {};  // dep → total
  const locsMap = {};  // dep → { loc → total }
  const locTotals = {}; // loc → grand total

  for (const r of filtered) {
    const dName = r.department_name || 'Fără Dep.';
    const lName = r.location_name || 'Fără Locație';

    if (!depsMap[dName]) depsMap[dName] = 0;
    if (!locsMap[dName]) locsMap[dName] = {};
    if (!locsMap[dName][lName]) locsMap[dName][lName] = 0;
    if (!locTotals[lName]) locTotals[lName] = 0;

    depsMap[dName] += r.amount;
    locsMap[dName][lName] += r.amount;
    locTotals[lName] += r.amount;
  }

  const deps = Object.keys(depsMap).sort();
  const locs = Object.keys(locTotals).sort();

  const thead = document.getElementById('head-exp-summary');
  const tbody = document.getElementById('body-exp-summary');
  if (!thead || !tbody) return;

  // Header: Categorie | Loc1 | Loc2 | ... | Total
  let thHtml = '<tr><th>Categorie</th>';
  for (const l of locs) thHtml += `<th class="num">${l}</th>`;
  thHtml += '<th class="num" style="color:var(--red);">Total</th></tr>';
  thead.innerHTML = thHtml;

  let tbHtml = '';
  let grandTotal = 0;
  const locGrandTotals = {};

  for (const d of deps) {
    let depTotal = 0;
    tbHtml += `<tr><td style="font-weight:600; color:var(--accent); white-space:nowrap;">${d}</td>`;
    for (const l of locs) {
      const amt = locsMap[d][l] || 0;
      depTotal += amt;
      if (!locGrandTotals[l]) locGrandTotals[l] = 0;
      locGrandTotals[l] += amt;
      tbHtml += `<td class="num">${amt > 0 ? fmt(amt) : '-'}</td>`;
    }
    grandTotal += depTotal;
    tbHtml += `<td class="num" style="font-weight:700; color:var(--red);">${fmt(depTotal)}</td></tr>`;
  }

  // Total row
  if (deps.length > 0) {
    tbHtml += `<tr style="background:var(--surface2);"><td style="font-weight:700;">TOTAL GENERAL</td>`;
    for (const l of locs) tbHtml += `<td class="num" style="font-weight:700;">${fmt(locGrandTotals[l] || 0)}</td>`;
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

window.exportExpensesCSV = function() {
  if (!_expensesData || !_expensesData.length) { showAlert('Nu există date de exportat.'); return; }
  const q = (document.getElementById('exp-search')?.value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const rows = _expensesData.filter(r => {
    if (!q) return true;
    return [r.explanation, r.location_name, r.department_name, r.vendor_name, r.expenditure_type_name].join(' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q);
  });
  const bom = '\uFEFF';
  const header = ['Data','Locatie','Departament','Categorie','Furnizor','Explicatie','Suma (RON)'];
  const csv = bom + [header, ...rows.map(r => [
    r.date, r.location_name, r.department_name, r.expenditure_type_name, r.vendor_name,
    (r.explanation||'').replace(/,/g,' '), r.amount
  ].map(v => `"${v||''}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `cheltuieli_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
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
    total += r.amount;
    
    html += `
      <tr>
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
          ${r.id && r.is_manual ? `<div style="display:flex; justify-content:center; gap:4px;">
            <button onclick="openEditExpense('${r.id}')" style="background:none;border:none;cursor:pointer;color:var(--text);padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='none'" title="Modifică">✎</button>
            <button onclick="deleteExpense('${r.id}')" style="background:none;border:none;cursor:pointer;color:var(--red);padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'" title="Șterge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
          </div>` : ''}
        </td>
      </tr>
    `;
  }
  
  // Totals
  const totalGeneral = filtered.reduce((s, r) => s + r.amount, 0); // all filtered rows
  const totalAll = _expensesData.reduce((s, r) => s + r.amount, 0); // all data (no filter)
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
  const loc = document.getElementById('exp-filter-loc')?.value || '';
  const dep = document.getElementById('exp-filter-dep')?.value || '';
  const tip = document.getElementById('exp-filter-tip')?.value || '';
  return _expensesData.filter(r => {
    if (q && ![r.explanation, r.location_name, r.department_name, r.vendor_name, r.expenditure_type_name].join(' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)) return false;
    if (loc && (r.location_name||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") !== loc) return false;
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
  if (locEl) locEl.innerHTML = '<option value="">Toate locațiile</option>' + locs.map(l => `<option value="${l.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}">${l}</option>`).join('');
  if (depEl) depEl.innerHTML = '<option value="">Toate departamentele</option>' + deps.map(d => `<option value="${d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}">${d}</option>`).join('');
  if (tipEl) tipEl.innerHTML = '<option value="">Toate tipurile</option>' + tips.map(t => `<option value="${t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}">${t}</option>`).join('');
}

window.renderExpCharts = function() {
  const data = getExpFiltered();
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
  const id = crypto.randomUUID();
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
  const id = crypto.randomUUID();
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
      headers: { 'Content-Type': 'application/json' },
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
  grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
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
  grid.style.gridTemplateColumns = 'repeat(6, 1fr)';
  
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
