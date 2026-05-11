from server import qry

for t in qry("SHOW TABLES LIKE '%handpay%';", []): print(t)
for t in qry("SHOW TABLES LIKE '%jackpot%';", []): print(t)
