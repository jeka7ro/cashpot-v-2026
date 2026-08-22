import sys
sys.path.append('.')
from server import qry

print(qry("DESCRIBE machine_daily_meters"))
