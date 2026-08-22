import re
with open("index.html", "r") as f:
    content = f.read()

start = content.find('<div id="analiza-machine-details"')
if start != -1:
    end = content.find('<!-- Performanță Staff -->', start)
    
    # We want to put the whole content in a <div class="glass-card">
    new_html = content[start:end]
    new_html = new_html.replace(
        '<div id="analiza-machine-details" class="rep-page" style="display:none; animation: fadeIn 0.3s ease;">\n    \n    <div style="display:flex;',
        '<div id="analiza-machine-details" class="rep-page" style="display:none; animation: fadeIn 0.3s ease;">\n  <div class="glass-card" style="padding:24px;">\n    <div style="display:flex;'
    )
    
    new_html = new_html.replace(
        '</div>\n\n      <!-- Optimizare Sală -->',
        '</div>\n  </div>\n\n      <!-- Optimizare Sală -->' # Actually, let's just do it manually via a Python script
    )
