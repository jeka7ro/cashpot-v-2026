import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        # Set notice_period_months to NULL where it's 0 for these fallback contracts
        c.execute("""
            UPDATE cp2_contracts
            SET notice_period_months = NULL,
                total_amount = NULL,
                m2 = NULL
            WHERE address LIKE 'Craiova%' AND owner_name NOT IN ('GAME WORLD ROMANIA S.R.L.', 'ALFASTREET TRADE S.R.L.', 'Contract de închiriere')
        """)
        
        c.execute("""
            UPDATE cp2_contract_locations
            SET amount = NULL
            WHERE location_id = 5 AND amount = 0
        """)
        conn.commit()
        print("Wiped dummy zeroes from Craiova fallback entries.")
finally:
    conn.close()
