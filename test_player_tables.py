import sys
sys.path.append('.')
from server import qry

try:
    print("PLAYERS:", [r['Field'] for r in qry("DESCRIBE players")])
    print("PLAYER_TRANSACTIONS:", [r['Field'] for r in qry("DESCRIBE player_transactions")])
    print("PLAYER_JACKPOTS:", [r['Field'] for r in qry("DESCRIBE player_jackpots")])
    print("PLAYER_CASHBACK_IN_OUTS:", [r['Field'] for r in qry("DESCRIBE player_cashback_in_outs")])
except Exception as e:
    print("ERROR:", e)
