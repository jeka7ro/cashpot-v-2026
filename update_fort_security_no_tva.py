import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

# Real formula without adding TVA: 24.88 * 24 * 30
amount = 17913.60

conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        c.execute("UPDATE cp2_contracts SET total_amount = %s WHERE owner_name = 'Fort Security'", (amount,))
        c.execute("UPDATE cp2_contract_locations SET amount = %s WHERE contract_id = (SELECT id FROM cp2_contracts WHERE owner_name = 'Fort Security')", (amount,))
        conn.commit()
        print(f"Updated Fort Security to {amount} LEI (fara TVA).")
finally:
    conn.close()
