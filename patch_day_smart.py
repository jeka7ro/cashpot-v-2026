import re

with open('server.py', 'r') as f:
    content = f.read()

old_mas_totals = """    # Totals from machine_audit_summaries
    lf_mas, lp_mas = loc_filter(request, alias='mas')
    mas_totals = qry(f\"\"\"
        SELECT 
            SUM(mas.jackpot) as jp, 
            SUM(mas.cb_fortune_wheel) as wh, 
            SUM(mas.cashback) as cb 
        FROM machine_audit_summaries mas 
        WHERE mas.date >= %s AND mas.date <= %s {lf_mas}
    \"\"\", [start, end] + lp_mas)[0]"""

new_mas_totals = """    # Totals from machine_audit_summaries
    lf_mas, lp_mas = loc_filter(request, alias='mas')
    
    # PG Filter
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
                lf_pg = f" AND mas.location_id::int IN ({ph})"
                lp_pg = list(expanded)
        except:
            pass
            
    import datetime
    now = datetime.datetime.now()
    cutoff = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if now < cutoff:
        cutoff = cutoff - datetime.timedelta(days=1)
    
    cutoff_str = cutoff.strftime('%Y-%m-%d %H:%M:%S')
    end_dt_str = end + " 23:59:59"
    
    pg_totals = pg_qry(f\"\"\"
        SELECT 
            SUM(mas.jackpot) as jp, 
            SUM(mas.cb_fortune_wheel) as wh, 
            SUM(mas.cashback) as cb 
        FROM cp2_hourly_incomes mas 
        WHERE mas.dt >= %s AND mas.dt <= %s AND mas.dt < %s {lf_pg}
    \"\"\", [start, end_dt_str, cutoff_str] + lp_pg)[0]
    
    mysql_totals = qry(f\"\"\"
        SELECT 
            SUM(mas.jackpot) as jp, 
            SUM(mas.cb_fortune_wheel) as wh, 
            SUM(mas.cashback) as cb 
        FROM machine_audit_summary_per_hours mas 
        WHERE mas.date >= %s AND mas.date <= %s AND mas.date >= %s {lf_mas}
    \"\"\", [start, end_dt_str, cutoff_str] + lp_mas)[0]
    
    mas_totals = {
        'jp': (pg_totals['jp'] or 0) + (mysql_totals['jp'] or 0),
        'wh': (pg_totals['wh'] or 0) + (mysql_totals['wh'] or 0),
        'cb': (pg_totals['cb'] or 0) + (mysql_totals['cb'] or 0),
    }"""

if old_mas_totals in content:
    content = content.replace(old_mas_totals, new_mas_totals)
    with open('server.py', 'w') as f:
        f.write(content)
    print("Patched day_smart")
else:
    print("Could not find old_mas_totals")
