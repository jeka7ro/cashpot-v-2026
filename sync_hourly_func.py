def sync_hourly_incomes():
    try:
        conn = get_pg_conn()
        c = conn.cursor()
        c.execute("SELECT MAX(dt) FROM cp2_hourly_incomes")
        row = c.fetchone()
        max_dt = row[0] if row and row[0] else None
        
        import datetime
        now = datetime.datetime.now()
        # Cutoff is today at 08:00
        cutoff = now.replace(hour=8, minute=0, second=0, microsecond=0)
        if now < cutoff:
            cutoff = cutoff - datetime.timedelta(days=1)
            
        if max_dt is None:
            # Start from 30 days ago to avoid pulling years of hourly data live
            start_sync = cutoff - datetime.timedelta(days=30)
        else:
            start_sync = max_dt + datetime.timedelta(hours=1)
            
        if start_sync >= cutoff:
            conn.close()
            return
            
        mysql_sql = '''
            SELECT 
                mas.date as dt, mas.location_id, mas.machine_id, mas.machine_type_id,
                mas.`in` as total_in, mas.`out` as total_out, mas.games, mas.bet, mas.win,
                mas.jackpot, mas.hh, mas.cb_fortune_wheel, mas.cashback
            FROM machine_audit_summary_per_hours mas
            WHERE mas.date >= %s AND mas.date < %s
        '''
        mysql_data = qry(mysql_sql, [start_sync.strftime('%Y-%m-%d %H:%M:%S'), cutoff.strftime('%Y-%m-%d %H:%M:%S')])
        
        if mysql_data:
            for row in mysql_data:
                try:
                    c.execute('''
                        INSERT INTO cp2_hourly_incomes 
                        (dt, location_id, machine_id, machine_type_id, total_in, total_out, games, bet, win, jackpot, hh, cb_fortune_wheel, cashback)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (dt, location_id, machine_id) DO NOTHING
                    ''', (
                        row['dt'], str(row['location_id']), str(row['machine_id']), str(row['machine_type_id']),
                        row['total_in'] or 0, row['total_out'] or 0, row['games'] or 0, row['bet'] or 0, row['win'] or 0,
                        row['jackpot'] or 0, row['hh'] or 0, row['cb_fortune_wheel'] or 0, row['cashback'] or 0
                    ))
                except:
                    pass
            conn.commit()
        conn.close()
    except Exception as e:
        print("Error in sync_hourly_incomes:", e)
