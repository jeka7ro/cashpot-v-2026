import sqlite3
import os
import hashlib
import json
import secrets

DB_DIR = os.getenv('DB_DIR', os.path.dirname(__file__))
DB_PATH = os.path.join(DB_DIR, 'cashpot2.db')

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password_hash TEXT,
        role TEXT,
        avatar TEXT,
        phone TEXT,
        permissions TEXT,
        token TEXT
    )''')
    # Try adding token if table exists
    try:
        c.execute('ALTER TABLE users ADD COLUMN token TEXT')
    except sqlite3.OperationalError:
        pass

    c.execute('''CREATE TABLE IF NOT EXISTS slot_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS slot_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER,
        filename TEXT,
        filepath TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        email TEXT,
        role TEXT,
        used BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Check for admin
    c.execute("SELECT id FROM users WHERE email = 'jeka7ro@gmail.com'")
    if not c.fetchone():
        pwd_hash = hashlib.sha256('11Mai2026!'.encode()).hexdigest()
        tok1 = hashlib.sha256(('jeka7ro@gmail.com' + "CASHPOT_STATIC_SEC_2026").encode()).hexdigest()
        c.execute('''INSERT INTO users (name, email, password_hash, role, permissions, token) 
                     VALUES (?, ?, ?, ?, ?, ?)''', 
                  ('Super Admin', 'jeka7ro@gmail.com', pwd_hash, 'Super Admin', '{}', tok1))
    
    # Check for Andrei Chiaperi
    c.execute("SELECT id FROM users WHERE email = 'andrei@chiaperi.ro'")
    if not c.fetchone():
        pwd_hash_andrei = hashlib.sha256('Andreigay'.encode()).hexdigest()
        tok2 = hashlib.sha256(('andrei@chiaperi.ro' + "CASHPOT_STATIC_SEC_2026").encode()).hexdigest()
        c.execute('''INSERT INTO users (name, email, password_hash, role, permissions, token) 
                     VALUES (?, ?, ?, ?, ?, ?)''', 
                  ('Andrei Chiaperi', 'andrei@chiaperi.ro', pwd_hash_andrei, 'Super Admin', '{}', tok2))
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Local SQLite DB initialized.")
