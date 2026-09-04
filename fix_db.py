import psycopg2
PG_DB_CFG = dict(host="82.76.35.50", port=26257, user="cashpot", password="129hj8oahwd7yaw3e21321", dbname="cashpot")
conn = psycopg2.connect(**PG_DB_CFG)
conn.autocommit = True
cur = conn.cursor()

try:
    cur.execute("CREATE TABLE IF NOT EXISTS cp2_contract_file_data (file_id UUID PRIMARY KEY REFERENCES cp2_contract_files(id) ON DELETE CASCADE, file_data BYTEA);")
    
    # We must fetch IDs in tiny chunks
    offset = 0
    ids_to_clear = []
    while True:
        cur.execute("SELECT id FROM cp2_contract_files ORDER BY id LIMIT 5 OFFSET %s", (offset,))
        rows = cur.fetchall()
        if not rows:
            break
        for row in rows:
            ids_to_clear.append(row[0])
        offset += 5

    cleared = 0
    for fid in ids_to_clear:
        cur.execute("UPDATE cp2_contract_files SET file_data = NULL WHERE id = %s", (fid,))
        cleared += 1
        
    print(f"Cleared {cleared} rows.")
    
    cur.execute("ALTER TABLE cp2_contract_files DROP COLUMN IF EXISTS file_data;")
    print("Column dropped.")
except Exception as e:
    print("Error:", e)
