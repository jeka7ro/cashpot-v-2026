import re

with open('server.py', 'r') as f:
    content = f.read()

# Replace the slow insert loop with execute_values
old_code = """        if mysql_data:
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
            conn.commit()"""

new_code = """        if mysql_data:
            import psycopg2.extras
            values = []
            for row in mysql_data:
                values.append((
                    row['dt'], str(row['location_id']), str(row['machine_id']), str(row['machine_type_id']),
                    row['total_in'] or 0, row['total_out'] or 0, row['games'] or 0, row['bet'] or 0, row['win'] or 0,
                    row['jackpot'] or 0, row['hh'] or 0, row['cb_fortune_wheel'] or 0, row['cashback'] or 0
                ))
            try:
                psycopg2.extras.execute_values(
                    c,
                    '''
                    INSERT INTO cp2_hourly_incomes 
                    (dt, location_id, machine_id, machine_type_id, total_in, total_out, games, bet, win, jackpot, hh, cb_fortune_wheel, cashback)
                    VALUES %s
                    ON CONFLICT (dt, location_id, machine_id) DO NOTHING
                    ''',
                    values,
                    page_size=1000
                )
                conn.commit()
            except Exception as e:
                print("Bulk insert failed:", e)"""

content = content.replace(old_code, new_code)

with open('server.py', 'w') as f:
    f.write(content)

