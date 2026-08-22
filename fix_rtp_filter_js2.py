import re
with open("app.js", "r") as f:
    content = f.read()

start = content.find('window.filterRtpTable = function() {')
if start != -1:
    end = content.find('renderTablePaginated(\'analiza-rtp\');', start)
    func = content[start:end+50]
    
    # We need to make sure zile calculation is accurate for filtering too!
    new_func = func.replace(
        "const matchZile = String(r.zile || '').toLowerCase().includes(zile);",
        "const calcZile = (r.install_date ? Math.max(1, Math.floor((new Date() - new Date(r.install_date.replace(' ', 'T'))) / (1000 * 60 * 60 * 24))) : 0);\n      const matchZile = String(calcZile).includes(zile);"
    )
    
    content = content[:start] + new_func + content[end+50:]
    with open("app.js", "w") as f:
        f.write(content)
    print("Fixed filter function for zile")
