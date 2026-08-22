import sys
sys.path.append('.')
from server import qry

rows = qry("SELECT * FROM expenses ORDER BY id DESC LIMIT 5")
print(rows)
