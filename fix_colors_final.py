import re
with open("index.html", "r") as f:
    content = f.read()

# Fix the styling on the stat cards explicitly to have normal font colors
# The text that was white (#fff) was changed to var(--text), let's make sure
start = content.find('id="md-stat-in"')
if start != -1:
    print(content[start-50:start+100])
