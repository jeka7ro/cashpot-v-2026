with open("index.html", "r") as f:
    content = f.read()

start = content.find('<!-- Machine Full Details Page -->')
if start != -1:
    end = content.find('<h3 class="glass-title"', start)
    html = content[start:end]
    
    # User complains about the Back button missing or not working.
    # It says:
    # <button onclick="closeMachineDetails()" class="btn btn-secondary" style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
    #   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    #   Înapoi la Performanță Reset
    # </button>
    
    # Wait, the class might be "btn btn-secondary" which makes it look weird in light mode, or maybe it's not visible.
    new_html = html.replace('class="btn btn-secondary"', 'class="btn-secondary"') # Standard app uses btn-secondary
    
    content = content[:start] + new_html + content[end:]
    with open("index.html", "w") as f:
        f.write(content)
        
    print("Fixed back button")
