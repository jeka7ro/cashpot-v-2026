import re

with open('server.py', 'r') as f:
    content = f.read()

old_func = """def api_player_details(pid):
    # Base info
    player = qry_one("SELECT id, first_name, last_name, phone, points/100 as points, total_bets/100 as total_bets, avg_bet/100 as avg_bet FROM players WHERE id = %s", [pid])
    if not player:
        return jsonify({'error': 'Player not found'}), 404

    start = request.args.get('start')
    end   = request.args.get('end')
    
    date_filter = ''
    date_params = [pid]
    if start and end:
        date_filter = ' AND DATE(pcl.created_at) >= %s AND DATE(pcl.created_at) <= %s'
        date_params = [pid, start, end]
        
    # Sessions with daily machine stats — shows machine IN/GGR on days the player was active
    sessions = qry(f'''
        SELECT 
            pcl.created_at,
            REPLACE(COALESCE(l.display_code, l.code), ' E.S', '') as locatie,
            m.slot_machine_id as serial_nr,
            m.id as machine_id,
            mm.name as producator,
            mt.name as mix,
            mct.name as cabinet,
            (SELECT rg.name FROM machine_real_time_activities rta2
             LEFT JOIN machine_games rg ON rg.id = rta2.machine_game_id
             WHERE rta2.machine_id = m.id ORDER BY rta2.updated_at DESC LIMIT 1) as joc,
            COALESCE((SELECT SUM(mas.`in`)  FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as `in`,
            COALESCE((SELECT SUM(mas.`out`) FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as `out`,
            COALESCE((SELECT SUM(mas.bet)   FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as bet,
            COALESCE((SELECT SUM(mas.`in` - mas.`out`) FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as ggr
        FROM player_card_logs pcl
        JOIN machines m ON m.id = JSON_UNQUOTE(JSON_EXTRACT(pcl.params, '$.machine_id'))
        LEFT JOIN machine_types mt ON m.machine_type_id = mt.id
        LEFT JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id
        LEFT JOIN machine_cabinet_types mct ON m.cabinet_type_id = mct.id
        LEFT JOIN locations l ON pcl.location_id = l.id
        WHERE pcl.player_id = %s AND pcl.log_type = 2
        {date_filter}
        ORDER BY pcl.created_at DESC
        LIMIT 200
    ''', date_params)
    
    result_sessions = []
    seen_machine_day = set()  # Deduplicate: count each (machine, day) once for totals
    for s in sessions:
        row = dict(s)
        row['created_at'] = str(s['created_at'])
        row['in']  = float(s.get('in')  or 0)
        row['out'] = float(s.get('out') or 0)
        row['bet'] = float(s.get('bet') or 0)
        row['ggr'] = float(s.get('ggr') or 0)
        # Flag duplicate (machine, day) — frontend uses this to avoid double-counting in totals
        key = (s['machine_id'], str(s['created_at'])[:10])
        row['counted'] = key not in seen_machine_day
        seen_machine_day.add(key)
        result_sessions.append(row)
        

    return jsonify({
        'player': player,
        'sessions': result_sessions
    })"""

