import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        c.execute("""
        SELECT 
            m.slot_machine_id, 
            COUNT(DISTINCT DATE(mas.date)) as days_active,
            SUM(mas.`in`) as total_in,
            SUM(mas.`out`) as total_out
        FROM machine_audit_summaries mas
        JOIN machines m ON mas.machine_id = m.id
        WHERE DATE_FORMAT(mas.date, '%Y-%m') = '2025-08'
        GROUP BY m.slot_machine_id
        ORDER BY days_active ASC
        LIMIT 10
        """)
        for r in c.fetchall():
            print(r)
