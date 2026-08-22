import re
with open("app.js", "r") as f:
    content = f.read()

start = content.find('window.filterRtpTable = function() {')
if start != -1:
    end = content.find('renderTablePaginated(\'analiza-rtp\');', start)
    func = content[start:end+50]
    
    if 'document.getElementById(\'flt-rtp-zile\')' not in func:
        # Need to add zile to filter
        new_func = func.replace(
            "const serial = document.getElementById('flt-rtp-serial').value.toLowerCase();",
            "const serial = document.getElementById('flt-rtp-serial').value.toLowerCase();\n  const zile = document.getElementById('flt-rtp-zile').value.toLowerCase();"
        )
        new_func = new_func.replace(
            "const matchSerial = (r.serial||'').toLowerCase().includes(serial);",
            "const matchSerial = (r.serial||'').toLowerCase().includes(serial);\n      const matchZile = (String(r.zile||'')).toLowerCase().includes(zile);"
        )
        new_func = new_func.replace(
            "if (matchLoc && matchProd && matchSerial)",
            "if (matchLoc && matchProd && matchSerial && matchZile)"
        )
        
        content = content[:start] + new_func + content[end+50:]
        with open("app.js", "w") as f:
            f.write(content)
        print("Updated filter function in app.js")
