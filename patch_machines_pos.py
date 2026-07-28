import psycopg2
from psycopg2.extras import RealDictCursor

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

def patch():
    try:
        conn = psycopg2.connect(**PG_DB_CFG)
        conn.autocommit = True
        c = conn.cursor()
        c.execute("ALTER TABLE machines ADD COLUMN IF NOT EXISTS pos_x FLOAT;")
        c.execute("ALTER TABLE machines ADD COLUMN IF NOT EXISTS pos_y FLOAT;")
        print("Added pos_x and pos_y to machines table.")
        
        c.execute("ALTER TABLE locations ADD COLUMN IF NOT EXISTS floorplan_bg TEXT;")
        print("Added floorplan_bg to locations table.")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

patch()
