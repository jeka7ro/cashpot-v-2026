import sys
sys.path.append('.')
from server import qry

print(qry("DESCRIBE machines"))
