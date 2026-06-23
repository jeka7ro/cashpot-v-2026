import server
import json
import cp2_db

conn = cp2_db.get_db()
c = conn.cursor(cursor_factory=server.RealDictCursor)
c.execute("SELECT * FROM cp2_users LIMIT 2")
rows = c.fetchall()
print("Postgres users:", json.dumps([dict(r) for r in rows], default=str))

c.execute("SELECT * FROM cp2_invitations")
print("Postgres invites:", len(c.fetchall()))

