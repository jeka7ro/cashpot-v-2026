import psycopg2
from psycopg2.extras import RealDictCursor

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT id, name FROM locations WHERE city ILIKE '%craiova%' AND deleted_at IS NULL;")
locs = cur.fetchall()
print("Locations:", locs)
loc_id = locs[0]['id']

cur.execute("SELECT id, position, serial_nr FROM machines WHERE location_id = %s AND deleted_at IS NULL;", (loc_id,))
machines = cur.fetchall()

import json
with open('craiova_machines.json', 'w') as f:
    json.dump(machines, f, indent=2)

print(f"Total active machines in Craiova: {len(machines)}")
