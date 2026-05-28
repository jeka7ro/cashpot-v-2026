import sys
import os
sys.path.append('.')
from server import get_conn

try:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES")
    for row in cursor.fetchall():
        print(row.values())
except Exception as e:
    print(e)
