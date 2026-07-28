import pymysql
import sys
import cp2_db

DB_CFG = dict(
    host="161.97.133.165", port=3306,
    user="eugen", password="(@Ee0wRHVohZww33",
    database="cyberslot_dbn",
    connect_timeout=8, read_timeout=60, write_timeout=60,
    ssl_disabled=True, cursorclass=pymysql.cursors.DictCursor
)

positions = {
    # 1. Top Left Wall
    '4047': {'x': 32.0, 'y': 31.0, 'angle': 45},
    '4046': {'x': 29.5, 'y': 35.0, 'angle': 45},
    '4045': {'x': 27.0, 'y': 39.0, 'angle': 45},

    # 2. Top Wall
    '4001': {'x': 37.0, 'y': 28.0, 'angle': 0},
    '4054': {'x': 39.0, 'y': 28.0, 'angle': 0},
    '4055': {'x': 41.0, 'y': 28.0, 'angle': 0},

    # 3. Top Right Wall
    '4075': {'x': 54.0, 'y': 28.0, 'angle': 0},
    '4099': {'x': 56.0, 'y': 28.0, 'angle': 0},
    '4100': {'x': 58.0, 'y': 28.0, 'angle': 0},
    '4101': {'x': 60.0, 'y': 28.0, 'angle': 0},
    '4102': {'x': 62.0, 'y': 28.0, 'angle': 0},

    # 4. Far Right Top Wall
    '4080': {'x': 71.0, 'y': 31.0, 'angle': -45},
    '4081': {'x': 73.0, 'y': 34.0, 'angle': -45},
    '4082': {'x': 75.0, 'y': 37.0, 'angle': -45},

    # 5. Far Right Bottom Corner
    '4097': {'x': 90.0, 'y': 68.0, 'angle': 45},
    '4098': {'x': 92.0, 'y': 71.0, 'angle': 45},

    # 6. Bottom Right Wall (S27 / LIVE)
    '4095': {'x': 87.0, 'y': 82.0, 'angle': 0},
    '4096': {'x': 89.0, 'y': 82.0, 'angle': 0},
    '4041': {'x': 80.0, 'y': 85.0, 'angle': 0},
    '4042': {'x': 77.5, 'y': 85.0, 'angle': 0},
    '4043': {'x': 75.0, 'y': 85.0, 'angle': 0},
    '4044': {'x': 72.5, 'y': 85.0, 'angle': 0},

    # 7. Bottom Middle
    '4079': {'x': 60.5, 'y': 88.0, 'angle': 0},
    '4078': {'x': 58.5, 'y': 88.0, 'angle': 0},
    '4076': {'x': 56.5, 'y': 88.0, 'angle': 0},
    '4077': {'x': 54.5, 'y': 88.0, 'angle': 0},

    # 8. Left Bottom Corner
    '4012': {'x': 19.5, 'y': 88.0, 'angle': 0},
    '4011': {'x': 22.0, 'y': 88.0, 'angle': 0},
    '4010': {'x': 24.5, 'y': 88.0, 'angle': 0},
    '4009': {'x': 27.0, 'y': 88.0, 'angle': 0},

    # 9. Far Left Bottom Wall
    '4061': {'x': 9.0, 'y': 78.0, 'angle': -45},
    '4060': {'x': 11.5, 'y': 81.0, 'angle': -45},
    '4059': {'x': 14.0, 'y': 84.0, 'angle': -45},
    '4058': {'x': 16.5, 'y': 87.0, 'angle': -45},

    # 10. Left Middle Island
    '4092': {'x': 23.0, 'y': 69.0, 'angle': 0},
    '4089': {'x': 25.0, 'y': 73.0, 'angle': 0},
    '4093': {'x': 17.5, 'y': 77.0, 'angle': 0},
    '4090': {'x': 19.5, 'y': 81.0, 'angle': 0},

    # 11. Middle Left Island (P32)
    '4071': {'x': 34.5, 'y': 39.0, 'angle': 0},
    '4073': {'x': 34.5, 'y': 44.0, 'angle': 0},
    '4074': {'x': 34.5, 'y': 49.0, 'angle': 0},
    '4069': {'x': 42.0, 'y': 39.0, 'angle': 0},
    '4056': {'x': 42.0, 'y': 44.0, 'angle': 0},
    '4049': {'x': 42.0, 'y': 49.0, 'angle': 0},

    # 12. Middle Right Island - Upper (P32)
    '4063': {'x': 57.5, 'y': 49.0, 'angle': 0},
    '4065': {'x': 57.5, 'y': 54.0, 'angle': 0},
    '4067': {'x': 57.5, 'y': 59.0, 'angle': 0},
    '4072': {'x': 65.0, 'y': 49.0, 'angle': 0},
    '4057': {'x': 65.0, 'y': 54.0, 'angle': 0},
    '4048': {'x': 65.0, 'y': 59.0, 'angle': 0},

    # 13. Middle Right Island - Lower (P32)
    '4068': {'x': 68.0, 'y': 71.0, 'angle': 0},
    '4070': {'x': 68.0, 'y': 76.0, 'angle': 0},
    '4064': {'x': 75.0, 'y': 71.0, 'angle': 0},
    '4066': {'x': 75.0, 'y': 76.0, 'angle': 0},
}

conn = pymysql.connect(**DB_CFG)
try:
    with conn.cursor() as cur:
        cur.execute("SELECT id, `order` as position, slot_machine_id as serial_nr FROM machines WHERE location_id IN (5, 10) AND deleted_at IS NULL;")
        machines = cur.fetchall()
        
    pg_conn = cp2_db.get_db()
    pg_cur = pg_conn.cursor()
    
    count = 0
    for m in machines:
        pos_str = str(m['position']).strip()
        if pos_str in positions:
            p = positions[pos_str]
            pg_cur.execute("""
                INSERT INTO cp2_floorplan_machines (location_id, machine_id, serial_nr, pos_x, pos_y, angle)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (location_id, machine_id) DO UPDATE 
                SET pos_x = EXCLUDED.pos_x, pos_y = EXCLUDED.pos_y, angle = EXCLUDED.angle
            """, (5, m['id'], m['serial_nr'], p['x'], p['y'], p['angle']))
            count += 1
        else:
            # Delete if not in image
            pg_cur.execute("DELETE FROM cp2_floorplan_machines WHERE location_id = 5 AND machine_id = %s", (m['id'],))

    pg_conn.commit()
    print(f"Successfully placed {count} machines for Craiova!")
except Exception as e:
    print("Error:", e)
finally:
    conn.close()
