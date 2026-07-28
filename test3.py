import sys
sys.path.append("/Users/eugeniucazmal/Downloads/dev_office/cashpot2")
from server import qry

counts = qry("SELECT location_id, COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date = (SELECT MAX(date) FROM machine_daily_meters) GROUP BY location_id")
count_map = {str(r['location_id']): r['c'] for r in counts}
print(count_map)
