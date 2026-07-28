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

# New manual, more accurate positions
# Using 0-100% relative to the actual image boundaries.
# I will spread X by 4-5% and Y by 5-6% for items next to each other.
positions = {
    # 1. Top Left Wall (Diagonal)
    '4047': {'x': 32.0, 'y': 25.0, 'angle': 45},
    '4046': {'x': 29.0, 'y': 29.0, 'angle': 45},
    '4045': {'x': 26.0, 'y': 33.0, 'angle': 45},

    # 2. Top Wall
    '4001': {'x': 35.0, 'y': 20.0, 'angle': 0},
    '4054': {'x': 40.0, 'y': 20.0, 'angle': 0},
    '4055': {'x': 45.0, 'y': 20.0, 'angle': 0},

    # 3. Top Right Wall
    '4075': {'x': 54.0, 'y': 20.0, 'angle': 0},
    '4099': {'x': 59.0, 'y': 20.0, 'angle': 0},
    '4100': {'x': 64.0, 'y': 20.0, 'angle': 0},
    '4101': {'x': 69.0, 'y': 20.0, 'angle': 0},
    '4102': {'x': 74.0, 'y': 20.0, 'angle': 0},

    # 4. Far Right Top Wall
    '4080': {'x': 78.0, 'y': 25.0, 'angle': -45},
    '4081': {'x': 81.0, 'y': 29.0, 'angle': -45},
    '4082': {'x': 84.0, 'y': 33.0, 'angle': -45},

    # 5. Far Right Bottom Corner
    '4097': {'x': 90.0, 'y': 62.0, 'angle': -45},
    '4098': {'x': 93.0, 'y': 66.0, 'angle': -45},

    # 6. Bottom Right Wall (S27 / LIVE)
    '4095': {'x': 86.0, 'y': 80.0, 'angle': 0},
    '4096': {'x': 91.0, 'y': 80.0, 'angle': 0},
    '4041': {'x': 79.0, 'y': 88.0, 'angle': 0},
    '4042': {'x': 74.0, 'y': 88.0, 'angle': 0},
    '4043': {'x': 69.0, 'y': 88.0, 'angle': 0},
    '4044': {'x': 64.0, 'y': 88.0, 'angle': 0},

    # 7. Bottom Middle
    '4079': {'x': 60.0, 'y': 88.0, 'angle': 0},
    '4078': {'x': 55.0, 'y': 88.0, 'angle': 0},
    '4076': {'x': 50.0, 'y': 88.0, 'angle': 0},
    '4077': {'x': 45.0, 'y': 88.0, 'angle': 0},

    # 8. Left Bottom Corner
    '4012': {'x': 20.0, 'y': 88.0, 'angle': 0},
    '4011': {'x': 25.0, 'y': 88.0, 'angle': 0},
    '4010': {'x': 30.0, 'y': 88.0, 'angle': 0},
    '4009': {'x': 35.0, 'y': 88.0, 'angle': 0},

    # 9. Far Left Bottom Wall
    '4061': {'x': 7.0, 'y': 70.0, 'angle': 45},
    '4060': {'x': 10.0, 'y': 74.0, 'angle': 45},
    '4059': {'x': 13.0, 'y': 78.0, 'angle': 45},
    '4058': {'x': 16.0, 'y': 82.0, 'angle': 45},

    # 10. Left Middle Island
    '4092': {'x': 24.0, 'y': 62.0, 'angle': 0},
    '4089': {'x': 28.0, 'y': 68.0, 'angle': 0},
    '4093': {'x': 16.0, 'y': 68.0, 'angle': 0},
    '4090': {'x': 20.0, 'y': 74.0, 'angle': 0},

    # 11. Middle Left Island (P32)
    '4071': {'x': 35.0, 'y': 36.0, 'angle': 0},
    '4073': {'x': 35.0, 'y': 44.0, 'angle': 0},
    '4074': {'x': 35.0, 'y': 52.0, 'angle': 0},
    '4069': {'x': 43.0, 'y': 36.0, 'angle': 0},
    '4056': {'x': 43.0, 'y': 44.0, 'angle': 0},
    '4049': {'x': 43.0, 'y': 52.0, 'angle': 0},

    # 12. Middle Right Island - Upper (P32)
    '4063': {'x': 57.0, 'y': 44.0, 'angle': 0},
    '4065': {'x': 57.0, 'y': 52.0, 'angle': 0},
    '4067': {'x': 57.0, 'y': 60.0, 'angle': 0},
    '4072': {'x': 65.0, 'y': 44.0, 'angle': 0},
    '4057': {'x': 65.0, 'y': 52.0, 'angle': 0},
    '4048': {'x': 65.0, 'y': 60.0, 'angle': 0},

    # 13. Middle Right Island - Lower (P32)
    '4068': {'x': 68.0, 'y': 70.0, 'angle': 0},
    '4070': {'x': 68.0, 'y': 78.0, 'angle': 0},
    '4064': {'x': 76.0, 'y': 70.0, 'angle': 0},
    '4066': {'x': 76.0, 'y': 78.0, 'angle': 0},
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
                UPDATE cp2_floorplan_machines 
                SET pos_x = %s, pos_y = %s, angle = %s
                WHERE location_id = 5 AND machine_id = %s
            """, (p['x'], p['y'], p['angle'], m['id']))
            count += 1

    pg_conn.commit()
    print(f"Successfully updated positions for {count} machines!")
except Exception as e:
    print("Error:", e)
finally:
    conn.close()
