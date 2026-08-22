import re
with open("app.js", "r") as f:
    content = f.read()

start = content.find('window.openMachineDetails')
if start != -1:
    end = content.find('{', start)
    print(content[start:end+1])
