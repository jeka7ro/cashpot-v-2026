import sys
sys.path.append('.')
from server import qry

rows = qry("SELECT params FROM player_card_logs WHERE params LIKE '%game%' LIMIT 5")
for r in rows:
    print(r)
