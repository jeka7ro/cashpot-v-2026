import re

with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/onjn.js', 'r') as f:
    js = f.read()

# Replace the alert calls
js = js.replace("alert('Formular Notificare Centrala')", "openOnjnModal('notificare_central')")
js = js.replace("alert('Formular Notificare Locala')", "openOnjnModal('notificare_local')")
js = js.replace("alert('Formular Control')", "openOnjnModal('control')")
js = js.replace("alert('Formular Corespondenta')", "openOnjnModal('corespondenta')")
js = js.replace("alert('Formular adaugare Decizie')", "openOnjnModal('decizie')")

modal_js = """
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
          <form onsubmit="event.preventDefault(); document.getElementById('modal-onjn-dynamic').remove(); alert('Datele au fost salvate (mock).');">
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
"""

js = js + "\n" + modal_js

with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/onjn.js', 'w') as f:
    f.write(js)
