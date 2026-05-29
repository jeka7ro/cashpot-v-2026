import pymysql
from server import DB_CFG

conn = pymysql.connect(**DB_CFG)
c = conn.cursor(pymysql.cursors.DictCursor)

sql = """
    SELECT 
        (
            COALESCE((SELECT SUM(amount) FROM player_cashback_in_outs WHERE player_id = p.id AND created_at BETWEEN %s AND %s), 0) +
            COALESCE((SELECT SUM(amount) FROM player_fortune_wheel_transactions WHERE player_id = p.id AND created_at BETWEEN %s AND %s), 0) +
            COALESCE((SELECT SUM(amount) FROM player_raffle_transactions WHERE player_id = p.id AND created_at BETWEEN %s AND %s), 0) +
            COALESCE((SELECT SUM(credits) FROM player_bonus_conversions WHERE player_id = p.id AND created_at BETWEEN %s AND %s), 0) +
            COALESCE((SELECT SUM(amount) FROM player_transactions WHERE player_id = p.id AND created_at BETWEEN %s AND %s AND (reason LIKE '%%Campanie%%' OR reason LIKE '%%Fortune%%' OR reason LIKE '%%Birthday%%' OR reason = 'JP' OR reason LIKE '%%Tombol%%')), 0) +
            COALESCE((SELECT SUM(hit_value) FROM player_jackpot_histories WHERE player_id = p.id AND hit_date BETWEEN %s AND %s), 0)
        ) as promo_amount
    FROM players p WHERE p.id = 1128
"""
c.execute(sql, ['2026-05-01', '2026-05-29 23:59:59'] * 6)
print(c.fetchone())
