import re

with open('index.html', 'r') as f:
    content = f.read()

# Add link in subnav
link_str = """        <a href="#rapoarte/cheltuieli" class="nav-item sub-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Cheltuieli
        </a>
"""
if "#rapoarte/cheltuieli" not in content:
    content = content.replace('<a href="#rapoarte/cashout" class="nav-item sub-item" id="rep-nav-cashout">', link_str + '        <a href="#rapoarte/cashout" class="nav-item sub-item" id="rep-nav-cashout">')

# Add page in rep-page
page_str = """
        <!-- ═══ PAGE: CHELTUIELI ═══ -->
        <div id="rep-page-cheltuieli" class="rep-page" style="display:none;">
          <section class="card" style="margin-top:0; border-top-left-radius:0; padding:0; overflow:hidden;">
            <div style="padding:14px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <span style="font-size:11px; font-weight:700; color:var(--text); text-transform:uppercase; letter-spacing:.05em;">Registru Cheltuieli Operaționale</span>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <input type="text" id="exp-search" placeholder="🔍 Caută (explicatie, vendor)..." oninput="filterExpensesTable()" 
                  style="background:var(--surface2); color:var(--text); border:1px solid var(--border); border-radius:20px; padding:5px 14px; font-size:11px; width:220px; outline:none;">
              </div>
            </div>
            <div class="table-scroll">
              <table class="data-table w-full">
                <thead>
                  <tr>
                    <th>Dată</th>
                    <th>Locație</th>
                    <th>Departament</th>
                    <th>Tip Document</th>
                    <th>Categorie</th>
                    <th>Furnizor</th>
                    <th>Explicație</th>
                    <th class="num">Sumă (RON)</th>
                  </tr>
                </thead>
                <tbody id="body-rep-cheltuieli"></tbody>
              </table>
            </div>
          </section>
        </div>
"""

if 'id="rep-page-cheltuieli"' not in content:
    content = content.replace('<!-- ═══ PAGE: CASHOUT ═══ -->', page_str + '        <!-- ═══ PAGE: CASHOUT ═══ -->')

with open('index.html', 'w') as f:
    f.write(content)

