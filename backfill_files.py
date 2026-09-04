import os
import psycopg2
PG_DB_CFG = dict(host="82.76.35.50", port=26257, user="cashpot", password="129hj8oahwd7yaw3e21321", dbname="cashpot")
conn = psycopg2.connect(**PG_DB_CFG)
cur = conn.cursor()

cur.execute("SELECT id, filepath FROM cp2_contract_files WHERE file_data IS NULL;")
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
        cur.execute("UPDATE cp2_contract_files SET file_data = %s WHERE id = %s", (file_data, fid))
        success_count += 1
conn.commit()
print(f"Backfilled {success_count} files into the database. Skipped {skipped_count} large files.")
