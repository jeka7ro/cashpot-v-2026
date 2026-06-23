import psycopg2
conn = psycopg2.connect(dbname="cashpot", user="cashpot", password="129hj8oahwd7yaw3e21321", host="82.76.35.50", port="26257")
cur = conn.cursor()
cur.execute("SELECT MAX(event_date) FROM casino_processed_simple_report;")
print("Max date in Postgres:", cur.fetchone()[0])
