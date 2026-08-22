import sys
sys.path.append('.')
from server import qry

end = '2026-08-05'
lf = " AND mas.location_id IN (4, 5)"
lp = []

# Fetch from mas
rows = qry("""
    SELECT COUNT(DISTINCT mas.machine_id) as aparate
    FROM machine_audit_summaries mas
    WHERE mas.date >= '2026-08-01' AND mas.date <= '2026-08-05' AND mas.`in` > 0
    """ + lf)
print("Audit distinct:", rows[0]['aparate'])

lf_mdm = lf.replace("mas.", "mdm.")
active_m = qry("""
    SELECT COUNT(DISTINCT mdm.machine_id) as c 
    FROM machine_daily_meters mdm 
    WHERE mdm.date = (SELECT MAX(date) FROM machine_daily_meters WHERE date <= %s)
""" + lf_mdm, [end] + lp)
print("Meters installed:", active_m[0]['c'])
