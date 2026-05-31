import re

with open('server.py', 'r') as f:
    content = f.read()

# Update get_expenses_config
new_api = """
@app.route('/api/admin/expenses_config', methods=['GET'])
def get_expenses_config():
    cfg = get_exp_config()
    deps = pg_qry("SELECT id, name FROM casino_departments ORDER BY name;")
    # types = pg_qry("SELECT id, name FROM casino_payment_types ORDER BY name;")
    etypes = pg_qry("SELECT id, name, department_id FROM casino_expenditure_types ORDER BY name;")
    
    return jsonify({
        "departments": [{"id": str(d['id']), "name": d['name'], "is_expense": str(d['id']) not in cfg.get('excluded_departments', [])} for d in deps],
        "expenditure_types": [{"id": str(t['id']), "name": t['name'], "department_id": str(t['department_id']), "is_expense": str(t['id']) not in cfg.get('excluded_types', [])} for t in etypes]
    })
"""

content = re.sub(r"@app\.route\('/api/admin/expenses_config', methods=\['GET'\]\)\ndef get_expenses_config\(\).*?\]\)\n    \}\)", new_api.strip(), content, flags=re.DOTALL)

with open('server.py', 'w') as f:
    f.write(content)
