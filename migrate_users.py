import sqlite3
import psycopg2
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'cashpot2.db')

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"No local db at {DB_PATH}")
        return

    lite_conn = sqlite3.connect(DB_PATH)
    lite_conn.row_factory = sqlite3.Row
    lc = lite_conn.cursor()

    pg_conn = psycopg2.connect(**PG_DB_CFG)
    pc = pg_conn.cursor()

    # 1. Create tables in PG with cp2_ prefix
    print("Creating tables in PG...")
    pc.execute('''CREATE TABLE IF NOT EXISTS cp2_users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        password_hash TEXT,
        role TEXT,
        avatar TEXT,
        phone TEXT,
        permissions TEXT,
        token TEXT
    )''')

    pc.execute('''CREATE TABLE IF NOT EXISTS cp2_slot_notes (
        id SERIAL PRIMARY KEY,
        machine_id INTEGER,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    pc.execute('''CREATE TABLE IF NOT EXISTS cp2_slot_files (
        id SERIAL PRIMARY KEY,
        machine_id INTEGER,
        filename TEXT,
        filepath TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    pc.execute('''CREATE TABLE IF NOT EXISTS cp2_invitations (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE,
        email TEXT,
        role TEXT,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        permissions TEXT
    )''')
    pg_conn.commit()

    # 2. Migrate users
    print("Migrating users...")
    lc.execute("SELECT * FROM users")
    users = lc.fetchall()
    for u in users:
        try:
            pc.execute('''INSERT INTO cp2_users (id, name, email, password_hash, role, avatar, phone, permissions, token) 
                          VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT(email) DO NOTHING''', 
                       (u['id'], u['name'], u['email'], u['password_hash'], u['role'], u['avatar'], u['phone'], u['permissions'], u['token']))
        except Exception as e:
            print("Error inserting user:", e)
            pg_conn.rollback()
        else:
            pg_conn.commit()

    # 3. Migrate invitations
    print("Migrating invitations...")
    try:
        lc.execute("SELECT * FROM invitations")
        invs = lc.fetchall()
        for i in invs:
            perms = i['permissions'] if 'permissions' in i.keys() else '{}'
            try:
                pc.execute('''INSERT INTO cp2_invitations (id, code, email, role, used, created_at, permissions) 
                              VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT(code) DO NOTHING''', 
                           (i['id'], i['code'], i['email'], i['role'], bool(i['used']), i['created_at'], perms))
            except Exception as e:
                print("Error inserting invitation:", e)
                pg_conn.rollback()
            else:
                pg_conn.commit()
    except sqlite3.OperationalError:
        print("Invitations table not found in SQLite.")

    # 4. Migrate slot_notes
    print("Migrating slot_notes...")
    try:
        lc.execute("SELECT * FROM slot_notes")
        notes = lc.fetchall()
        for n in notes:
            try:
                pc.execute('''INSERT INTO cp2_slot_notes (id, machine_id, note, created_at) 
                              VALUES (%s, %s, %s, %s) ON CONFLICT(id) DO NOTHING''', 
                           (n['id'], n['machine_id'], n['note'], n['created_at']))
            except Exception as e:
                print("Error inserting slot_note:", e)
                pg_conn.rollback()
            else:
                pg_conn.commit()
    except sqlite3.OperationalError:
        print("slot_notes table not found in SQLite.")

    # 5. Migrate slot_files
    print("Migrating slot_files...")
    try:
        lc.execute("SELECT * FROM slot_files")
        files = lc.fetchall()
        for f in files:
            try:
                pc.execute('''INSERT INTO cp2_slot_files (id, machine_id, filename, filepath, created_at) 
                              VALUES (%s, %s, %s, %s, %s) ON CONFLICT(id) DO NOTHING''', 
                           (f['id'], f['machine_id'], f['filename'], f['filepath'], f['created_at']))
            except Exception as e:
                print("Error inserting slot_file:", e)
                pg_conn.rollback()
            else:
                pg_conn.commit()
    except sqlite3.OperationalError:
        print("slot_files table not found in SQLite.")

    # Update sequences
    print("Updating sequences...")
    tables = ['cp2_users', 'cp2_invitations', 'cp2_slot_notes', 'cp2_slot_files']
    for t in tables:
        try:
            pc.execute(f"SELECT setval('{t}_id_seq', (SELECT MAX(id) FROM {t}));")
            pg_conn.commit()
        except Exception as e:
            pg_conn.rollback()
            print(f"Could not update sequence for {t}: {e}")

    lite_conn.close()
    pg_conn.close()
    print("Migration complete!")

if __name__ == '__main__':
    migrate()
