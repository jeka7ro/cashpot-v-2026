import pymysql
import sys
sys.path.append('.')
from server import DB_CFG

conn = pymysql.connect(**DB_CFG)
with conn.cursor(pymysql.cursors.DictCursor) as cursor:
    cursor.execute("SELECT id, name FROM machine_games LIMIT 5")
    print(cursor.fetchall())
