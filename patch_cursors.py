with open('server.py', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'conn = cp2_db.get_db()' in line:
        # The next line should be c = conn.cursor()
        for j in range(i+1, min(i+5, len(lines))):
            if 'c = conn.cursor()' in lines[j]:
                lines[j] = lines[j].replace('c = conn.cursor()', 'c = conn.cursor(cursor_factory=RealDictCursor)')
                break
            if 'c2 = cp_conn.cursor()' in lines[j]: # Special case in slots_inventory
                lines[j] = lines[j].replace('c2 = cp_conn.cursor()', 'c2 = cp_conn.cursor(cursor_factory=RealDictCursor)')
                break

with open('server.py', 'w') as f:
    f.writelines(lines)
print("Cursors patched!")
