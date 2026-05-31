import sys
sys.path.append('.')
from server import get_conn

try:
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
except Exception:
    conn = get_conn()
    cursor = conn.cursor()

try:
    cursor.execute("""
        SELECT date, `in`, `out`, hh, jackpot, (COALESCE(`in`,0) - COALESCE(`out`,0)) as ggr
        FROM machine_audit_summaries 
        WHERE machine_id IN (SELECT id FROM machines WHERE slot_machine_id LIKE '%233056%')
        AND date >= '2026-05-01'
        ORDER BY date
    """)
    rows = cursor.fetchall()
    
    total_in = 0
    total_out = 0
    total_hh = 0
    total_jp = 0
    total_ggr = 0
    
    print("DATE       | IN       | OUT      | HH       | JP       | GGR")
    print("-" * 65)
    for r in rows:
        d = str(r[0]) if isinstance(r, tuple) else str(r['date'])
        inn = float(r[1]) if isinstance(r, tuple) else float(r['in'])
        out = float(r[2]) if isinstance(r, tuple) else float(r['out'])
        hh = float(r[3]) if isinstance(r, tuple) else float(r['hh'])
        jp = float(r[4]) if isinstance(r, tuple) else float(r['jackpot'])
        ggr = float(r[5]) if isinstance(r, tuple) else float(r['ggr'])
        
        total_in += inn
        total_out += out
        total_hh += hh
        total_jp += jp
        total_ggr += ggr
        print(f"{d:10} | {inn:<8.2f} | {out:<8.2f} | {hh:<8.2f} | {jp:<8.2f} | {ggr:<8.2f}")
        
    print("-" * 65)
    print(f"TOTALS     | {total_in:<8.2f} | {total_out:<8.2f} | {total_hh:<8.2f} | {total_jp:<8.2f} | {total_ggr:<8.2f}")
except Exception as e:
    print("ERROR:", e)
