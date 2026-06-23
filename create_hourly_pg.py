import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
c = conn.cursor()
c.execute('''
CREATE TABLE IF NOT EXISTS cp2_hourly_incomes (
    dt TIMESTAMP,
    location_id VARCHAR(50),
    machine_id VARCHAR(50),
    machine_type_id VARCHAR(50),
    total_in NUMERIC(15, 2) DEFAULT 0,
    total_out NUMERIC(15, 2) DEFAULT 0,
    games NUMERIC(15, 2) DEFAULT 0,
    bet NUMERIC(15, 2) DEFAULT 0,
    win NUMERIC(15, 2) DEFAULT 0,
    jackpot NUMERIC(15, 2) DEFAULT 0,
    hh NUMERIC(15, 2) DEFAULT 0,
    cb_fortune_wheel NUMERIC(15, 2) DEFAULT 0,
    cashback NUMERIC(15, 2) DEFAULT 0,
    PRIMARY KEY (dt, location_id, machine_id)
)
''')
conn.commit()
conn.close()
print("Created cp2_hourly_incomes table.")
