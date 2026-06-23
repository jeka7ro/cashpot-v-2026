import re

with open('server.py', 'r') as f:
    content = f.read()

sync_function = """
def sync_historical_incomes():
    try:
        # Get max date from Postgres
        pg_rows = pg_qry("SELECT MAX(date) as max_d FROM cp2_daily_incomes")
        max_d = pg_rows[0]['max_d'] if pg_rows and pg_rows[0]['max_d'] else None
        
        import datetime
        today = datetime.date.today()
        yesterday = today - datetime.timedelta(days=1)
        
        if max_d is None:
            # First run, get last 12 months
            start_sync = today - datetime.timedelta(days=365)
        else:
            start_sync = max_d + datetime.timedelta(days=1)
            
        if start_sync > yesterday:
            return
            
        # Query MySQL for these dates
        mysql_sql = '''
            SELECT 
                mas.date,
                mas.location_id,
                SUM(mas.`in`) as total_in,
                SUM(mas.`out`) as total_out,
                SUM(mas.`in` - mas.`out`) as total_ggr
            FROM machine_audit_summaries mas
            WHERE mas.date >= %s AND mas.date <= %s
            GROUP BY mas.date, mas.location_id
        '''
        mysql_data = qry(mysql_sql, [start_sync.strftime('%Y-%m-%d'), yesterday.strftime('%Y-%m-%d')])
        
        if not mysql_data:
            return
            
        conn = get_pg_conn()
        c = conn.cursor()
        
        for row in mysql_data:
            c.execute('''
                INSERT INTO cp2_daily_incomes (date, location_id, total_in, total_out, total_ggr)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (date, location_id) DO NOTHING
            ''', (row['date'], str(row['location_id']), row['total_in'], row['total_out'], row['total_ggr']))
            
        conn.commit()
        conn.close()
    except Exception as e:
        print("Error in sync_historical_incomes:", e)

"""

if "def sync_historical_incomes" not in content:
    # Insert right before api_pl_heatmap
    content = content.replace("@app.route('/api/reports/pl_heatmap')", sync_function + "\n@app.route('/api/reports/pl_heatmap')")

with open('server.py', 'w') as f:
    f.write(content)
print("Patch applied for sync_historical_incomes")
