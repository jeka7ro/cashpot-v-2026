import re
js_file = "/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js"
with open(js_file, "r") as f:
    content = f.read()

# Fix inside the map: html += `<tr>...</tr>`; -> return `<tr>...</tr>`;
content = content.replace("html += `\n      <tr>", "return `\n      <tr>")

# Fix at the end: tb.innerHTML = html; -> renderTablePaginated('contracts');
# Be careful to target the correct tb.innerHTML = html; inside renderContractsTable
# Let's use regex to replace it exactly after the kpi updates

old_block = """  document.getElementById('kpi-contract-eur').innerHTML = `${fmt(totalEur)} €<br><span style="font-size:12px; color:var(--muted); font-weight:normal;">(${fmt(totalEur * EUR_RATE)} RON)</span><br><span style="font-size:10px; color:var(--muted); font-weight:normal;">Curs BNR: ${EUR_RATE.toFixed(4)}</span>`;
  
  tb.innerHTML = html;"""

new_block = """  document.getElementById('kpi-contract-eur').innerHTML = `${fmt(totalEur)} €<br><span style="font-size:12px; color:var(--muted); font-weight:normal;">(${fmt(totalEur * EUR_RATE)} RON)</span><br><span style="font-size:10px; color:var(--muted); font-weight:normal;">Curs BNR: ${EUR_RATE.toFixed(4)}</span>`;
  
  renderTablePaginated('contracts');"""

content = content.replace(old_block, new_block)

with open(js_file, "w") as f:
    f.write(content)

