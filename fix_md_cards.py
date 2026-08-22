import re
with open("index.html", "r") as f:
    content = f.read()

# Fix the white color (#fff) on the lifetime cards since the user has a light background
content = content.replace('id="md-stat-in" style="font-size:28px; font-weight:800; color:#fff;"', 'id="md-stat-in" style="font-size:28px; font-weight:800; color:var(--text);"')
content = content.replace('id="md-stat-out" style="font-size:28px; font-weight:800; color:#fff;"', 'id="md-stat-out" style="font-size:28px; font-weight:800; color:var(--text);"')
content = content.replace('id="md-stat-jp" style="font-size:28px; font-weight:800; color:#fff;"', 'id="md-stat-jp" style="font-size:28px; font-weight:800; color:var(--text);"')

# Fix the md-mix text color to var(--text) instead of #text
content = content.replace('color:#text);', 'color:var(--text);')

with open("index.html", "w") as f:
    f.write(content)
print("Fixed card colors")
