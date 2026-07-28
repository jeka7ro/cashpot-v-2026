import psycopg2

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
        
        c.execute("""
        CREATE TABLE IF NOT EXISTS cp2_floorplan_machines (
            id SERIAL PRIMARY KEY,
            location_id INTEGER,
            machine_id INTEGER,
            serial_nr TEXT,
            pos_x FLOAT,
            pos_y FLOAT,
            UNIQUE(location_id, machine_id)
        );
        """)
        
        c.execute("""
        CREATE TABLE IF NOT EXISTS cp2_floorplan_settings (
            location_id INTEGER PRIMARY KEY,
            floorplan_bg TEXT
        );
        """)
        
        print("Created cp2_floorplan tables successfully.")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

patch()
