from server import qry
for r in qry("DESCRIBE player_card_logs;", []): print(r['Field'])
print("---")
for r in qry("SELECT * FROM player_card_logs ORDER BY id DESC LIMIT 2;", []): print(r)
