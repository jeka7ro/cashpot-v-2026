with open("index.html", "r") as f:
    content = f.read()

start = content.find('<!-- Filter Header -->', content.find('<div id="analiza-resets"'))
if start != -1:
    end = content.find('          <!-- Table Container -->', start)
    
    new_html = """<!-- Filter Header -->
          <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end;">
            <div style="display:flex; gap:16px; flex:1; flex-wrap:wrap;">
              <div style="flex:1; min-width:150px;">
                <label class="input-label">Caută Locație</label>
                <div class="search-box">
                  <input type="text" id="flt-resets-loc" placeholder="Ex: Craiova" onkeyup="filterAnalizaResetsTable()">
                </div>
              </div>
              <div style="flex:1; min-width:150px;">
                <label class="input-label">Caută Mix / Cabinet</label>
                <div class="search-box">
                  <input type="text" id="flt-resets-mix" placeholder="Ex: EGT" onkeyup="filterAnalizaResetsTable()">
                </div>
              </div>
              <div style="flex:1; min-width:150px;">
                <label class="input-label">Caută Aparat (Serial)</label>
                <div class="search-box">
                  <input type="text" id="flt-resets-serial" placeholder="Ex: 5040" onkeyup="filterAnalizaResetsTable()">
                </div>
              </div>
            </div>
            
            <div style="display:flex; gap:12px;">
                <button class="btn btn-secondary" onclick="exportTableToExcel('analiza-resets-tbl', 'Performanta_Reset_Aparate.xlsx')" title="Export Excel">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg> Export
                </button>
                <button class="btn btn-primary" onclick="loadAnalizaResetsData()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Reîncarcă
                </button>
            </div>
          </div>
"""
    content = content[:start] + new_html + content[end:]
    with open("index.html", "w") as f:
        f.write(content)
        
    print("Fixed resets filters")
