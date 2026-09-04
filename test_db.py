import psycopg2
PG_DB_CFG = dict(host="82.76.35.50", port=26257, user="cashpot", password="129hj8oahwd7yaw3e21321", dbname="cashpot")
conn = psycopg2.connect(**PG_DB_CFG)
cur = conn.cursor()
try:
    cur.execute("SELECT id, contract_id, is_annex, filename FROM cp2_contract_files")
    rows = cur.fetchall()
    print("Files fetched:", len(rows))
except Exception as e:
    print("Error:", e)
