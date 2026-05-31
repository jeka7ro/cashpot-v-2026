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
        WHERE machine_id IN (SELECT id FROM machines WHERE slot_machine_id LIKE '%100399%')
        AND date >= '2026-05-01'
        ORDER BY date
    """)
    rows = cursor.fetchall()
    
    for r in rows:
        d = str(r[0]) if isinstance(r, tuple) else str(r['date'])
        inn = float(r[1]) if isinstance(r, tuple) else float(r['in'])
        out = float(r[2]) if isinstance(r, tuple) else float(r['out'])
        hh = float(r[3]) if isinstance(r, tuple) else float(r['hh'])
        jp = float(r[4]) if isinstance(r, tuple) else float(r['jackpot'])
        ggr = float(r[5]) if isinstance(r, tuple) else float(r['ggr'])
        
        if out > 0 or hh > 0 or jp > 0:
            print(f"{d:10} | IN: {inn:<8.2f} | OUT: {out:<8.2f} | HH: {hh:<8.2f} | JP: {jp:<8.2f} | GGR: {ggr:<8.2f}")
except Exception as e:
    print("ERROR:", e)
