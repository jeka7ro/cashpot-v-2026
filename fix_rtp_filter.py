with open("index.html", "r") as f:
    content = f.read()

start = content.find('<tr class="filter-row">')
if start != -1:
    end = content.find('</tr>', start)
    print(content[start:end+5])
