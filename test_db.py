import sys
import mysql.connector

try:
    conn = mysql.connector.connect(
        host="localhost", user="root", password="1", database="cashpot2"
    )
    cursor = conn.cursor()
    cursor.execute("DESCRIBE machine_audit_summaries")
    for row in cursor.fetchall():
        print(row[0], row[1])
except Exception as e:
    print(e)
