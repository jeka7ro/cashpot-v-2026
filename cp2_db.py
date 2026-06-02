import psycopg2
import os
import hashlib
import json
from psycopg2.extras import RealDictCursor

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

def get_db():
    conn = psycopg2.connect(**PG_DB_CFG)
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS cp2_users (
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

    c.execute('''CREATE TABLE IF NOT EXISTS cp2_slot_notes (
        id SERIAL PRIMARY KEY,
        machine_id INTEGER,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS cp2_slot_files (
        id SERIAL PRIMARY KEY,
        machine_id INTEGER,
        filename TEXT,
        filepath TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS cp2_invitations (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE,
        email TEXT,
        role TEXT,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        permissions TEXT
    )''')
    
    # Check for admin
    c.execute("SELECT id FROM cp2_users WHERE email = 'jeka7ro@gmail.com'")
    if not c.fetchone():
        pwd_hash = hashlib.sha256('11Mai2026!'.encode()).hexdigest()
        tok1 = hashlib.sha256(('jeka7ro@gmail.com' + "CASHPOT_STATIC_SEC_2026").encode()).hexdigest()
        c.execute('''INSERT INTO cp2_users (name, email, password_hash, role, permissions, token) 
                     VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT(email) DO NOTHING''', 
                  ('Super Admin', 'jeka7ro@gmail.com', pwd_hash, 'Super Admin', '{}', tok1))
    
    # Check for Andrei Chiaperi
    c.execute("SELECT id FROM cp2_users WHERE email = 'andrei@chiaperi.ro'")
    if not c.fetchone():
        pwd_hash_andrei = hashlib.sha256('Andreigay'.encode()).hexdigest()
        tok2 = hashlib.sha256(('andrei@chiaperi.ro' + "CASHPOT_STATIC_SEC_2026").encode()).hexdigest()
        c.execute('''INSERT INTO cp2_users (name, email, password_hash, role, permissions, token) 
                     VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT(email) DO NOTHING''', 
                  ('Andrei Chiaperi', 'andrei@chiaperi.ro', pwd_hash_andrei, 'Super Admin', '{}', tok2))
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Postgres DB initialized.")
