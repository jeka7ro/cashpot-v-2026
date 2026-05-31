import sys
sys.path.append('.')
from server import qry

try:
    res = qry("""
        SELECT date, `out`, hh, cashback, jackpot, cb_birthday
        FROM machine_audit_summaries 
        WHERE cashback > 0 AND hh > 0
        LIMIT 10
    """)
    if res:
        print("OVERLAP BETWEEN HH AND CASHBACK:")
        for r in res:
            print(f"Date: {r['date']}, OUT: {r['out']}, HH: {r['hh']}, CB: {r['cashback']}")
    else:
        print("NO ROWS WITH BOTH HH > 0 AND CASHBACK > 0")

    print("---")
    res2 = qry("""
        SELECT date, `out`, hh, cashback, jackpot, cb_birthday
        FROM machine_audit_summaries 
        WHERE cashback > 0 AND `out` > 0
        LIMIT 5
    """)
    print("OVERLAP BETWEEN OUT AND CASHBACK:")
    for r in res2:
        print(f"Date: {r['date']}, OUT: {r['out']}, HH: {r['hh']}, CB: {r['cashback']}")
except Exception as e:
    print("ERROR:", e)
