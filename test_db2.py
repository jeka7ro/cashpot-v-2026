import pymysql
conn = pymysql.connect(host='161.97.133.165', user='eugen', password='(@Ee0wRHVohZww33', database='cyberslot_dbn', cursorclass=pymysql.cursors.DictCursor)
with conn.cursor() as c:
    c.execute("""
    SELECT
        p.id,
        (SELECT ROUND(SUM(mas.`in`), 0)
         FROM (
             SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(pcl2.params, '$.machine_id')) as m_id, DATE(pcl2.created_at) as m_date
             FROM player_card_logs pcl2
             WHERE pcl2.player_id = p.id AND pcl2.created_at >= '2026-05-01' AND pcl2.created_at <= '2026-05-11 23:59:59' AND pcl2.log_type = 2
         ) as uniq_sessions
         JOIN machine_audit_summaries mas ON mas.machine_id = uniq_sessions.m_id AND mas.date = uniq_sessions.m_date
        ) as total_in_perioada
    FROM players p
    LIMIT 5
    """)
    print(c.fetchall())
