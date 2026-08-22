with open("index.html", "r") as f:
    content = f.read()

start = content.find('<div id="analiza-machine-details"')
if start != -1:
    end = content.find('</div>\n  <!-- Machine Full Details Page End -->', start)
    if end == -1:
        end = content.find('  <!-- /Machine Full Details Page -->', start)
    if end == -1:
        # fallback, find by next rep-page or something
        end = content.find('    </div>\n  </div>', start) + 17
    
    details_block = content[start:end]
    
    # insert it right after the closing div of view-analiza's last inner element, or inside view-analiza
    view_analiza = content.find('<div id="view-analiza"')
    end_of_padding = content.find('</div>', content.find('<!-- Editor Floorplan -->'))
    # Actually just put it right before the last closing divs of view-analiza
    
    # Let's just find exactly where it is and cut it out
    if start != -1:
        # It's currently at the very bottom
        pass
