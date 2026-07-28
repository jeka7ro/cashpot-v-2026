import pymysql

DB_CFG = dict(
    host="161.97.133.165", port=3306,
    user="eugen", password="(@Ee0wRHVohZww33",
    database="cyberslot_dbn",
    connect_timeout=8, read_timeout=60, write_timeout=60,
    ssl_disabled=True, cursorclass=pymysql.cursors.DictCursor
)

positions = ['4047', '4046', '4045', '4001', '4054', '4055']

conn = pymysql.connect(**DB_CFG)
try:
    with conn.cursor() as cur:
        cur.execute("SELECT id, `order` as position, slot_machine_id as serial_nr FROM machines WHERE location_id IN (5, 10) AND deleted_at IS NULL AND `order` IN ('4047', '4046', '4045', '4001', '4054', '4055');")
        machines = cur.fetchall()
        print(machines)
finally:
    conn.close()
