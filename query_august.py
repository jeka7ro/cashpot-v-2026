import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        c.execute("""
        SELECT m.slot_machine_id as serial_nr
        FROM machine_audit_summaries mas
        JOIN machines m ON m.id = mas.machine_id
        WHERE DATE_FORMAT(mas.date, '%Y-%m') = '2025-08'
        GROUP BY serial_nr
        """)
        rows = c.fetchall()
        print(f"Count: {len(rows)}")
        for r in rows:
            if not r['serial_nr'] or len(r['serial_nr']) < 3:
                print(f"Suspicious serial: '{r['serial_nr']}'")
