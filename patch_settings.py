import re

with open('index.html', 'r') as f:
    content = f.read()

settings_ui = """
      <div id="settings-expenses" style="margin-top:32px; padding-top:24px; border-top:1px solid var(--border);">
        <h3 style="font-size:14px; font-weight:700; color:var(--text); margin-bottom:16px;">Configurare Cheltuieli Operaționale</h3>
        <p style="font-size:11px; color:var(--muted); margin-bottom:16px;">Selectează departamentele și tipurile care reprezintă cheltuieli reale (și debifează POS, Bancă, Top Pay etc.).</p>
        
        <div style="display:flex; gap:32px;">
          <div style="flex:1;">
            <div style="font-size:12px; font-weight:600; color:var(--accent); margin-bottom:8px;">Departamente Incluse</div>
            <div id="set-exp-deps" style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto; padding:8px; background:var(--surface2); border-radius:8px;"></div>
          </div>
          <div style="flex:1;">
            <div style="font-size:12px; font-weight:600; color:var(--accent); margin-bottom:8px;">Tipuri de Plăți Incluse</div>
            <div id="set-exp-types" style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto; padding:8px; background:var(--surface2); border-radius:8px;"></div>
          </div>
        </div>
        <button class="btn-primary" onclick="saveExpensesConfig()" style="margin-top:16px;">Salvează Configurația</button>
      </div>
"""

if 'id="settings-expenses"' not in content:
    # insert before </div> <!-- /settings-panel ->
    content = content.replace("</div>\n    </div>\n  </div>\n\n  <!-- THEME TOGGLE", settings_ui + "</div>\n    </div>\n  </div>\n\n  <!-- THEME TOGGLE")
    
    with open('index.html', 'w') as f:
        f.write(content)

with open('app.js', 'r') as f:
    content = f.read()

settings_js = """
// --- EXPENSES CONFIG SETTINGS ---
async function loadExpensesConfig() {
  try {
    const data = await api('/api/admin/expenses_config');
    const depContainer = document.getElementById('set-exp-deps');
    const typeContainer = document.getElementById('set-exp-types');
    if(!depContainer || !typeContainer) return;
    
    depContainer.innerHTML = data.departments.map(d => `
      <label style="display:flex; align-items:center; gap:8px; font-size:11px; cursor:pointer;">
        <input type="checkbox" class="cfg-dep" value="${d.id}" ${d.is_expense ? 'checked' : ''}>
        ${d.name}
      </label>
    `).join('');
    
    typeContainer.innerHTML = data.types.map(t => `
      <label style="display:flex; align-items:center; gap:8px; font-size:11px; cursor:pointer;">
        <input type="checkbox" class="cfg-type" value="${t.id}" ${t.is_expense ? 'checked' : ''}>
        ${t.name}
      </label>
    `).join('');
  } catch(e) { console.error(e); }
}

window.saveExpensesConfig = async function() {
  const exclDeps = Array.from(document.querySelectorAll('.cfg-dep:not(:checked)')).map(i => i.value);
  const exclTypes = Array.from(document.querySelectorAll('.cfg-type:not(:checked)')).map(i => i.value);
  
  try {
    const res = await api('/api/admin/expenses_config', 'POST', {
      excluded_departments: exclDeps,
      excluded_types: exclTypes
    });
    if(res.success) {
      alert('Configurația a fost salvată cu succes! Cheltuielile și Profitul Net au fost actualizate.');
      loadAll();
    }
  } catch(e) { console.error(e); alert('Eroare la salvare!'); }
}
"""

if "loadExpensesConfig()" not in content:
    content += "\n" + settings_js
    
    # inject loadExpensesConfig() into openSettings()
    content = content.replace("function openSettings() {", "function openSettings() {\n  loadExpensesConfig();")
    
    with open('app.js', 'w') as f:
        f.write(content)
