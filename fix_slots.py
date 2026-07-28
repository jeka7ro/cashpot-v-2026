import psycopg2
conn = psycopg2.connect(dbname='cashpot', user='cashpot', password='129hj8oahwd7yaw3e21321', host='82.76.35.50', port='26257')
cur = conn.cursor()
cur.execute("SELECT id, name FROM casino_locations ORDER BY name")
pg_locs = cur.fetchall()
print("PG Locs:", len(pg_locs))
