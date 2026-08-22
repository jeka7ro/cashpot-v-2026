import re
with open("index.html", "r") as f:
    content = f.read()

# Verify no absolute position is lingering
print("Absolute in string:", 'position:absolute' in content[content.find('analiza-machine-details'):content.find('analiza-machine-details')+200])

