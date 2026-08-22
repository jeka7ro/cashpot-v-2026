import server
query = """
SELECT 
    m.slot_machine_id as serial_nr,
    COALESCE(l.display_code, l.code) as location_name,
    mt.manufacturer as provider,
    mt.name as cabinet,
    DATE_FORMAT(mas.date, '%Y-%m') as month,
    SUM(mas.`in`) as in_val,
    SUM(mas.`out`) as out_val,
    SUM(mas.`in` - mas.`out`) as ggr,
    SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cashback,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)+COALESCE(mas.cb_fortune_wheel,0)+COALESCE(mas.cb_raffle,0)) AS marketing,
    SUM(mas.`in` - mas.`out` + COALESCE(mas.jackpot,0) + COALESCE(mas.cashback,0) + COALESCE(mas.hh,0) + COALESCE(mas.cb_birthday,0) + COALESCE(mas.cb_fortune_wheel,0) + COALESCE(mas.cb_raffle,0)) as ngr
FROM machine_audit_summaries mas
JOIN locations l ON l.id = mas.location_id
JOIN machines m ON m.id = mas.machine_id
JOIN machine_types mt ON m.machine_type_id = mt.id
WHERE mas.date >= '2025-01-01' AND mas.date <= '2025-12-31'
GROUP BY serial_nr, location_name, provider, cabinet, month
LIMIT 5;
"""
with server.get_conn() as conn:
    with conn.cursor() as c:
        import time
        t0 = time.time()
        c.execute(query)
        res = c.fetchall()
        print(f"Time taken: {time.time()-t0:.2f}s")
        for row in res:
            print(row)
