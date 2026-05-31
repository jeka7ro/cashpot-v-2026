import re

with open('server.py', 'r') as f:
    content = f.read()

expenses_endpoint = """
@app.route('/api/reports/expenses')
def api_expenses():
    start, end = period_params(request)
    
    mysql_locs = qry("SELECT id, code FROM locations")
    pg_locs = pg_qry("SELECT id, name FROM casino_locations")
    pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
    
    mysql_to_pg_map = {}
    for ml in mysql_locs:
        norm = normalize_loc_name(ml['code'])
        if norm in pg_name_to_id:
            mysql_to_pg_map[str(ml['id'])] = pg_name_to_id[norm]

    pg_loc_ids = []
    ids_raw = request.args.get('loc_ids', '')
    if ids_raw:
        try:
            ids = [x.strip() for x in ids_raw.split(',') if x.strip()]
            for i in ids:
                if i in mysql_to_pg_map:
                    pg_loc_ids.append(mysql_to_pg_map[i])
        except ValueError:
            pass
    else:
        pg_loc_ids = list(mysql_to_pg_map.values())

    pg_loc_where = ""
    pg_params = [start + ' 00:00:00', end + ' 23:59:59']
    if pg_loc_ids:
        ph = ','.join(['%s']*len(pg_loc_ids))
        pg_loc_where = f" AND p.location_id IN ({ph})"
        pg_params.extend(pg_loc_ids)
    else:
        pg_loc_where = " AND 1=0"

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
        {pg_loc_where}
        ORDER BY p.date DESC
    \"\"\", pg_params)
    
    data = []
    for r in rows:
        data.append({
            'date': str(r['date'])[:10] if r['date'] else '-',
            'explanation': r['explanation'] or '-',
            'amount': float(r['amount'] or 0),
            'location_name': r['location_name'] or '-',
            'department_name': r['department_name'] or '-',
            'type_name': r['type_name'] or '-',
            'expenditure_type_name': r['expenditure_type_name'] or '-',
            'vendor_name': r['vendor_name'] or '-'
        })
        
    return jsonify(data)
"""

if "/api/reports/expenses" not in content:
    content += expenses_endpoint

with open('server.py', 'w') as f:
    f.write(content)
