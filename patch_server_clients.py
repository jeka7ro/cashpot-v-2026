import sys

with open('server.py', 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if "res['locations'] = []" in line:
        new_lines.append(line)
        new_lines.append("""
        # -- Clients per location --
        qc = f'''
            SELECT pcl.location_id, COUNT(DISTINCT pcl.player_id) as total_clients
            FROM player_card_logs pcl
            WHERE pcl.created_at >= %s AND pcl.created_at < %s + INTERVAL 1 DAY
            {lf}
            GROUP BY pcl.location_id
        '''
        clients_rows = qry(qc, [start, end] + lp)
        clients_map = {r['location_id']: r['total_clients'] for r in clients_rows}
""")
    elif "'avg_drop': round(tin/days/buc,2)," in line:
        if "loc.display_code" in "".join(lines[i-15:i]):
            new_lines.append("            'clienti_zi': round(clients_map.get(lid, 0) / days, 1) if days > 0 else 0,\n")
            new_lines.append(line)
        else:
            new_lines.append(line)
    elif "'avg_drop': round(tin/days,2)," in line:
         new_lines.append(line)
    else:
        new_lines.append(line)
    i += 1

with open('server.py', 'w') as f:
    f.writelines(new_lines)
