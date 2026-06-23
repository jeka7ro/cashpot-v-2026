import psycopg2
conn = psycopg2.connect(dbname="cashpot", user="cashpot", password="129hj8oahwd7yaw3e21321", host="82.76.35.50", port="26257")
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
tables = cur.fetchall()
print("PG Tables:", [t[0] for t in tables])
