import re

with open('server.py', 'r') as f:
    content = f.read()

# Revert to payment_types
new_api = """
@app.route('/api/admin/expenses_config', methods=['GET'])
def get_expenses_config():
    cfg = get_exp_config()
    deps = pg_qry("SELECT id, name FROM casino_departments ORDER BY name;")
    types = pg_qry("SELECT id, name FROM casino_payment_types ORDER BY name;")
    
    return jsonify({
        "departments": [{"id": str(d['id']), "name": d['name'], "is_expense": str(d['id']) not in cfg.get('excluded_departments', [])} for d in deps],
        "types": [{"id": str(t['id']), "name": t['name'], "is_expense": str(t['id']) not in cfg.get('excluded_types', [])} for t in types]
    })
"""

content = re.sub(r"@app\.route\('/api/admin/expenses_config', methods=\['GET'\]\)\ndef get_expenses_config\(\).*?\]\)\n    \}\)", new_api.strip(), content, flags=re.DOTALL)

with open('server.py', 'w') as f:
    f.write(content)
