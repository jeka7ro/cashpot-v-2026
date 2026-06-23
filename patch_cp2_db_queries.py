import re

with open('server.py', 'r') as f:
    content = f.read()

# We only want to replace SQL queries involving cp2_db
# Let's find all instances of c.execute(...) that happen after conn = cp2_db.get_db()
# It's safer to just replace the specific SQL strings.

replacements = [
    ("SELECT * FROM users WHERE token=?", "SELECT * FROM cp2_users WHERE token=%s"),
    ("SELECT * FROM users WHERE email=? AND password_hash=?", "SELECT * FROM cp2_users WHERE email=%s AND password_hash=%s"),
    ("UPDATE users SET token=NULL WHERE token=?", "UPDATE cp2_users SET token=NULL WHERE token=%s"),
    ("UPDATE users SET token=? WHERE id=?", "UPDATE cp2_users SET token=%s WHERE id=%s"),
    ("SELECT permissions FROM users WHERE id = ?", "SELECT permissions FROM cp2_users WHERE id = %s"),
    ("UPDATE users SET permissions = ? WHERE id = ?", "UPDATE cp2_users SET permissions = %s WHERE id = %s"),
    ("SELECT id, name, email, role, phone, permissions FROM users", "SELECT id, name, email, role, phone, permissions FROM cp2_users"),
    ("INSERT INTO users (name, email, password_hash, role, phone, permissions)", "INSERT INTO cp2_users (name, email, password_hash, role, phone, permissions)"),
    ("VALUES (?, ?, ?, ?, ?, ?)", "VALUES (%s, %s, %s, %s, %s, %s)"),
    ("UPDATE users SET name=?, email=?, phone=?, permissions=?, role=?, password_hash=? WHERE id=?", "UPDATE cp2_users SET name=%s, email=%s, phone=%s, permissions=%s, role=%s, password_hash=%s WHERE id=%s"),
    ("UPDATE users SET name=?, email=?, phone=?, permissions=?, role=? WHERE id=?", "UPDATE cp2_users SET name=%s, email=%s, phone=%s, permissions=%s, role=%s WHERE id=%s"),
    ("DELETE FROM users WHERE id=?", "DELETE FROM cp2_users WHERE id=%s"),
    ("SELECT machine_id, note, created_at FROM slot_notes", "SELECT machine_id, note, created_at FROM cp2_slot_notes"),
    ("SELECT machine_id, filename, filepath, created_at FROM slot_files", "SELECT machine_id, filename, filepath, created_at FROM cp2_slot_files"),
    ("INSERT INTO slot_notes (machine_id, note) VALUES (?, ?)", "INSERT INTO cp2_slot_notes (machine_id, note) VALUES (%s, %s)"),
    ("INSERT INTO slot_files (machine_id, filename, filepath) VALUES (?, ?, ?)", "INSERT INTO cp2_slot_files (machine_id, filename, filepath) VALUES (%s, %s, %s)"),
    ("ALTER TABLE invitations ADD COLUMN permissions TEXT", "ALTER TABLE cp2_invitations ADD COLUMN permissions TEXT"),
    ("INSERT INTO invitations (code, email, role, permissions) VALUES (?, ?, ?, ?)", "INSERT INTO cp2_invitations (code, email, role, permissions) VALUES (%s, %s, %s, %s)"),
    ("SELECT code, email, role, permissions, created_at FROM invitations", "SELECT code, email, role, permissions, created_at FROM cp2_invitations"),
    ("DELETE FROM invitations WHERE code = ?", "DELETE FROM cp2_invitations WHERE code = %s"),
    ("SELECT * FROM invitations WHERE code=? AND used=0", "SELECT * FROM cp2_invitations WHERE code=%s AND used=FALSE"),
    ("UPDATE invitations SET used=1 WHERE id=?", "UPDATE cp2_invitations SET used=TRUE WHERE id=%s"),
    ("INSERT INTO users (name, email, phone, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?)", "INSERT INTO cp2_users (name, email, phone, password_hash, role, permissions) VALUES (%s, %s, %s, %s, %s, %s)")
]

for old, new in replacements:
    content = content.replace(old, new)

# Special fix for dict_from_row and psycopg2 extras
import_extras = "from psycopg2.extras import RealDictCursor"
if import_extras not in content:
    content = content.replace("import psycopg2", f"import psycopg2\n{import_extras}")

with open('server.py', 'w') as f:
    f.write(content)
print("Queries patched!")
