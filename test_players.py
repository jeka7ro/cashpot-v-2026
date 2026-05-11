from server import qry
import pprint

q = '''
SELECT
    p.id,
    p.first_name,
    COUNT(DISTINCT DATE(pcl.created_at)) as zile_active,
    COUNT(pcl.id) as total_interactiuni,
    SUM(CASE WHEN HOUR(pcl.created_at) BETWEEN 6 AND 11 THEN 1 ELSE 0 END) as dimineata
FROM player_card_logs pcl
JOIN players p ON pcl.player_id = p.id
WHERE pcl.created_at >= '2026-05-01' AND pcl.log_type = 2
GROUP BY p.id, p.first_name
LIMIT 5;
'''
rows = qry(q, [])
for r in rows:
    pprint.pprint(r)
