with open("index.html", "r") as f:
    content = f.read()

start = content.find('<div id="analiza-machine-details"')
if start != -1:
    end = content.find('>', start)
    # The div has: background:var(--bg); z-index:50;
    # But var(--bg) is the dark main background, we want the white background var(--bg-card) or just remove background and let it be like a normal page, 
    # Wait, the user said "IERSTE IN CONTIANRUL TABELUL IBANI" (iese din containerul tabelului) and "ARATA CA O PULA CULORILE LA CARDURI... CE CAUTI SA FACI MIZERIE DIN NEGRI LA MINE IN APLICATIE"
    # Ah, the lifetime cards have color:#fff, but the app is in light mode. Let's fix the text colors to var(--text).
    
    # Let's fix the machine details div styling to match other pages. It currently has:
    # style="display:none; animation: fadeIn 0.3s ease; position:absolute; top:80px; left:250px; right:0; bottom:0; background:var(--bg); z-index:50; padding:24px; overflow-y:auto;"
    
    # We should just make it a normal rep-page, no absolute positioning!
    new_div = '<div id="analiza-machine-details" class="rep-page" style="display:none; animation: fadeIn 0.3s ease;">'
    content = content[:start] + new_div + content[end+1:]
    
    with open("index.html", "w") as f:
        f.write(content)
    print("Fixed container style")
