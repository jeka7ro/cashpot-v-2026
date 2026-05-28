import sys
sys.path.append('.')
from server import get_conn

try:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES")
    print(cursor.fetchall())
except Exception as e:
    print(e)
