import os
import uuid
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

os.makedirs('uploads/contracts', exist_ok=True)
location_id = 5  # Craiova

files_to_import = [
    {"path": "./Craiova/Contract de închiriere.pdf", "is_annex": False},
    {"path": "./Craiova/Anexa 1 la contractul de închiriere.pdf", "is_annex": True},
    {"path": "./Craiova/Contract COCA-COLA - comodat echipamente frigorifice.pdf", "is_annex": False},
    {"path": "./Craiova/Contract Fort Security - Paza si Interventie.pdf", "is_annex": False},
    {"path": "./Craiova/Contract Iridex Salubrizare.pdf", "is_annex": False},
    {"path": "./Craiova/Contract SC Compania de Apa Oltenia SA.pdf", "is_annex": False},
    {"path": "./Craiova/Contract SC.ROMTEHNIC SYSTEM SRL. - Mentenanta camere sistem de supraveghere video.pdf", "is_annex": False},
    {"path": "./Craiova/S.C. PRESTING SRL - Stingatoare.pdf", "is_annex": False},
    {"path": "./Craiova/UCMR ada.pdf", "is_annex": False}
]

main_rental_contract_id = None

for item in files_to_import:
    fpath = item["path"]
    is_annex = item["is_annex"]
    fname = os.path.basename(fpath)
    
    if not os.path.exists(fpath):
        print(f"Warning: File {fpath} not found. Skipping.")
        continue
        
    print(f"\nProcessing {fname} (Annex: {is_annex})...")
    
    c_type = 'Altele'
    if "inchiriere" in fname.lower() or "închiriere" in fname.lower(): c_type = 'Chirie Spațiu'
    elif "paza" in fname.lower(): c_type = 'Pază și Protecție'
    elif "salubrizare" in fname.lower(): c_type = 'Curățenie'
    elif "apa" in fname.lower(): c_type = 'Utilități (Apă, Gaze, Curent)'
    elif "mentenanta" in fname.lower(): c_type = 'Mentenanță'
    
    owner = fname.replace('.pdf', '')
    
    amount = 0
    curr = 'LEI'
    s_date = datetime.now().strftime('%Y-%m-%d')
    e_date = None
    
    if is_annex and main_rental_contract_id:
        contract_id = main_rental_contract_id
        print(f"Linking annex to existing contract ID: {contract_id}")
    else:
        contract_id = str(uuid.uuid4())
        q = '''INSERT INTO cp2_contracts (id, type, currency, total_amount, start_date, end_date, contract_number, details, owner_name, address, m2, notice_period_months)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)'''
        pg_qry(q, (contract_id, c_type, curr, amount, s_date, e_date, '', '', owner, 'Craiova', 0, 0))
        
        pg_qry('INSERT INTO cp2_contract_locations (contract_id, location_id, amount) VALUES (%s, %s, %s)', (contract_id, location_id, amount))
        print(f"Created new fallback contract with ID: {contract_id}")
        
        if c_type == 'Chirie Spațiu' and not main_rental_contract_id:
            main_rental_contract_id = contract_id
            
    file_id = str(uuid.uuid4())
    safe_name = f"{file_id}_{fname.replace(' ', '_')}"
    dest_path = os.path.join('uploads', 'contracts', safe_name)
    
    shutil.copy(fpath, dest_path)
    
    pg_qry('''INSERT INTO cp2_contract_files (id, contract_id, is_annex, filename, filepath)
                  VALUES (%s, %s, %s, %s, %s)''',
               (file_id, contract_id, is_annex, fname, dest_path))
    print(f"Attached file {fname} successfully.")
    
print("\nFallback import completed successfully!")
