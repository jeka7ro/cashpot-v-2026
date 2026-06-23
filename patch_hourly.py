import re

with open('server.py', 'r') as f:
    content = f.read()

new_hourly = """def reports_hourly():
    sync_hourly_incomes()
    
    start, end = period_params(request)
    lf_mysql, lp_mysql = loc_filter(request, alias='mas')
    
    prov_id = request.args.get('prov_id', '')
    if prov_id:
        lf_mysql += " AND mas.machine_type_id = %s "
        lp_mysql.append(prov_id)
        
    end_dt = end + ' 23:59:59'
    
    import datetime
    now = datetime.datetime.now()
    cutoff = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if now < cutoff:
        cutoff = cutoff - datetime.timedelta(days=1)
    
    cutoff_str = cutoff.strftime('%Y-%m-%d %H:%M:%S')
    
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
            
    if prov_id:
        lf_pg += " AND mas.machine_type_id = %s "
        lp_pg.append(str(prov_id))
    
    # Postgres query for historical data (up to cutoff)
    pg_sql = f\"\"\"
        SELECT
            mas.dt as dt,
            mas.location_id,
            mas.machine_id as serial_nr,
            mas.machine_type_id,
            mas.total_in as "in", mas.total_out as "out", mas.total_in - mas.total_out as ggr,
            mas.games, mas.bet, mas.win, mas.jackpot, mas.hh
        FROM cp2_hourly_incomes mas
        WHERE mas.dt >= %s AND mas.dt <= %s AND mas.dt < %s AND mas.total_in > 0
    \"\"\" + lf_pg + \"\"\"
        ORDER BY mas.dt DESC, mas.total_in DESC
    \"\"\"
    pg_rows = pg_qry(pg_sql, [start, end_dt, cutoff_str] + lp_pg)
    
    # MySQL query for today (after cutoff)
    mysql_sql = f\"\"\"
        SELECT
            mas.date as dt,
            mas.location_id,
            mas.machine_id,
            m.slot_machine_id as serial_nr,
            COALESCE(NULLIF(mm.name,''), NULLIF(mt.manufacturer,''), 'Necunoscut') as provider,
            mas.`in`, mas.`out`, mas.`in`-mas.`out` as ggr,
            mas.games, mas.bet, mas.win, mas.jackpot, mas.hh,
            CONCAT(p.first_name, ' ', p.last_name) as player_name
        FROM machine_audit_summary_per_hours mas
        LEFT JOIN locations l ON mas.location_id = l.id
        LEFT JOIN machines m ON mas.machine_id = m.id
        LEFT JOIN machine_types mt ON mas.machine_type_id = mt.id
        LEFT JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id
        LEFT JOIN players p ON m.player_id = p.id
        WHERE mas.date >= %s AND mas.date <= %s AND mas.date >= %s AND mas.`in` > 0
    \"\"\" + lf_mysql + \"\"\"
        ORDER BY mas.date DESC, mas.`in` DESC
    \"\"\"
    mysql_rows = qry(mysql_sql, [start, end_dt, cutoff_str] + lp_mysql)
    
    # Post-process PG rows (add name/provider/player)
    # We can pre-fetch mappings from MySQL
    machines_map = qry("SELECT m.id as machine_id, m.slot_machine_id, COALESCE(NULLIF(mm.name,''), NULLIF(mt.manufacturer,''), 'Necunoscut') as provider, CONCAT(p.first_name, ' ', p.last_name) as player_name FROM machines m LEFT JOIN machine_types mt ON m.machine_type_id = mt.id LEFT JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id LEFT JOIN players p ON m.player_id = p.id")
    m_dict = {str(r['machine_id']): r for r in machines_map}
    
    combined = []
    for r in mysql_rows:
        if r.get('dt'):
            r['dt'] = str(r['dt'])
        r['locatie'] = LOC_NAMES.get(r.get('location_id'), '—')
        combined.append(r)
        
    for r in pg_rows:
        mid = str(r.get('serial_nr')) # It was stored as machine_id actually
        m_info = m_dict.get(mid, {})
        r['serial_nr'] = m_info.get('slot_machine_id', mid)
        r['provider'] = m_info.get('provider', 'Necunoscut')
        r['player_name'] = m_info.get('player_name', None)
        
        if r.get('dt'):
            r['dt'] = str(r['dt'])
        r['locatie'] = LOC_NAMES.get(r.get('location_id'), '—')
        
        # Format numbers
        for k in ['in', 'out', 'ggr', 'games', 'bet', 'win', 'jackpot', 'hh']:
            if r.get(k) is not None:
                r[k] = float(r[k])
        
        combined.append(r)
        
    # Sort combined
    combined.sort(key=lambda x: (x['dt'], x['in']), reverse=True)
        
    return jsonify(combined)"""

pattern = r"def reports_hourly\(\):.*?return jsonify\(rows\)"
content = re.sub(pattern, new_hourly, content, flags=re.DOTALL)

with open('server.py', 'w') as f:
    f.write(content)
print("Patched api_reports_hourly")
