import pymysql
conn = pymysql.connect(host='161.97.133.165', user='eugen', password='(@Ee0wRHVohZww33', database='cyberslot_dbn', cursorclass=pymysql.cursors.DictCursor)
with conn.cursor() as c:
    try:
        c.execute("ALTER TABLE users ADD COLUMN avatar TEXT;")
        conn.commit()
        print("Added avatar column")
    except Exception as e:
        print("Error:", e)
