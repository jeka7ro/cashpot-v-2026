import re
import os
import json

with open('server.py', 'r') as f:
    content = f.read()

expenses_config_logic = """
import json
import os

EXP_CFG_FILE = 'expenses_config.json'

def get_exp_config():
    if os.path.exists(EXP_CFG_FILE):
        try:
            with open(EXP_CFG_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {"excluded_departments": [], "excluded_types": []}

@app.route('/api/admin/expenses_config', methods=['GET'])
def get_expenses_config():
    cfg = get_exp_config()
    deps = pg_qry("SELECT id, name FROM casino_departments ORDER BY name;")
    types = pg_qry("SELECT id, name FROM casino_payment_types ORDER BY name;")
    
    return jsonify({
        "departments": [{"id": str(d['id']), "name": d['name'], "is_expense": str(d['id']) not in cfg.get('excluded_departments', [])} for d in deps],
        "types": [{"id": str(t['id']), "name": t['name'], "is_expense": str(t['id']) not in cfg.get('excluded_types', [])} for t in types]
    })

@app.route('/api/admin/expenses_config', methods=['POST'])
def save_expenses_config():
    data = request.json or {}
    cfg = get_exp_config()
    
    if 'excluded_departments' in data:
        cfg['excluded_departments'] = data['excluded_departments']
    if 'excluded_types' in data:
        cfg['excluded_types'] = data['excluded_types']
        
    with open(EXP_CFG_FILE, 'w') as f:
        json.dump(cfg, f)
    return jsonify({"success": True})
"""

# Now we need to modify the SQL queries in both `/api/kpi` and `/api/reports/expenses` to filter out excluded.
# Finding the pg_loc_where and injecting exclusion logic.

kpi_exp_patch = """
    cfg = get_exp_config()
    excl_deps = cfg.get('excluded_departments', [])
    excl_types = cfg.get('excluded_types', [])
    
    pg_excl_where = ""
    if excl_deps:
        ph_d = ','.join([f"'{d}'" for d in excl_deps])
        pg_excl_where += f" AND (department_id IS NULL OR department_id::text NOT IN ({ph_d}))"
    if excl_types:
        ph_t = ','.join([f"'{t}'" for t in excl_types])
        pg_excl_where += f" AND (type_id IS NULL OR type_id::text NOT IN ({ph_t}))"

    exp_res = pg_qry(f\"\"\"
        SELECT SUM(amount) as s 
        FROM casino_payments 
        WHERE direction = 1 AND date >= %s AND date <= %s {pg_loc_where} {pg_excl_where}
    \"\"\", pg_params)
"""

rep_exp_patch = """
    cfg = get_exp_config()
    excl_deps = cfg.get('excluded_departments', [])
    excl_types = cfg.get('excluded_types', [])
    
    pg_excl_where = ""
    if excl_deps:
        ph_d = ','.join([f"'{d}'" for d in excl_deps])
        pg_excl_where += f" AND (p.department_id IS NULL OR p.department_id::text NOT IN ({ph_d}))"
    if excl_types:
        ph_t = ','.join([f"'{t}'" for t in excl_types])
        pg_excl_where += f" AND (p.type_id IS NULL OR p.type_id::text NOT IN ({ph_t}))"

    rows = pg_qry(f\"\"\"
        SELECT
            p.date,
            p.operational_date,
            p.explanation,
            p.amount,
            cl.name AS location_name,
            cd.name AS department_name,
            pt.name AS type_name,
            et.name AS expenditure_type_name,
            v.name AS vendor_name,
            p.other_info
        FROM casino_payments p
        LEFT JOIN casino_locations cl ON p.location_id = cl.id
        LEFT JOIN casino_departments cd ON p.department_id = cd.id
        LEFT JOIN casino_payment_types pt ON p.type_id = pt.id
        LEFT JOIN casino_expenditure_types et ON p.expenditure_type_id = et.id
        LEFT JOIN casino_vendors v ON p.vendor_id = v.id
        WHERE p.direction = 1 AND p.date >= %s AND p.date <= %s
        {pg_loc_where} {pg_excl_where}
        ORDER BY p.date DESC
    \"\"\", pg_params)
"""

if "def get_exp_config():" not in content:
    content = content.replace("def pg_qry(sql, params=None):", expenses_config_logic + "\ndef pg_qry(sql, params=None):")

content = re.sub(r"    exp_res = pg_qry\(f\"\"\"\n        SELECT SUM\(amount\) as s \n        FROM casino_payments \n        WHERE direction = 1 AND date >= %s AND date <= %s \{pg_loc_where\}\n    \"\"\", pg_params\)", kpi_exp_patch.strip(), content, flags=re.DOTALL)

content = re.sub(r"    rows = pg_qry\(f\"\"\"\n        SELECT\n            p\.date,.*?WHERE p\.direction = 1 AND p\.date >= %s AND p\.date <= %s\n        \{pg_loc_where\}\n        ORDER BY p\.date DESC\n    \"\"\", pg_params\)", rep_exp_patch.strip(), content, flags=re.DOTALL)

with open('server.py', 'w') as f:
    f.write(content)
