import psycopg2
import sys
sys.path.append('.')
from server import PG_DB_CFG

try:
    conn = psycopg2.connect(**PG_DB_CFG)
    with conn.cursor() as c:
        c.execute("SELECT * FROM casino_processed_simple_report LIMIT 1")
        col_names = [desc[0] for desc in c.description]
        print(col_names)
except Exception as e:
    print("ERR:", e)
