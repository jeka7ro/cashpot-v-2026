import pymysql
import traceback

DB_CFG = dict(
    host="161.97.133.165", port=3306,
    user="eugen", password="(@Ee0wRHVohZww33",
    database="cyberslot_dbn",
    connect_timeout=8, cursorclass=pymysql.cursors.DictCursor
)
try:
    conn = pymysql.connect(**DB_CFG)
    c = conn.cursor()
    
    serial = b'130695' # what if we pass bytes to pymysql execute?
    c.execute("""
            SELECT m.id, m.location_id, l.display_code as location_name, m.created_at, m.deleted_at
            FROM machines m
            JOIN locations l ON m.location_id = l.id
            WHERE m.slot_machine_id = %s
            ORDER BY m.created_at DESC
        """, [serial])
    loc_history = c.fetchall()
    print("loc_history worked")
    
except Exception as e:
    traceback.print_exc()
