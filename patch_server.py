import re

with open('server.py', 'r') as f:
    code = f.read()

hh_players_endpoint = """
@app.route('/api/hh_players')
def hh_players():
    start, end = period_params(request)
    lf, lp = loc_filter(request, alias='mas')
    
    # Gasim orele cu HH
    rows_hh = qry(f'''
        SELECT DISTINCT location_id, DATE(date) as d, HOUR(date) as h
        FROM machine_audit_summary_per_hours mas
        WHERE date >= %s AND date < %s + INTERVAL 1 DAY AND hh > 0 {lf}
    ''', [start, end] + lp)
    
    if not rows_hh:
        return jsonify([])
        
    # Construim conditia pentru jucatori
    hh_conditions = []
    hh_params = []
    for r in rows_hh:
        hh_conditions.append("(pcl.location_id = %s AND DATE(pcl.created_at) = %s AND HOUR(pcl.created_at) = %s)")
        hh_params.extend([r['location_id'], r['d'], r['h']])
    
    cond_str = " OR ".join(hh_conditions)
    
    # Cautam jucatorii care au log-uri in aceste ore
    q = f'''
        SELECT 
            p.id, p.first_name, p.last_name, p.phone,
            COUNT(DISTINCT pcl.id) as sessions_in_hh,
            MAX(pcl.created_at) as last_hh_session
        FROM player_card_logs pcl
        JOIN players p ON pcl.player_id = p.id
        WHERE ({cond_str})
          AND pcl.log_type = 2
        GROUP BY p.id, p.first_name, p.last_name, p.phone
        ORDER BY sessions_in_hh DESC
        LIMIT 50
    '''
    rows = qry(q, hh_params)
    
    for r in rows:
        if r.get('last_hh_session'):
            r['last_hh_session'] = str(r['last_hh_session'])
            
    return jsonify(rows)
"""

if '/api/hh_players' not in code:
    code = code.replace("@app.route('/api/players')", hh_players_endpoint + "\n\n@app.route('/api/players')")
    with open('server.py', 'w') as f:
        f.write(code)
    print("Added /api/hh_players to server.py")
else:
    print("Already exists")
