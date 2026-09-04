import psycopg2
import uuid
import os
import shutil
import glob
from datetime import datetime

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

conn = psycopg2.connect(**PG_DB_CFG)
c = conn.cursor()

print("Deleting contracts from Location 2...")
c.execute("""
SELECT c.id FROM cp2_contracts c
JOIN cp2_contract_locations cl ON c.id = cl.contract_id
WHERE cl.location_id = 2
""")
rows = c.fetchall()
ids = [r[0] for r in rows]

if ids:
    for cid in ids:
        c.execute("DELETE FROM cp2_contract_files WHERE contract_id = %s", (cid,))
        c.execute("DELETE FROM cp2_contract_locations WHERE contract_id = %s", (cid,))
        c.execute("DELETE FROM cp2_contracts WHERE id = %s", (cid,))
    print(f"Deleted {len(ids)} contracts from Location 2.")

missing_folders = [
    "Ploiesti/Contract SC MIREA OFFICE MANAGEMENT SRL (CONTRACT MANAGEMENT MIREA MIHAI)/",
    "Ploiesti/Contract All Consulting Service SRL - PSI si SSM/",
    "Ploiesti/Contract subinchiriere Turkish Doner Steak House SRL/"
]
loc_id = 7
address = "Sos. Nordului 1, Ploiesti , Prahova"

for sf in missing_folders:
    if not os.path.exists(sf):
        continue
    folder_name = os.path.basename(os.path.normpath(sf))
    
    c_type = "Altele"
    owner = folder_name.replace("Contract ", "")
    if "(" in folder_name and ")" in folder_name:
        c_type_raw = folder_name.split("(")[1].split(")")[0].lower()
        owner = folder_name.split("(")[0].replace("Contract ", "").strip()
        if "psi" in c_type_raw or "ssm" in c_type_raw: c_type = "Mentenanță"
    elif "subinchiriere" in folder_name.lower():
        c_type = "Chirie Spațiu"
        owner = owner.replace("subinchiriere", "").strip()

    print(f"Inserting {owner} into Location 7...")
    contract_id = str(uuid.uuid4())
    s_date = datetime.now().strftime("%Y-%m-%d")
    
    c.execute("""
        INSERT INTO cp2_contracts (id, type, currency, total_amount, start_date, owner_name, address, m2, notice_period_months)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0)
    """, (contract_id, c_type, "LEI", 0, s_date, owner, address))
    
    c.execute("INSERT INTO cp2_contract_locations (contract_id, location_id, amount) VALUES (%s, %s, 0)", (contract_id, loc_id))
    
    files = glob.glob(f"{sf}*.pdf")
    for fpath in files:
        fname = os.path.basename(fpath)
        is_annex = False
        if "acord" in fname.lower() or "anexa" in fname.lower():
            is_annex = True
            
        file_id = str(uuid.uuid4())
        safe_name = f"{file_id}_{fname.replace(' ', '_')}"
        dest_path = os.path.join("uploads", "contracts", safe_name)
        shutil.copy(fpath, dest_path)
        
        c.execute("""
            INSERT INTO cp2_contract_files (id, contract_id, is_annex, filename, filepath)
            VALUES (%s, %s, %s, %s, %s)
        """, (file_id, contract_id, is_annex, fname, dest_path))

conn.commit()
print("Done!")
