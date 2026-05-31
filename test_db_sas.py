import sys
sys.path.append('.')
from server import get_conn

try:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT machine_id, date, COUNT(*) as c FROM machine_audit_summaries GROUP BY machine_id, date HAVING c > 1 LIMIT 5")
    print("Multi-row per day:", cursor.fetchall())
except Exception as e:
    print(e)
