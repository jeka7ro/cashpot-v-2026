import os
import uuid
import glob
import psycopg2
from datetime import datetime
import shutil

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

def pg_qry(sql, params=None):
    conn = psycopg2.connect(**PG_DB_CFG)
    try:
        with conn.cursor() as c:
            c.execute(sql, params or ())
            try:
                rows = c.fetchall()
                cols = [desc[0] for desc in c.description]
                res = [dict(zip(cols, r)) for r in rows]
            except Exception as e:
                res = []
        conn.commit()
        return res
    finally:
        conn.close()

# Fetch existing contracts grouped by location_id
existing_contracts = pg_qry("""
    SELECT c.id, c.owner_name, cl.location_id
    FROM cp2_contracts c
    JOIN cp2_contract_locations cl ON c.id = cl.contract_id
""")

def check_exists(owner_name_folder, location_id):
    folder_owner_clean = owner_name_folder.lower().replace('-', '').replace(' ', '').replace('.', '')
    for c in existing_contracts:
        if c['location_id'] == location_id:
            db_owner_clean = c['owner_name'].lower().replace('-', '').replace(' ', '').replace('.', '')
            if folder_owner_clean in db_owner_clean or db_owner_clean in folder_owner_clean:
                return True
    return False

os.makedirs('uploads/contracts', exist_ok=True)

folders_to_process = [
    {"folder": "Ploiesti", "location_id": 2, "address": "Ploiesti"},
    {"folder": "Ploiesti Nord", "location_id": 7, "address": "Sos. Nordului 1, Ploiesti , Prahova"}
]

for folder_info in folders_to_process:
    base_folder = folder_info["folder"]
    loc_id = folder_info["location_id"]
    address = folder_info["address"]
    
    print(f"\\n--- PROCESARE {base_folder} (ID: {loc_id}) ---")
    
    subfolders = glob.glob(f"{base_folder}/*/")
    
    for sf in subfolders:
        folder_name = os.path.basename(os.path.normpath(sf))
        
        # Deduce owner and type from folder name
        c_type = 'Altele'
        owner = folder_name.replace('Contract ', '')
        
        if "(" in folder_name and ")" in folder_name:
            c_type_raw = folder_name.split("(")[1].split(")")[0].lower()
            owner = folder_name.split("(")[0].replace('Contract ', '').strip()
            
            if "curatenie" in c_type_raw or "salubritate" in c_type_raw: c_type = 'Curățenie'
            elif "paza" in c_type_raw or "interventie" in c_type_raw or "monitorizare" in c_type_raw: c_type = 'Pază și Protecție'
            elif "medicina" in c_type_raw: c_type = 'Medicina Muncii'
            elif "muzica" in c_type_raw or "drepturi" in c_type_raw or "ucmr" in c_type_raw: c_type = 'Taxe (Licențe/Drepturi de Autor)'
            elif "psi" in c_type_raw or "ssm" in c_type_raw: c_type = 'Mentenanță'
            else: c_type = 'Altele'
        elif "subinchiriere" in folder_name.lower() or "chirie" in folder_name.lower() or "inchiriere" in folder_name.lower():
            c_type = 'Chirie Spațiu'
            owner = owner.replace('subinchiriere', '').strip()
            
        print(f"\\nGroup: {folder_name} -> Deducted Owner: {owner}")
        
        if check_exists(owner, loc_id):
            print(f"  [SKIP] Contract for {owner} at location {loc_id} ALREADY EXISTS. Skipping folder.")
            continue
            
        files = glob.glob(f"{sf}*.pdf")
        main_contract_id = None
        
        def is_annex_heuristic(fpath):
            name = os.path.basename(fpath).lower()
            if "act aditional" in name or "acte aditionale" in name or "anexa" in name or "acord" in name or "actualizare" in name:
                return True
            return False
            
        files.sort(key=lambda x: is_annex_heuristic(x))
        
        for fpath in files:
            is_annex = is_annex_heuristic(fpath)
            fname = os.path.basename(fpath)
            
            print(f"  Processing {fname} (Annex: {is_annex})...")
            
            amount = 0
            curr = 'LEI'
            s_date = datetime.now().strftime('%Y-%m-%d')
            e_date = None
            
            if is_annex and main_contract_id:
                contract_id = main_contract_id
                print(f"  Linking annex to existing contract ID: {contract_id}")
            else:
                contract_id = str(uuid.uuid4())
                q = '''INSERT INTO cp2_contracts (id, type, currency, total_amount, start_date, end_date, contract_number, details, owner_name, address, m2, notice_period_months)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)'''
                pg_qry(q, (contract_id, c_type, curr, amount, s_date, e_date, '', '', owner, address, 0, 0))
                
                pg_qry('INSERT INTO cp2_contract_locations (contract_id, location_id, amount) VALUES (%s, %s, %s)', (contract_id, loc_id, amount))
                print(f"  Created new contract ID: {contract_id} (Type: {c_type}, Owner: {owner}, Address: {address})")
                
                if not main_contract_id:
                    main_contract_id = contract_id
                    
            file_id = str(uuid.uuid4())
            safe_name = f"{file_id}_{fname.replace(' ', '_')}"
            dest_path = os.path.join('uploads', 'contracts', safe_name)
            
            shutil.copy(fpath, dest_path)
            
            pg_qry('''INSERT INTO cp2_contract_files (id, contract_id, is_annex, filename, filepath)
                          VALUES (%s, %s, %s, %s, %s)''',
                       (file_id, contract_id, is_annex, fname, dest_path))
            print(f"  Attached file {fname} successfully.")
            
print("\\nFallback import completed successfully!")
