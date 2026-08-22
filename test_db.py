from app_db import get_pg_conn
try:
    conn = get_pg_conn()
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM acc_expenditures WHERE date >= '01.05.2026 00:00:00' AND date <= '31.05.2026 23:59:59'")
    count = cur.fetchone()[0]
    print("Success:", count)
except Exception as e:
    print("Error:", e)
