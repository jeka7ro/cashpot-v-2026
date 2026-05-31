import re

with open('app.js', 'r') as f:
    content = f.read()

expenses_js = """
// ─── RAPOARTE CHELTUIELI ──────────────────────────────────────────
let _expensesData = [];
window.loadExpensesReport = async function() {
  showLoader(true);
  try {
    const {s, e} = getPeriod();
    const data = await api(`/api/reports/expenses?start=${s}&end=${e}${locParam()}`);
    _expensesData = data || [];
    window.renderExpensesTable();
  } catch(err) {
    console.error(err);
  } finally {
    showLoader(false);
  }
}

window.filterExpensesTable = function() {
  window.renderExpensesTable();
}

window.renderExpensesTable = function() {
  const tbody = document.getElementById('body-rep-cheltuieli');
  if (!tbody) return;
  const q = (document.getElementById('exp-search')?.value || '').toLowerCase();
  
  let html = '';
  let total = 0;
  
  for (const r of _expensesData) {
    const textToSearch = [r.explanation, r.location_name, r.department_name, r.vendor_name, r.expenditure_type_name].join(' ').toLowerCase();
    if (q && !textToSearch.includes(q)) continue;
    
    total += r.amount;
    
    html += `
      <tr>
        <td style="white-space:nowrap;font-size:11px;color:var(--muted)">${r.date}</td>
        <td style="color:var(--accent);font-weight:600">${r.location_name}</td>
        <td>${r.department_name}</td>
        <td>${r.type_name}</td>
        <td>${r.expenditure_type_name}</td>
        <td>${r.vendor_name}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.explanation}">${r.explanation}</td>
        <td class="num" style="color:var(--red);font-weight:700">${fmt(r.amount)}</td>
      </tr>
    `;
  }
  
  if (!html) html = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--muted)">Nu s-au găsit cheltuieli.</td></tr>`;
  else {
    html += `
      <tr style="background:var(--surface2)">
        <td colspan="7" style="text-align:right;font-weight:800;color:var(--text)">Total Filtru:</td>
        <td class="num" style="color:var(--red);font-weight:800;font-size:14px">${fmt(total)} RON</td>
      </tr>
    `;
  }
  
  tbody.innerHTML = html;
}
"""

if "window.loadExpensesReport" not in content:
    content += "\n" + expenses_js

# update line 160
content = content.replace("else if (hash.startsWith('#rapoarte/cashout')) loadRapoarteCashout();", "else if (hash.startsWith('#rapoarte/cashout')) loadRapoarteCashout();\n  else if (hash.startsWith('#rapoarte/cheltuieli')) window.loadExpensesReport();")

with open('app.js', 'w') as f:
    f.write(content)
