with open("index.html", "r") as f:
    content = f.read()

start = content.find('<tr class="filter-row">')
if start != -1:
    end = content.find('</tr>', start)
    # The columns are: Nr. Crt., Locație, Producător, Serial, Zile.
    # Currently filter has inputs for Locație, Producător, Serial.
    # So we need one more <th> for Zile before the colspan!
    filter_html = content[start:end+5]
    if 'id="flt-rtp-serial"' in filter_html and 'id="flt-rtp-zile"' not in filter_html:
        new_filter = filter_html.replace(
            '<th colspan="9"></th>',
            '<th><input type="text" id="flt-rtp-zile" class="glass-input w-full" placeholder="Caută zile..." style="padding:4px; font-size:11px;" onkeyup="filterRtpTable()"></th>\n                  <th colspan="8"></th>'
        )
        content = content[:start] + new_filter + content[end+5:]
        with open("index.html", "w") as f:
            f.write(content)
        print("Fixed filter row")
