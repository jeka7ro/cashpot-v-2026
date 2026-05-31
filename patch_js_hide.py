import re

with open('app.js', 'r') as f:
    content = f.read()

# in hash router
replacement = """
      document.querySelectorAll('.rep-page').forEach(p => p.style.display = 'none');
      const repTarget = document.getElementById('rep-page-' + subHash);
      if (repTarget) repTarget.style.display = 'block';
      
      const kpiJp = document.getElementById('kpi-jp');
      const kpiExp = document.getElementById('kpi-total-expenses');
      if (subHash === 'cheltuieli') {
        if(kpiJp) kpiJp.style.display = 'none';
        if(kpiExp) kpiExp.style.display = 'flex';
      } else {
        if(kpiJp) kpiJp.style.display = 'flex';
        if(kpiExp) kpiExp.style.display = 'none';
      }
"""

content = re.sub(r"      document\.querySelectorAll\('\.rep-page'\)\.forEach\(p => p\.style\.display = 'none'\);\n      const repTarget = document\.getElementById\('rep-page-' \+ subHash\);\n      if \(repTarget\) repTarget\.style\.display = 'block';", replacement.strip(), content)

# in loadKPI update the new elements
kpi_upd = """
    document.getElementById('v-jp').textContent=fmt(data.jackpot);
    document.getElementById('v-hh').textContent='HH: '+fmt(data.hh);
    
    const vOnlyExp = document.getElementById('v-only-expenses');
    if(vOnlyExp) vOnlyExp.textContent=fmt(data.expenses) + ' RON';
    const vOnlyProf = document.getElementById('v-only-profit');
    if(vOnlyProf) vOnlyProf.textContent='Profit Net: '+fmt(data.net_profit);
"""

content = re.sub(r"    document\.getElementById\('v-jp'\)\.textContent=fmt\(data\.jackpot\);\n    document\.getElementById\('v-hh'\)\.textContent='HH: '\+fmt\(data\.hh\);", kpi_upd.strip(), content)

with open('app.js', 'w') as f:
    f.write(content)
