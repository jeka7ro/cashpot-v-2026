import psycopg2
conn = psycopg2.connect(dbname="cashpot", user="cashpot", password="129hj8oahwd7yaw3e21321", host="82.76.35.50", port="26257")
cur = conn.cursor()
tables = ["casino_departments", "casino_payment_types", "casino_expenditure_types", "casino_vendors"]
for t in tables:
    try:
        cur.execute(f"SELECT id, name FROM {t} LIMIT 2;")
        print(t, cur.fetchall())
    except Exception as e:
        print(t, "Error:", e)
        conn.rollback()
