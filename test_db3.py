import pymysql
conn = pymysql.connect(host='161.97.133.165', user='eugen', password='(@Ee0wRHVohZww33', database='cyberslot_dbn', cursorclass=pymysql.cursors.DictCursor)
with conn.cursor() as c:
    c.execute("""
    SELECT
        p.id,
        (SELECT SUM(mas.`in`) 
         FROM machine_audit_summaries mas 
         WHERE mas.id IN (
             SELECT DISTINCT m_a_s.id
             FROM player_card_logs pcl2
             JOIN machine_audit_summaries m_a_s ON m_a_s.machine_id = JSON_UNQUOTE(JSON_EXTRACT(pcl2.params, '$.machine_id')) 
                                               AND m_a_s.date = DATE(pcl2.created_at)
             WHERE pcl2.player_id = p.id AND pcl2.created_at >= '2026-05-01' AND pcl2.created_at <= '2026-05-11 23:59:59' AND pcl2.log_type = 2
         )
        ) as total_in_perioada
    FROM players p
    LIMIT 5
    """)
    print(c.fetchall())
