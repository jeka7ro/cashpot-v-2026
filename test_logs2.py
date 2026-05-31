import sys
sys.path.append('.')
from server import qry

try:
    print("PLAYER_CHECK_INS:", [r['Field'] for r in qry("DESCRIBE player_check_ins")])
    print("PLAYER_LOGS:", [r['Field'] for r in qry("DESCRIBE player_logs")])
    print("PLAYER_POINTS_BETS:", [r['Field'] for r in qry("DESCRIBE player_points_bets")])
except Exception as e:
    print("ERROR:", e)
