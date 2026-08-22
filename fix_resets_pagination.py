with open("index.html", "r") as f:
    content = f.read()

start = content.find('<!-- Table Container -->', content.find('<div id="analiza-resets"'))
if start != -1:
    end = content.find('</div>\n      </div>\n\n      <!-- Optimizare Sală -->', start)
    
    html = content[start:end]
    
    new_html = html.replace(
        '</table>\n          </div>\n\n          <!-- Table Footer Pagination -->\n          <div id="pg-analiza-resets" style="border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;"></div>\n\n        </div>',
        '</table>\n            <!-- Table Footer Pagination -->\n            <div id="pg-analiza-resets" style="border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;"></div>\n          </div>\n\n        </div>'
    )
    
    content = content[:start] + new_html + content[end:]
    with open("index.html", "w") as f:
        f.write(content)
        
    print("Fixed pagination layout in resets")
