import psycopg2

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        # Set ROMTEHNIC to 250
        c.execute("UPDATE cp2_contracts SET total_amount = 250 WHERE owner_name = 'SC ROMTEHNIC SYSTEM SRL'")
        c.execute("UPDATE cp2_contract_locations SET amount = 250 WHERE contract_id = (SELECT id FROM cp2_contracts WHERE owner_name = 'SC ROMTEHNIC SYSTEM SRL')")
        
        # Set Fort Security to 24.88
        c.execute("UPDATE cp2_contracts SET total_amount = 24.88 WHERE owner_name = 'Fort Security'")
        c.execute("UPDATE cp2_contract_locations SET amount = 24.88 WHERE contract_id = (SELECT id FROM cp2_contracts WHERE owner_name = 'Fort Security')")
        
        # Set COCA-COLA to 0 (comodat)
        c.execute("UPDATE cp2_contracts SET total_amount = 0 WHERE owner_name = 'COCA-COLA'")
        c.execute("UPDATE cp2_contract_locations SET amount = 0 WHERE contract_id = (SELECT id FROM cp2_contracts WHERE owner_name = 'COCA-COLA')")
        
        # Set the rest to 0 (Iridex, Apa, Presting, UCMR) - they are variable, so base is 0
        variable_owners = ['Iridex', 'Compania de Apa Oltenia SA', 'S.C. PRESTING SRL', 'UCMR ADA']
        for o in variable_owners:
            c.execute("UPDATE cp2_contracts SET total_amount = 0 WHERE owner_name = %s", (o,))
            c.execute("UPDATE cp2_contract_locations SET amount = 0 WHERE contract_id = (SELECT id FROM cp2_contracts WHERE owner_name = %s)", (o,))
            
        conn.commit()
        print("Updated amounts.")
finally:
    conn.close()
