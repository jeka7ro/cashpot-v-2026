import sys
sys.path.append('.')
from server import qry

try:
    print(qry("SELECT * FROM player_cashback_in_outs LIMIT 5"))
except Exception as e:
    print("ERROR:", e)
