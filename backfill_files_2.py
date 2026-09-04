import os
import psycopg2
PG_DB_CFG = dict(host="82.76.35.50", port=26257, user="cashpot", password="129hj8oahwd7yaw3e21321", dbname="cashpot")
conn = psycopg2.connect(**PG_DB_CFG)
cur = conn.cursor()

cur.execute("""
    SELECT f.id, f.filepath 
    FROM cp2_contract_files f 
    LEFT JOIN cp2_contract_file_data fd ON f.id = fd.file_id 
    WHERE fd.file_id IS NULL;
""")
rows = cur.fetchall()

success_count = 0
skipped_count = 0
for row in rows:
    fid = row[0]
    fpath = row[1]
    if fpath and os.path.exists(fpath):
        size = os.path.getsize(fpath)
        if size > 7 * 1024 * 1024:
            skipped_count += 1
            print(f"Skipping {fpath} (size {size})")
            continue
            
        with open(fpath, 'rb') as f:
            file_data = f.read()
            
        cur.execute("INSERT INTO cp2_contract_file_data (file_id, file_data) VALUES (%s, %s)", (fid, file_data))
        success_count += 1
conn.commit()
print(f"Backfilled {success_count} files into the data table. Skipped {skipped_count} large files.")
