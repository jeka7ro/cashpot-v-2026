import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        c.execute("""
            UPDATE cp2_contracts
            SET address = 'Craiova, Strada Infrățirii 2',
                m2 = NULL,
                total_amount = NULL
            WHERE address = 'Craiova' AND owner_name NOT IN ('GAME WORLD ROMANIA S.R.L.', 'ALFASTREET TRADE S.R.L.')
        """)
        c.execute("""
            UPDATE cp2_contract_locations
            SET amount = NULL
            WHERE location_id = 5 AND amount = 0
        """)
        conn.commit()
        print("Updated Craiova fallback entries.")
finally:
    conn.close()
