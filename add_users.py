import sqlite3
import hashlib
import json

def get_hash(pw):
    return hashlib.sha256(pw.encode('utf-8')).hexdigest()

db_path = 'cashpot2.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

users = [
    ('Laurentiu', 'laurentiu@cashpot.ro', '20Mai2026!', 'Viewer'),
    ('George', 'george@cashpot.ro', '20Mai2026!', 'Viewer'),
    ('Vadim', 'vadim@cashpot.ro', '20Mai2026!', 'Viewer')
]

for name, email, pw, role in users:
    c.execute('SELECT id FROM users WHERE email = ?', (email,))
    if not c.fetchone():
        pw_hash = get_hash(pw)
        # We can give them access to all pages by default as Viewer
        perms = json.dumps({"pages": ["dashboard", "rapoarte", "live"], "locations": []})
        c.execute('''
            INSERT INTO users (name, email, password_hash, role, permissions)
            VALUES (?, ?, ?, ?, ?)
        ''', (name, email, pw_hash, role, perms))
        print(f"Created user {email}")
    else:
        print(f"User {email} already exists")

conn.commit()
conn.close()
