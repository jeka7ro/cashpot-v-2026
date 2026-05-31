import sys
with open('server.py', 'r') as f:
    content = f.read()

new_endpoint = """
@app.route('/api/reports/day_smart')
def day_smart():
    start, end = period_params(request)
    lf, lp = loc_filter(request, alias='pcl')
    
    # 1. Card players
    p_count = qry(f"SELECT COUNT(DISTINCT player_id) as c FROM player_card_logs pcl WHERE pcl.created_at >= %s AND pcl.created_at <= %s {lf}", [start, end] + lp)[0]['c']
    
    # 2. Jackpots (alias pjh)
    lf_pjh, lp_pjh = loc_filter(request, alias='pjh')
    jp_val = qry(f"SELECT SUM(hit_value) as s FROM player_jackpot_histories pjh WHERE pjh.hit_date >= %s AND pjh.hit_date <= %s {lf_pjh}", [start, end] + lp_pjh)[0]['s'] or 0
    
    # 3. Wheel (no location)
    wh_val = qry(f"SELECT SUM(amount) as s FROM player_fortune_wheel_transactions WHERE created_at >= %s AND created_at <= %s", [start, end])[0]['s'] or 0
    
    # 4. Cashback (no location)
    cb_val = qry(f"SELECT SUM(amount) as s FROM player_cashback_in_outs WHERE created_at >= %s AND created_at <= %s", [start, end])[0]['s'] or 0
    
    return jsonify({
        "card_players": p_count,
        "jackpots": float(jp_val),
        "wheel": float(wh_val),
        "cashback": float(cb_val)
    })
"""

if '/api/reports/day_smart' not in content:
    content = content.replace("@app.route('/api/live')", new_endpoint + "\n@app.route('/api/live')")
    with open('server.py', 'w') as f:
        f.write(content)
    print("Endpoint added")
else:
    print("Endpoint already exists")
