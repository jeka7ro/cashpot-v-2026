import re

# 1. Update index.html
html_file = "/Users/eugeniucazmal/Downloads/dev_office/cashpot2/index.html"
with open(html_file, "r") as f:
    html_content = f.read()

target_html = """        <div style="padding:12px 16px; background:var(--surface2); border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:12px; color:var(--muted);" id="contracts-record-count">Total înregistrări: 0</div>
          <div style="font-size:12px; color:var(--muted);">Pagina 1 / 1</div>
        </div>"""

replacement_html = """        <div id="pg-contracts" class="pagination-wrapper" style="border-top:1px solid var(--border); padding:12px 20px; display:flex; justify-content:space-between; align-items:center; background:var(--surface2);"></div>"""

html_content = html_content.replace(target_html, replacement_html)
with open(html_file, "w") as f:
    f.write(html_content)


# 2. Update app.js
js_file = "/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js"
with open(js_file, "r") as f:
    js_content = f.read()

# Add to tableStates
js_content = js_content.replace(
    "  locatii: { page: 1, limit: 'all', rows: [] },",
    "  locatii: { page: 1, limit: 'all', rows: [] },\n  contracts: { page: 1, limit: 10, tbody: 'contracts-tbody', pagination: 'pg-contracts', rows: [] },"
)

# Replace renderContractsTable logic
# The original logic builds `html` using `filteredContracts.forEach((c, idx) => { ... })` and then sets `tb.innerHTML = html;`
# We need to change it to use map and tableStates

old_logic = """
  let html = '';
  filteredContracts.forEach((c, idx) => {
    if (c.currency === 'RON' || c.currency === 'LEI') totalRon += parseFloat(c.total_amount) || 0;
    else if (c.currency === 'EUR') totalEur += parseFloat(c.total_amount) || 0;

    totalM2 += parseFloat(c.m2) || 0;

    // Format locations summary
    const locNames = (c.locations || []).map(l => {
"""

new_logic = """
  tableStates.contracts.rows = filteredContracts.map((c, idx) => {
    if (c.currency === 'RON' || c.currency === 'LEI') totalRon += parseFloat(c.total_amount) || 0;
    else if (c.currency === 'EUR') totalEur += parseFloat(c.total_amount) || 0;

    totalM2 += parseFloat(c.m2) || 0;

    // Format locations summary
    const locNames = (c.locations || []).map(l => {
"""

js_content = js_content.replace(old_logic, new_logic)

# Replace the end of the loop
old_loop_end = """        </td>
      </tr>
    `;
  });
  
  tb.innerHTML = html;
  
  // Footer
  const tf = document.getElementById('contracts-tfoot');
"""

new_loop_end = """        </td>
      </tr>
    `;
  });
  
  renderTablePaginated('contracts');
  
  // Footer
  const tf = document.getElementById('contracts-tfoot');
"""

js_content = js_content.replace(old_loop_end, new_loop_end)

with open(js_file, "w") as f:
    f.write(js_content)
