import pymysql
conn = pymysql.connect(host='161.97.133.165', user='eugen', password='(@Ee0wRHVohZww33', database='cyberslot_dbn', cursorclass=pymysql.cursors.DictCursor)
with conn.cursor() as c:
    c.execute("DESCRIBE users;")
    for row in c.fetchall(): print(row)
