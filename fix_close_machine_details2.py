import re
with open("app.js", "r") as f:
    content = f.read()

start = content.find('window.openMachineDetails = async function(serial, current_page_id) {')
if start != -1:
    print("Found it!")
else:
    print("Not found")
