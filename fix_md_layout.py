with open("index.html", "r") as f:
    content = f.read()

start = content.find('<div id="analiza-machine-details"')
if start != -1:
    end = content.find('<!-- Optimizare Sală -->', start)
    
    html = content[start:end]
    
    # We need to add a <div class="glass-card" style="padding: 24px;"> around the content of analiza-machine-details.
    
    # Insert at the beginning:
    new_html = html.replace(
        '<div id="analiza-machine-details" class="rep-page" style="display:none; animation: fadeIn 0.3s ease;">\n    \n    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">',
        '<div id="analiza-machine-details" class="rep-page" style="display:none; animation: fadeIn 0.3s ease;">\n  <div class="glass-card" style="padding: 24px;">\n    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">'
    )
    
    # Insert closing tag at the end (before the last </div> of this section)
    # The last part looks like:
    # </div>\n      </div>\n\n      <!-- Optimizare Sală -->
    # We replace the last </div>\n      </div> with </div>\n      </div>\n      </div>
    
    idx = new_html.rfind('</div>\n      </div>')
    if idx != -1:
        new_html = new_html[:idx] + '</div>\n      </div>\n      </div>\n'
    
    content = content[:start] + new_html + content[end:]
    
    with open("index.html", "w") as f:
        f.write(content)
    print("Fixed layout")
