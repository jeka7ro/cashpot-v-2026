with open("index.html", "r") as f:
    content = f.read()

start = content.find('<!-- Machine Full Details Page -->')
if start != -1:
    end = content.find('<!-- Optimizare Sală -->', start)
    html = content[start:end]
    
    # Let's fix the text color of the stats cards and the back button
    # The back button in the user's UI is supposed to be obvious.
    new_html = html.replace('<button onclick="closeMachineDetails()" class="btn-secondary"', 
                            '<button onclick="closeMachineDetails()" class="btn-primary"')
                            
    content = content[:start] + new_html + content[end:]
    with open("index.html", "w") as f:
        f.write(content)
        
    print("Fixed back button again")
