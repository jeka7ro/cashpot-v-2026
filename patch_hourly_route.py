import re

with open('server.py', 'r') as f:
    content = f.read()

old_route = """@app.route('/api/reports/hourly')
def reports_hourly():
    sync_hourly_incomes()"""

new_route = """import threading
@app.route('/api/reports/hourly')
def reports_hourly():
    threading.Thread(target=sync_hourly_incomes).start()"""

content = content.replace(old_route, new_route)

with open('server.py', 'w') as f:
    f.write(content)

