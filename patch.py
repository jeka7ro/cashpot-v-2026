import sys

with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js', 'r') as f:
    content = f.read()

target = """  // Populate Top/Bottom
  const topLimit = parseInt(document.getElementById('ld-top-limit')?.value || '10');
  const top10 = _locMachData.slice(0, topLimit);
  const bottom10 = [..._locMachData].reverse().slice(0, topLimit);
  
  const renderMiniRow = (r) => `
    <tr>
      <td style="padding-left:16px;">
        <div style="font-weight:600; color:var(--text);">${r.cabinet||'—'}</div>
        <div style="font-size:10px; color:var(--muted);">${r.serial_nr||''}</div>
      </td>
      <td>${r.provider||'—'}</td>
      <td class="num">${pill(r.hold_pct)}</td>
      <td class="num" style="font-weight:600; color:${(r.ggr||0)>=0 ? 'var(--green)' : 'var(--red)'};">${fmt(r.ggr)}</td>
    </tr>
  `;
  
  const topBody = document.getElementById('ld-top-machines-body');
  const bottomBody = document.getElementById('ld-bottom-machines-body');
  if (topBody) topBody.innerHTML = top10.length ? top10.map(renderMiniRow).join('') : '<tr><td colspan="4" style="text-align:center;padding:10px;">Fără date</td></tr>';
  if (bottomBody) bottomBody.innerHTML = bottom10.length ? bottom10.map(renderMiniRow).join('') : '<tr><td colspan="4" style="text-align:center;padding:10px;">Fără date</td></tr>';"""

replacement = """  // Populate Top/Bottom
  const storedLimit = localStorage.getItem('locDetailTopLimit') || '10';
  const selectEl = document.getElementById('ld-top-limit');
  if (selectEl) selectEl.value = storedLimit;
  const topLimit = parseInt(storedLimit);

  const top10 = _locMachData.slice(0, topLimit);
  const bottom10 = [..._locMachData].reverse().slice(0, topLimit);
  
  const renderMiniRow = (r) => `
    <tr>
      <td style="padding-left:16px;">
        <div style="font-weight:600; color:var(--text);">${r.cabinet||'—'}</div>
        <div style="font-size:10px; color:var(--muted);">${r.serial_nr||''}</div>
      </td>
      <td>${r.provider||'—'}</td>
      <td class="num">${pill(r.hold_pct)}</td>
      <td class="num" style="font-weight:600; color:${(r.ggr||0)>=0 ? 'var(--green)' : 'var(--red)'};">${fmt(r.ggr)}</td>
      <td class="num" style="color:var(--muted)">${r.handpays||0}</td>
    </tr>
  `;
  
  const topBody = document.getElementById('ld-top-machines-body');
  const bottomBody = document.getElementById('ld-bottom-machines-body');
  if (topBody) topBody.innerHTML = top10.length ? top10.map(renderMiniRow).join('') : '<tr><td colspan="5" style="text-align:center;padding:10px;">Fără date</td></tr>';
  if (bottomBody) bottomBody.innerHTML = bottom10.length ? bottom10.map(renderMiniRow).join('') : '<tr><td colspan="5" style="text-align:center;padding:10px;">Fără date</td></tr>';"""

if target in content:
    content = content.replace(target, replacement)
    with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js', 'w') as f:
        f.write(content)
    print("Patched app.js successfully")
else:
    print("Target not found in app.js")
