import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
c = conn.cursor()
c.execute('''
CREATE TABLE IF NOT EXISTS cp2_player_sessions (
    dt DATE,
    player_id VARCHAR(50),
    location_id VARCHAR(50),
    machine_id VARCHAR(50),
    total_bet NUMERIC(15, 2) DEFAULT 0,
    points NUMERIC(15, 2) DEFAULT 0,
    PRIMARY KEY (dt, player_id, machine_id)
)
''')
conn.commit()
conn.close()
print("Created cp2_player_sessions table.")
