import re

with open('server.py', 'r') as f:
    content = f.read()

new_pl = """def api_pl_heatmap():
    sync_historical_incomes()
    
    lf_mysql, lp_mysql = loc_filter(request, alias='mas')
    
    # Build a specific pg filter because cp2_daily_incomes uses varchar for location_id
    lf_pg = ""
    lp_pg = []
    ids_raw = request.args.get('loc_ids', '')
    if ids_raw:
        try:
            ids = [int(x) for x in ids_raw.split(',') if x.strip().isdigit()]
            expanded = set()
            from server import LOC_CHILDREN
            for i in ids:
                expanded.add(i)
                expanded.update(LOC_CHILDREN.get(i, []))
            if expanded:
                ph = ','.join(['%s'] * len(expanded))
                lf_pg = f" AND cp.location_id::int IN ({ph})"
                lp_pg = list(expanded)
        except:
            pass

    mysql_locs = qry("SELECT id, COALESCE(display_code, code) as name FROM locations")
    mysql_name_map = {str(l['id']): l['name'] for l in mysql_locs}

    # 1. Postgres historical query (up to yesterday)
    pg_sql = f\"\"\"
        SELECT 
            TO_CHAR(cp.date, 'YYYY-MM') AS month,
            cp.location_id,
            SUM(cp.total_ggr) as ngr
        FROM cp2_daily_incomes cp
        WHERE cp.date >= CURRENT_DATE - INTERVAL '12 months'
          AND cp.date < CURRENT_DATE
        {lf_pg}
        GROUP BY month, cp.location_id
    \"\"\"
    pg_rev_rows = pg_qry(pg_sql, lp_pg)
    
    # 2. MySQL today query
    mysql_sql = f\"\"\"
        SELECT 
            DATE_FORMAT(mas.date, '%%Y-%%m') AS month,
            mas.location_id,
            SUM(mas.`in`-mas.`out`) as ngr
        FROM machine_audit_summaries mas
        WHERE mas.date = CURDATE()
        {lf_mysql}
        GROUP BY month, mas.location_id
    \"\"\"
    mysql_rev_rows = qry(mysql_sql, lp_mysql)
    
    # Combine results
    combined_rev = {}
    
    for r in pg_rev_rows:
        key = (r['month'], str(r['location_id']))
        if key not in combined_rev:
            combined_rev[key] = {'month': r['month'], 'location_id': str(r['location_id']), 'ngr': 0}
        combined_rev[key]['ngr'] += float(r['ngr'])
        
    for r in mysql_rev_rows:
        key = (r['month'], str(r['location_id']))
        if key not in combined_rev:
            combined_rev[key] = {'month': r['month'], 'location_id': str(r['location_id']), 'ngr': 0}
        combined_rev[key]['ngr'] += float(r['ngr'] or 0)
        
    # Format for output
    rev_rows = []
    for k, v in combined_rev.items():
        rev_rows.append({
            'month': v['month'],
            'location_name': mysql_name_map.get(v['location_id'], 'Unknown'),
            'ngr': v['ngr']
        })
"""

# Regex substitute the whole function from def api_pl_heatmap(): up to rev_rows = qry(mysql_sql, lp)
pattern = r"def api_pl_heatmap\(\):.*?rev_rows = qry\(mysql_sql, lp\)"
content = re.sub(pattern, new_pl, content, flags=re.DOTALL)

with open('server.py', 'w') as f:
    f.write(content)
print("Patch successful!")

