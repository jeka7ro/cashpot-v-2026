import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
c = conn.cursor()
c.execute('''
CREATE TABLE IF NOT EXISTS cp2_daily_incomes (
    date DATE,
    location_id VARCHAR(50),
    total_in NUMERIC(15, 2) DEFAULT 0,
    total_out NUMERIC(15, 2) DEFAULT 0,
    total_ggr NUMERIC(15, 2) DEFAULT 0,
    PRIMARY KEY (date, location_id)
)
''')
conn.commit()
conn.close()
print("Created cp2_daily_incomes")
