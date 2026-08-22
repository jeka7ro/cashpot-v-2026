import re
with open("index.html", "r") as f:
    content = f.read()

start = content.find('<tr class="filter-row">')
if start != -1:
    end = content.find('</tr>', start)
    filter_html = content[start:end+5]
    if '<th colspan="8"></th>' in filter_html:
        new_filter = filter_html.replace('<th colspan="8"></th>', '<th colspan="7"></th>')
        content = content[:start] + new_filter + content[end+5:]
        with open("index.html", "w") as f:
            f.write(content)
        print("Fixed colspan again just to be safe")
