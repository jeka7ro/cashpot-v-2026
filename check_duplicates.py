import server
with server.get_conn() as conn:
    with conn.cursor() as c:
        c.execute("""
        SELECT m.slot_machine_id, COUNT(*)
        FROM machines m
        GROUP BY m.slot_machine_id
        HAVING COUNT(*) > 1
        """)
        print("Duplicate serial_nrs in machines table:", c.fetchall())
