import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        dummy_id = '0c956d76-062d-4c35-9849-7f6e763ee99b'
        existing_id = 'a2110c38-a3fb-4498-bbc1-1ca98901d8e0'
        
        # Move the files from the dummy contract to the real one
        c.execute("UPDATE cp2_contract_files SET contract_id = %s WHERE contract_id = %s", (existing_id, dummy_id))
        
        # Delete the dummy contract locations mapping
        c.execute("DELETE FROM cp2_contract_locations WHERE contract_id = %s", (dummy_id,))
        
        # Delete the dummy contract itself
        c.execute("DELETE FROM cp2_contracts WHERE id = %s", (dummy_id,))
        
        conn.commit()
        print("Merged files to the existing contract and deleted the duplicate.")
finally:
    conn.close()
