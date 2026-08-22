import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        # Check what the actual value is in the DB
        c.execute("SELECT notice_period_months FROM cp2_contracts WHERE address LIKE 'Craiova%'")
        print(c.fetchall())
        
        # It might be stored as integer 0 instead of NULL, let's force it to NULL
        c.execute("""
            UPDATE cp2_contracts 
            SET notice_period_months = NULL 
            WHERE notice_period_months = 0 AND address LIKE 'Craiova%'
        """)
        conn.commit()
finally:
    conn.close()
