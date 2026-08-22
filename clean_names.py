import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        updates = [
            ("Contract SC.ROMTEHNIC SYSTEM SRL. - Mentenanta camere sistem de supraveghere video", "SC ROMTEHNIC SYSTEM SRL"),
            ("Contract SC Compania de Apa Oltenia SA", "Compania de Apa Oltenia SA"),
            ("Contract COCA-COLA - comodat echipamente frigorifice", "COCA-COLA"),
            ("Contract Fort Security - Paza si Interventie", "Fort Security"),
            ("Contract Iridex Salubrizare", "Iridex"),
            ("S.C. PRESTING SRL - Stingatoare", "S.C. PRESTING SRL"),
            ("UCMR ada", "UCMR ADA")
        ]
        for old_name, new_name in updates:
            c.execute("UPDATE cp2_contracts SET owner_name = %s WHERE owner_name = %s", (new_name, old_name))
        conn.commit()
        print("Cleaned up owner names.")
finally:
    conn.close()
