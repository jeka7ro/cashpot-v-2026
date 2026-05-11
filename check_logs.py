from server import qry
import pprint
r = qry("SELECT * FROM player_card_logs WHERE log_type=5 ORDER BY id DESC LIMIT 5", [])
for x in r: pprint.pprint(x)
