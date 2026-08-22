import re
with open("index.html", "r") as f:
    content = f.read()

start = content.find('<div id="analiza-machine-details"')
if start != -1:
    end = content.find('<!-- Content Area -->', start)
    print(content[start:end])
