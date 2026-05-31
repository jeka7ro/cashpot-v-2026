import sys

with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js', 'r') as f:
    content = f.read()

target = "  else if (hash.startsWith('#rapoarte/clienti')) { loadKPI(s,e); loadClientiReport(); }"
replacement = """  else if (hash.startsWith('#rapoarte/clienti')) { loadKPI(s,e); loadClientiReport(); }
  else if (hash.startsWith('#rapoarte/retentie')) { loadKPI(s,e); loadRetentionReport(); }"""

if target in content:
    content = content.replace(target, replacement)
    
    # Add function at the end
    content += """

// --- RETENTION REPORT ---
async function loadRetentionReport() {
  const {s, e} = getPeriod();
  if (!s || !e) return;
  
  const tbody = document.getElementById('ret-table-body');
  if(tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--muted); font-size:12px;">Se încarcă datele...</td></tr>';
  
  try {
    const data = await api(`/api/reports/retention?start=${s}&end=${e}`);
    
    document.getElementById('ret-kpi-promo').textContent = fmt(data.total_promo);
    document.getElementById('ret-kpi-recycled').textContent = fmt(data.total_recycled);
    document.getElementById('ret-kpi-rate').textContent = data.rate + '%';
    
    if (tbody) {
      if (!data.players || data.players.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--muted); font-size:12px;">Niciun jucător cu activitate promoțională în această perioadă.</td></tr>';
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

        html += `
          <tr>
            <td style="padding-left:16px;">${idx + 1}</td>
            <td style="font-weight:600; color:var(--text);">${p.fname} ${p.lname} <span style="color:var(--muted); font-size:10px;">(#${p.player_id})</span></td>
            <td style="text-align:right; font-weight:600; color:var(--pink);">${fmt(promo)}</td>
            <td style="text-align:right; font-weight:600; color:var(--green);">${fmt(recycled)}</td>
            <td style="text-align:right; padding-right:16px;">${hrBadge}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    }
  } catch(err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--red);">${err.message}</td></tr>`;
  }
}
"""
    with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js', 'w') as f:
        f.write(content)
    print("PATCHED")
else:
    print("TARGET NOT FOUND")
