import re
with open("index.html", "r") as f:
    content = f.read()

# Make the page look normal by removing left/top padding/position absolute that made it float weirdly without header
start = content.find('id="analiza-machine-details"')
if start != -1:
    end = content.find('>', start)
    div_html = content[start:end]
    new_div = 'id="analiza-machine-details" class="rep-page" style="display:none; animation: fadeIn 0.3s ease;"'
    content = content[:start] + new_div + content[end:]
    with open("index.html", "w") as f:
        f.write(content)
        
    print("Fixed div style")
