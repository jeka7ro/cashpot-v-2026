import server
import datetime
import traceback

def test_sync():
    try:
        # Get max date from Postgres
        pg_rows = server.pg_qry("SELECT MAX(date) as max_d FROM cp2_daily_incomes")
        max_d = pg_rows[0]['max_d'] if pg_rows and pg_rows[0]['max_d'] else None
        
        today = datetime.date.today()
        yesterday = today - datetime.timedelta(days=1)
        
        if max_d is None:
            # First run, get last 12 months
            start_sync = today - datetime.timedelta(days=365)
        else:
            start_sync = max_d + datetime.timedelta(days=1)
            
        if start_sync > yesterday:
            print("Already synced up to yesterday!")
            return
            
        print(f"Syncing from {start_sync} to {yesterday}...")
        
        # Query MySQL for these dates
        mysql_sql = """
            SELECT 
                mas.date,
                mas.location_id,
                SUM(mas.`in`) as total_in,
                SUM(mas.`out`) as total_out,
                SUM(mas.`in` - mas.`out`) as total_ggr
            FROM machine_audit_summaries mas
            WHERE mas.date >= %s AND mas.date <= %s
            GROUP BY mas.date, mas.location_id
        """
        mysql_data = server.qry(mysql_sql, [start_sync.strftime('%Y-%m-%d'), yesterday.strftime('%Y-%m-%d')])
        
        print(f"Fetched {len(mysql_data)} rows from MySQL. Inserting into Postgres...")
        
        # Insert into Postgres
        if not mysql_data:
            print("No data to sync.")
            return
            
        conn = server.get_pg_conn()
        c = conn.cursor()
        
        inserted = 0
        for row in mysql_data:
            c.execute("""
                INSERT INTO cp2_daily_incomes (date, location_id, total_in, total_out, total_ggr)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (date, location_id) DO NOTHING
            """, (row['date'], str(row['location_id']), row['total_in'], row['total_out'], row['total_ggr']))
            inserted += 1
            
        conn.commit()
        conn.close()
        print(f"Inserted {inserted} rows into Postgres.")
        
    except Exception as e:
        print("Error:", e)
        traceback.print_exc()

if __name__ == '__main__':
    test_sync()
