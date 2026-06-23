import server
import datetime

def sync_player_sessions():
    conn = server.get_pg_conn()
    c = conn.cursor()
    c.execute("SELECT MAX(dt) as max_dt FROM cp2_player_sessions")
    row = c.fetchone()
    max_dt = row[0] if row and row[0] else None
    
    now = datetime.datetime.now()
    # The casino day ends at 08:00 AM. 
    # The actual "DATE" for a session is determined by "bet_at - 8 hours".
    # So if it's 02:00 AM on June 2nd, the DATE is June 1st.
    cutoff_date = (now - datetime.timedelta(hours=8)).date()
    
    if max_dt is None:
        # Initial sync: last 60 days
        start_date = cutoff_date - datetime.timedelta(days=60)
    else:
        # Incremental sync: start from max_dt (since we might have missed late updates)
        start_date = max_dt
        
    if start_date >= cutoff_date:
        print("Player cache already up to date up to", cutoff_date)
        return
        
    print(f"Syncing player sessions from {start_date} to {cutoff_date}...")
    
    # We query player_points_bets up to the cutoff_date.
    mysql_sql = """
        SELECT 
            DATE(ppb.bet_at - INTERVAL 8 HOUR) as dt,
            ppb.player_id,
            ppb.machine_id,
            m.location_id,
            SUM(ppb.total_bet) as total_bet,
            SUM(ppb.points) as points
        FROM player_points_bets ppb
        LEFT JOIN machines m ON ppb.machine_id = m.id
        WHERE DATE(ppb.bet_at - INTERVAL 8 HOUR) >= %s 
          AND DATE(ppb.bet_at - INTERVAL 8 HOUR) < %s
          AND ppb.total_bet > 0
        GROUP BY 1, 2, 3, 4
    """
    mysql_data = server.qry(mysql_sql, [start_date.strftime('%Y-%m-%d'), cutoff_date.strftime('%Y-%m-%d')])
    
    print(f"Fetched {len(mysql_data)} player session records from MySQL.")
    
    if mysql_data:
        inserted = 0
        for row in mysql_data:
            try:
                c.execute("""
                    INSERT INTO cp2_player_sessions 
                    (dt, player_id, location_id, machine_id, total_bet, points)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (dt, player_id, machine_id) DO UPDATE SET
                        total_bet = cp2_player_sessions.total_bet + EXCLUDED.total_bet,
                        points = cp2_player_sessions.points + EXCLUDED.points
                """, (
                    row['dt'], str(row['player_id']), str(row['location_id']), str(row['machine_id']),
                    row['total_bet'] or 0, row['points'] or 0
                ))
                inserted += 1
            except Exception as e:
                print("Error inserting:", e)
                conn.rollback()
                break
        conn.commit()
        print(f"Inserted/Updated {inserted} rows into cp2_player_sessions.")
        
    conn.close()

if __name__ == '__main__':
    sync_player_sessions()
