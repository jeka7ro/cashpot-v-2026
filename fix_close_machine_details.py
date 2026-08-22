import re
with open("app.js", "r") as f:
    content = f.read()

start = content.find('window.closeMachineDetails = function() {')
if start != -1:
    end = content.find('};', start)
    func = content[start:end+2]
    print(func)
