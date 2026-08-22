import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        c.execute("""
        SELECT 
            m.slot_machine_id, 
            COUNT(DISTINCT DATE(mas.date)) as days_active
        FROM machine_audit_summaries mas
        JOIN machines m ON mas.machine_id = m.id
        WHERE DATE_FORMAT(mas.date, '%Y-%m') = '2025-08'
        GROUP BY m.slot_machine_id
        ORDER BY days_active ASC
        """)
        rows = c.fetchall()
        print(f"Total machines: {len(rows)}")
        for i in range(1, 10):
            count = sum(1 for r in rows if r['days_active'] <= i)
            print(f"Machines with <= {i} days: {count}")
        for r in rows:
            if r['days_active'] < 10:
                print(r)
