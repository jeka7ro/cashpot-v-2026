import re

with open('app.js', 'r') as f:
    content = f.read()

# 1. Add global variables for zoom and rules
new_vars = """
// === GLOBAL FLOORPLAN SETTINGS & ZOOM ===
let globalFpZoomLevel = 1;
let globalFpSettings = { metric: 'in_zi', rules: [ { max: 200, color: 'var(--red)' }, { max: 500, color: '#fbbf24' }, { max: 9999999, color: 'var(--green)' } ] };

async function loadGlobalFpSettings() {
  try {
    const res = await apiAuth('/api/settings/floorplan');
    if (res && res.metric) {
      globalFpSettings = res;
    }
  } catch(e) { console.error('Error loading fp settings', e); }
}

async function saveGlobalFpSettings() {
  const metric = document.getElementById('global-fp-metric').value;
  const rows = document.querySelectorAll('.fp-rule-row');
  let rules = [];
  rows.forEach(r => {
    const max = parseFloat(r.querySelector('.fp-rule-max').value) || 0;
    const color = r.querySelector('.fp-rule-color').value;
    rules.push({ max, color });
  });
  rules.sort((a,b) => a.max - b.max);
  if (rules.length === 0) rules.push({ max: 9999999, color: 'var(--green)' });
  
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
    addGlobalFpRuleRow(r.max, r.color, idx);
  });
}

function addGlobalFpRuleRow(maxVal = 1000, color = '#3b82f6', idx = -1) {
  const c = document.getElementById('global-fp-rules-container');
  const div = document.createElement('div');
  div.className = 'fp-rule-row';
  div.style = 'display:flex; gap:12px; align-items:center; background:var(--surface); padding:8px 12px; border-radius:8px; border:1px solid var(--border);';
  div.innerHTML = `
    <span style="font-size:12px; color:var(--text); font-weight:600;">Dacă e mai mic ca</span>
    <input type="number" class="fp-rule-max" value="${maxVal}" style="width:80px; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:12px; background:var(--surface2); color:var(--text);">
    <span style="font-size:12px; color:var(--text); font-weight:600;">colorează-l în</span>
    <input type="color" class="fp-rule-color" value="${color}" style="width:40px; height:30px; border:none; padding:0; background:none; cursor:pointer;">
    <button onclick="this.parentElement.remove()" style="margin-left:auto; background:var(--red); color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">X</button>
  `;
  c.appendChild(div);
}
function addGlobalFpRule() { addGlobalFpRuleRow(); }

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
  
  dz.style.transform = 'none';
  if (dz.style.aspectRatio) {
    const [w, h] = dz.style.aspectRatio.split('/').map(Number);
    const imgAspect = w / h;
    const wrapperAspect = wrapper.clientWidth / wrapper.clientHeight;
    
    if (imgAspect > wrapperAspect) {
      dz.style.width = (globalFpZoomLevel * 100) + '%';
      dz.style.height = 'auto';
    } else {
      dz.style.height = (globalFpZoomLevel * 100) + '%';
      dz.style.width = 'auto';
    }
    dz.style.minHeight = 'auto';
    dz.style.margin = '0 auto';
  } else {
    dz.style.width = (globalFpZoomLevel * 100) + '%';
    dz.style.height = (globalFpZoomLevel * 100) + '%';
    dz.style.minHeight = (500 * globalFpZoomLevel) + 'px';
    dz.style.margin = '0';
  }
  dz.style.backgroundSize = '100% 100%'; 
  wrapper.style.overflow = globalFpZoomLevel > 1 ? 'auto' : 'hidden';
  const label = document.getElementById('global-fp-zoom-label');
  if (label) label.textContent = Math.round(globalFpZoomLevel * 100) + '%';
}

function showFpTooltip(el, e, serie, joc, ggr, inZi, bet) {
  const tt = document.getElementById('fp-custom-tooltip');
  if (!tt) return;
  document.getElementById('fp-tt-serie').textContent = 'Seria: ' + serie;
  document.getElementById('fp-tt-joc').textContent = joc;
  document.getElementById('fp-tt-ggr').textContent = fmt(ggr);
  document.getElementById('fp-tt-in').textContent = fmt(inZi);
  document.getElementById('fp-tt-bet').textContent = fmt(bet);
  
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

// Initial load settings
document.addEventListener('DOMContentLoaded', () => {
  loadGlobalFpSettings();
});

"""

content += "\n" + new_vars

# Now replace loadGlobalFloorplan
new_load_func = """async function loadGlobalFloorplan() {
  const select = document.getElementById('global-fp-location-select');
  const locId = select ? select.value : null;
  const wrapper = document.getElementById('global-fp-wrapper');
  const container = document.getElementById('global-fp-container');
  const emptyState = document.getElementById('global-fp-empty');

  if (!locId) {
    if (wrapper) wrapper.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  showLoader(true);
  try {
    const [machData, dataBg, posData] = await Promise.all([
      apiAuth(`/api/machines?start=${getTodayStr()}&end=${getTodayStr()}&loc_ids=${locId}`),
      apiAuth(`/api/floorplan/settings?location_id=${locId}`),
      apiAuth(`/api/floorplan/machines?location_id=${locId}`)
    ]);

    if (!dataBg || !dataBg.floorplan_bg) {
      wrapper.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    emptyState.style.display = 'none';
    wrapper.style.display = 'block';
    const img = new Image();
    img.onload = function() {
      container.style.aspectRatio = `${this.width} / ${this.height}`;
      container.style.backgroundSize = '100% 100%';
      applyGlobalFpZoom();
    };
    img.src = `${API}${dataBg.floorplan_bg}`;
    container.style.backgroundImage = `url('${API}${dataBg.floorplan_bg}')`;
    container.innerHTML = '';

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
      
      let val = md ? (md[metric] || 0) : 0;
      let bg = 'var(--surface2)';
      let col = 'var(--text)';
      
      if (md && rules.length > 0) {
        for (let r of rules) {
          if (val < r.max) {
            bg = r.color;
            // determine text color based on background brightness (simple heuristic: white for dark bg)
            col = 'white'; // default
            if (bg.toLowerCase() === '#fbbf24' || bg.toLowerCase() === 'yellow' || bg.toLowerCase() === '#ffffff') col = 'black';
            break;
          }
        }
      }

      const ggr = md ? (md.tot_ggr || md.ggr || 0) : 0;
      const tIn = md ? (md.in_zi || md.tin || md.total_in || 0) : 0;
      const tBet = md ? (md.tot_bet || md.bet || 0) : 0;
      const joc = md ? md.tip_slot : '-';
      const serie = md ? md.serial_nr : p.serial_nr;

      el.innerHTML = `
        <div style="background:${bg}; color:${col}; width:28px; padding:2px; border-radius:4px; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.5); cursor:pointer;" 
             onmouseenter="showFpTooltip(this, event, '${serie}', '${joc}', ${ggr}, ${tIn}, ${tBet})"
             onmousemove="moveFpTooltip(event)"
             onmouseleave="hideFpTooltip()">
          <div style="font-size:6.5px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">${posLabel}</div>
          <div style="font-size:7.5px; font-weight:800; margin-top:2px;">${fmt(val)}</div>
        </div>
      `;
      container.appendChild(el);
    });
  } catch(e) {
    console.error('Error rendering global floorplan', e);
    wrapper.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
  } finally {
    showLoader(false);
  }
}
"""

content = re.sub(r'async function loadGlobalFloorplan\(\) \{.*?(?=\n// Upload schiță direct)', new_load_func, content, flags=re.DOTALL)

with open('app.js', 'w') as f:
    f.write(content)

