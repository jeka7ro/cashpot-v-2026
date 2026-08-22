with open("index.html", "r") as f:
    content = f.read()

start = content.find('<div id="analiza-rtp"')
if start != -1:
    end = content.find('<!-- Performanță Reset -->', start)
    
    rtp_html = content[start:end]
    
    # Needs to match the "analiza-resets" container style:
    # <div class="glass-card" style="padding:0; display:flex; flex-direction:column; height:calc(100vh - 120px);">
    
    new_html = rtp_html.replace(
        '<div class="glass-card" style="padding: 20px;">',
        '<h3 class="glass-title" style="margin-bottom:16px;">Analiză RTP Teoretic vs Real Net</h3>\n        <div class="glass-card" style="padding:0; display:flex; flex-direction:column; height:calc(100vh - 120px);">'
    )
    
    new_html = new_html.replace(
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">',
        '<div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-end;">'
    )
    
    # Hide the old title inside the header (since we put it on top)
    new_html = new_html.replace(
        '<h3 style="margin:0; font-size:18px; font-weight:600; color:var(--text);">RTP Teoretic vs. Real Net</h3>',
        ''
    )
    
    new_html = new_html.replace(
        '<div class="table-scroll">',
        '<div class="table-container" style="flex:1; padding:0; border-radius:12px; overflow:hidden;">'
    )
    
    # Remove the table inner row filters and replace with header filters to match Resets
    filter_row_start = new_html.find('<tr class="filter-row">')
    filter_row_end = new_html.find('</tr>', filter_row_start) + 5
    new_html = new_html[:filter_row_start] + new_html[filter_row_end:]
    
    header_start = new_html.find('<div style="padding:16px 20px;')
    header_end = new_html.find('</div>\n            \n            <div>', header_start)
    
    new_header_html = """<div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end;">
            <div style="display:flex; gap:16px; flex:1;">
              <div>
                <label class="input-label">Caută Locație</label>
                <div class="search-box">
                  <input type="text" id="flt-rtp-loc" placeholder="Ex: Craiova" onkeyup="filterRtpTable()">
                </div>
              </div>
              <div>
                <label class="input-label">Caută Mix / Producător</label>
                <div class="search-box">
                  <input type="text" id="flt-rtp-prod" placeholder="Ex: EGT" onkeyup="filterRtpTable()">
                </div>
              </div>
              <div>
                <label class="input-label">Caută Serial</label>
                <div class="search-box">
                  <input type="text" id="flt-rtp-serial" placeholder="Ex: 149604" onkeyup="filterRtpTable()">
                </div>
              </div>
              <div>
                <label class="input-label">Caută Zile</label>
                <div class="search-box">
                  <input type="text" id="flt-rtp-zile" placeholder="Ex: 100" onkeyup="filterRtpTable()">
                </div>
              </div>
            </div>"""
    
    new_html = new_html[:header_start] + new_header_html + new_html[header_end+18:]
    
    # Change pagination bottom div
    pag_start = new_html.find('<!-- Pagination Bottom -->')
    pag_end = new_html.find('</div>\n          </div>', pag_start) + 22
    
    new_pag = '<!-- Table Footer Pagination -->\n          <div id="pg-analiza-rtp" style="border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;"></div>\n'
    new_html = new_html[:pag_start] + new_pag + new_html[pag_end:]
    
    content = content[:start] + new_html + content[end:]
    
    with open("index.html", "w") as f:
        f.write(content)
    print("Fixed RTP container")
