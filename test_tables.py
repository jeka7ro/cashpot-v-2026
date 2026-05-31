import sys
sys.path.append('.')
from server import get_conn

try:
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
except Exception:
    conn = get_conn()
    cursor = conn.cursor()

try:
    cursor.execute("SHOW TABLES")
    for r in cursor.fetchall():
        print(r)
except Exception as e:
    print("ERROR:", e)
