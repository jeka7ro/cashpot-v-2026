import sys
sys.path.append('.')
from server import qry

try:
    print("player_jackpot_histories:", qry("SELECT count(*) FROM player_jackpot_histories"))
    print("raffle_histories:", qry("SELECT count(*) FROM raffle_histories"))
    print("player_transactions:", qry("SELECT count(*) FROM player_transactions"))
except Exception as e:
    print("ERROR:", e)