new_func = """def sync_player_sessions_incremental():
    try:
        import datetime
        conn = get_pg_conn()
        c = conn.cursor()
        c.execute("SELECT MAX(dt) FROM cp2_player_sessions")
        row = c.fetchone()
        max_dt = row[0] if row and row[0] else None
        
        now = datetime.datetime.now()
        cutoff_date = (now - datetime.timedelta(hours=8)).date()
        
        if max_dt is None:
            start_date = cutoff_date - datetime.timedelta(days=30)
        else:
            start_date = max_dt
            
        if start_date >= cutoff_date:
            conn.close()
            return
            
        mysql_sql = '''
            SELECT 
                DATE(ppb.bet_at - INTERVAL 8 HOUR) as dt,
                ppb.player_id, ppb.machine_id, m.location_id,
                SUM(ppb.total_bet) as total_bet, SUM(ppb.points) as points
            FROM player_points_bets ppb
            LEFT JOIN machines m ON ppb.machine_id = m.id
            WHERE DATE(ppb.bet_at - INTERVAL 8 HOUR) >= %s 
              AND DATE(ppb.bet_at - INTERVAL 8 HOUR) < %s AND ppb.total_bet > 0
            GROUP BY 1, 2, 3, 4
        '''
        mysql_data = qry(mysql_sql, [start_date.strftime('%Y-%m-%d'), cutoff_date.strftime('%Y-%m-%d')])
        
        if mysql_data:
            for row in mysql_data:
                try:
                    c.execute('''
                        INSERT INTO cp2_player_sessions 
                        (dt, player_id, location_id, machine_id, total_bet, points)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (dt, player_id, machine_id) DO UPDATE SET
                            total_bet = cp2_player_sessions.total_bet + EXCLUDED.total_bet,
                            points = cp2_player_sessions.points + EXCLUDED.points
                    ''', (
                        row['dt'], str(row['player_id']), str(row['location_id']), str(row['machine_id']),
                        row['total_bet'] or 0, row['points'] or 0
                    ))
                except:
                    pass
            conn.commit()
        conn.close()
    except Exception as e:
        print("Error sync_player_sessions:", e)

@app.route('/api/players/<int:pid>')
@app.route('/api/players/<int:pid>/details')
def api_player_details(pid):
    sync_player_sessions_incremental()
    
    player = qry_one("SELECT id, first_name, last_name, phone, points/100 as points, total_bets/100 as total_bets, avg_bet/100 as avg_bet FROM players WHERE id = %s", [pid])
    if not player:
        return jsonify({'error': 'Player not found'}), 404

    start = request.args.get('start')
    end   = request.args.get('end')
    
    date_filter = ''
    date_params = [pid]
    if start and end:
        date_filter = ' AND DATE(pcl.created_at - INTERVAL 8 HOUR) >= %s AND DATE(pcl.created_at - INTERVAL 8 HOUR) <= %s'
        date_params = [pid, start, end]
        
    sessions = qry(f'''
        SELECT 
            pcl.created_at,
            DATE(pcl.created_at - INTERVAL 8 HOUR) as dt,
            REPLACE(COALESCE(l.display_code, l.code), ' E.S', '') as locatie,
            m.slot_machine_id as serial_nr,
            m.id as machine_id,
            mm.name as producator,
            mt.name as mix,
            mct.name as cabinet,
            (SELECT rg.name FROM machine_real_time_activities rta2
             LEFT JOIN machine_games rg ON rg.id = rta2.machine_game_id
             WHERE rta2.machine_id = m.id ORDER BY rta2.updated_at DESC LIMIT 1) as joc
        FROM player_card_logs pcl
        JOIN machines m ON m.id = JSON_UNQUOTE(JSON_EXTRACT(pcl.params, '$.machine_id'))
        LEFT JOIN machine_types mt ON m.machine_type_id = mt.id
        LEFT JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id
        LEFT JOIN machine_cabinet_types mct ON m.cabinet_type_id = mct.id
        LEFT JOIN locations l ON pcl.location_id = l.id
        WHERE pcl.player_id = %s AND pcl.log_type = 2
        {date_filter}
        ORDER BY pcl.created_at DESC
        LIMIT 200
    ''', date_params)
    
    # Pre-fetch Postgres historical data
    pg_rows = pg_qry("SELECT dt, machine_id, total_bet, points FROM cp2_player_sessions WHERE player_id = %s", [str(pid)])
    pg_dict = {}
    for r in pg_rows:
        pg_dict[(str(r['dt']), str(r['machine_id']))] = {'total_bet': float(r['total_bet'] or 0), 'points': float(r['points'] or 0)}
        
    # Pre-fetch MySQL live data for today
    import datetime
    now = datetime.datetime.now()
    cutoff_date = (now - datetime.timedelta(hours=8)).date()
    live_rows = qry("SELECT DATE(bet_at - INTERVAL 8 HOUR) as dt, machine_id, SUM(total_bet) as total_bet, SUM(points) as points FROM player_points_bets WHERE player_id = %s AND DATE(bet_at - INTERVAL 8 HOUR) >= %s GROUP BY 1, 2", [pid, cutoff_date.strftime('%Y-%m-%d')])
    live_dict = {}
    for r in live_rows:
        live_dict[(str(r['dt']), str(r['machine_id']))] = {'total_bet': float(r['total_bet'] or 0), 'points': float(r['points'] or 0)}
    
    result_sessions = []
    seen_machine_day = set()
    for s in sessions:
        row = dict(s)
        dt_str = str(s['dt'])
        mid = str(s['machine_id'])
        row['created_at'] = str(s['created_at'])
        
        # Merge data from cache or live
        if dt_str >= cutoff_date.strftime('%Y-%m-%d'):
            metrics = live_dict.get((dt_str, mid), {'total_bet': 0, 'points': 0})
        else:
            metrics = pg_dict.get((dt_str, mid), {'total_bet': 0, 'points': 0})
            
        row['total_bet'] = metrics['total_bet']
        row['points'] = metrics['points']
        
        key = (s['machine_id'], dt_str)
        row['counted'] = key not in seen_machine_day
        seen_machine_day.add(key)
        result_sessions.append(row)

    return jsonify({
        'player': player,
        'sessions': result_sessions
    })"""

if "def api_player_details(pid):" in content:
    # Use re.sub to replace the old function block
    pattern = r"@app\.route\('/api/players/<int:pid>'\).*?return jsonify\(\{.*?\}\)"
    content = re.sub(pattern, new_func, content, flags=re.DOTALL)
    with open('server.py', 'w') as f:
        f.write(content)
    print("Patched server.py")
else:
    print("Could not find api_player_details in server.py")
