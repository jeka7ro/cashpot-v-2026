import sys
sys.path.append('.')
from server import qry

try:
    print("JACKPOTS:", qry("SELECT * FROM player_jackpots LIMIT 1"))
    print("CASHBACK:", qry("SELECT * FROM player_cashback_in_outs LIMIT 1"))
    print("BETS:", qry("SELECT * FROM player_points_bets LIMIT 1"))
    print("PLAYERS:", qry("SELECT * FROM players LIMIT 1"))
except Exception as e:
    print("ERROR:", e)
