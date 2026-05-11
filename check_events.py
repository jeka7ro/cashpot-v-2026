from server import qry
for t in qry("SHOW TABLES LIKE '%event%';", []): print(t)
