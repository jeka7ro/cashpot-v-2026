import sys
sys.path.append('.')
from server import qry

try:
    print(qry("SELECT reason, count(*) as cnt FROM player_transactions GROUP BY reason LIMIT 10"))
except Exception as e:
    print("ERROR:", e)
