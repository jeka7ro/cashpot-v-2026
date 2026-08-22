import pymysql
DB_CFG = dict(
    host="161.97.133.165", port=3306,
    user="eugen", password="(@Ee0wRHVohZww33",
    database="cyberslot_dbn",
    connect_timeout=8, cursorclass=pymysql.cursors.DictCursor
)
conn = pymysql.connect(**DB_CFG)
c = conn.cursor()
c.execute("""
        SELECT 
            resets.slot_machine_id AS serial,
            l.display_code AS locatie,
            mt.name AS tip,
            resets.last_ram_clear,
            SUM(mas.`in`) AS total_in,
            SUM(mas.`out`) AS total_out,
            SUM(mas.`in` - mas.`out`) AS ggr,
            COUNT(DISTINCT mas.date) AS zile_de_la_reset,
            MAX(mas.date) AS max_date
        FROM (
            SELECT m2.slot_machine_id, MAX(mr2.datetime) as last_ram_clear 
            FROM machine_resets mr2
            JOIN machines m2 ON m2.id = mr2.machine_id
            WHERE mr2.reset_type = 0 
            GROUP BY m2.slot_machine_id
        ) resets
        JOIN machines m ON m.slot_machine_id = resets.slot_machine_id
        JOIN locations l ON l.id = m.location_id
        LEFT JOIN machine_types mt ON mt.id = m.machine_type_id
        JOIN machine_audit_summaries mas ON mas.machine_id = m.id AND mas.date >= DATE(resets.last_ram_clear)
        GROUP BY resets.slot_machine_id, l.display_code, mt.name, resets.last_ram_clear
        HAVING SUM(mas.`in`) > 0
""")
rows = c.fetchall()
conn.close()

from collections import defaultdict
machines = {}
for r in rows:
    serial = r['serial']
    if serial not in machines:
        machines[serial] = {
            'serial': serial,
            'locatie': r['locatie'],
            'tip': r['tip'] or '-',
            'data_reset': str(r['last_ram_clear']),
            'total_in': 0,
            'total_out': 0,
            'ggr': 0,
            'zile': 0,
            'max_date': r['max_date']
        }
    m = machines[serial]
    m['total_in'] += float(r['total_in'] or 0)
    m['total_out'] += float(r['total_out'] or 0)
    m['ggr'] += float(r['ggr'] or 0)
    m['zile'] += r['zile_de_la_reset']
    if r['max_date'] > m['max_date']:
        m['locatie'] = r['locatie']
        m['tip'] = r['tip'] or '-'
        m['max_date'] = r['max_date']

res = list(machines.values())
res.sort(key=lambda x: x['total_in'], reverse=True)
for x in res[:5]:
    print(x)
