import pymysql
import json
DB_CFG = dict(
    host="161.97.133.165", port=3306,
    user="eugen", password="(@Ee0wRHVohZww33",
    database="cyberslot_dbn",
    connect_timeout=8, cursorclass=pymysql.cursors.DictCursor
)
conn = pymysql.connect(**DB_CFG)
c = conn.cursor()
serial = "130695"
c.execute("""
    SELECT 
        l.display_code as location_name,
        m.created_at,
        m.deleted_at,
        SUM(mas.`in`) as total_in,
        SUM(mas.`out`) as total_out,
        SUM(mas.jackpot) as total_jp
    FROM machines m
    JOIN locations l ON m.location_id = l.id
    LEFT JOIN machine_audit_summaries mas ON mas.machine_id = m.id
    WHERE m.slot_machine_id = %s
    GROUP BY m.id, l.display_code, m.created_at, m.deleted_at
    ORDER BY m.created_at DESC
""", [serial])
for row in c.fetchall():
    print(row)
conn.close()
