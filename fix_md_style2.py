with open("index.html", "r") as f:
    content = f.read()

start = content.find('<div id="analiza-machine-details"')
if start != -1:
    end = content.find('<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">', start)
    
    # Needs to match standard rep-page layout without absolute positioning
    # It currently is: <div id="analiza-machine-details" class="rep-page" style="display:none; animation: fadeIn 0.3s ease;">\n  <div class="glass-card" style="padding: 24px;">\n
    
    # We will let it be exactly this, which looks right. The dark background was from "background:var(--bg)", which we removed.
    
    pass
