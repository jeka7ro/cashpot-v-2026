import sys

with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js', 'r') as f:
    content = f.read()

target = """  const renderMiniRow = (r) => {
    let tooltipHtml = '';
    if (r.hp_details) {
      const parts = r.hp_details.split(';');
      const maxHps = parts.map(p => {
        const [d, sum] = p.split('|');
        return { d, sum: parseFloat(sum) || 0 };
      }).sort((a,b) => b.sum - a.sum).slice(0, 5); // top 5
      
      const detailsStr = maxHps.map(x => `<div style="display:flex;justify-content:space-between;width:120px;margin-bottom:2px;font-size:10px;"><span>${x.d.replace('202','2').substring(2)}</span><strong style="color:var(--text)">${fmt(x.sum)}</strong></div>`).join('');
      tooltipHtml = `
        <div class="hp-tooltip" style="display:none; position:absolute; right:100%; top:50%; transform:translateY(-50%); background:var(--surface); border:1px solid var(--border); box-shadow:0 8px 24px rgba(0,0,0,0.2); padding:10px; border-radius:8px; z-index:100; min-width:140px; pointer-events:none;">
          <div style="font-size:9px; font-weight:800; color:var(--accent); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:4px;">Top Plăți Zilnice</div>
          ${detailsStr}
        </div>
      `;
    }

    return `
    <tr>
      <td style="padding-left:16px;">
        <div style="font-weight:600; color:var(--text);">${r.cabinet||'—'}</div>
        <div style="font-size:10px; color:var(--muted);">${r.serial_nr||''}</div>
      </td>
      <td>${r.provider||'—'}</td>
      <td class="num">${pill(r.hold_pct)}</td>
      <td class="num" style="font-weight:600; color:${(r.ggr||0)>=0 ? 'var(--green)' : 'var(--red)'};">${fmt(r.ggr)}</td>
      <td class="num" style="color:var(--muted); position:relative; cursor:${r.hp_details ? 'pointer' : 'default'};" onmouseenter="this.querySelector('.hp-tooltip') && (this.querySelector('.hp-tooltip').style.display='block')" onmouseleave="this.querySelector('.hp-tooltip') && (this.querySelector('.hp-tooltip').style.display='none')">
        ${r.handpays||0}
        ${tooltipHtml}
      </td>
    </tr>
    `;
  };"""

replacement = """  const renderMiniRow = (r) => {
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
  };"""

# Add the global tooltip functions at the end of the file if not already there
global_funcs = """
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
"""

if target in content:
    content = content.replace(target, replacement)
    if 'showGlobalHpTooltip' not in content:
        content += global_funcs
    with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js', 'w') as f:
        f.write(content)
    print("PATCHED renderMiniRow")
else:
    print("TARGET NOT FOUND in renderMiniRow")
