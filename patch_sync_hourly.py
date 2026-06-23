with open('server.py', 'r') as f:
    content = f.read()

with open('sync_hourly_func.py', 'r') as f:
    sync_func = f.read()

if "def sync_hourly_incomes():" not in content:
    # Insert right before reports_hourly
    content = content.replace("@app.route('/api/reports/hourly')", sync_func + "\n@app.route('/api/reports/hourly')")
    with open('server.py', 'w') as f:
        f.write(content)
    print("Patched server.py with sync_hourly_incomes")
else:
    print("Already patched")
