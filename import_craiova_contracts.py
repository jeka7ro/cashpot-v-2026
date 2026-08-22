import os
import uuid
import json
import time
import psycopg2
from datetime import datetime
from google import genai
from google.genai import types
from werkzeug.utils import secure_filename

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

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY is not set.")
    exit(1)

gemini_client = genai.Client()

schema = {
    "type": "OBJECT",
    "properties": {
        "contract_number": {"type": "STRING", "description": "Numărul contractului sau numărul actului adițional (dacă există)"},
        "type": {"type": "STRING", "description": "Tipul contractului (ex: Chirie Spațiu, Prestări Servicii, Utilități, Pază)"},
        "owner_name": {"type": "STRING", "description": "Numele companiei (furnizorului) cu care s-a încheiat contractul"},
        "start_date": {"type": "STRING", "description": "Data de început în format YYYY-MM-DD"},
        "end_date": {"type": "STRING", "description": "Data de expirare în format YYYY-MM-DD (lasă gol dacă nu e specificată/clară)"},
        "total_amount": {"type": "NUMBER", "description": "Suma totală lunară calculată. Dacă este tarif pe oră sau pe zi, calculează pentru 30 de zile. Dacă nu este stipulat sau este variabil, pune 0."},
        "currency": {"type": "STRING", "description": "Valuta (ex: LEI, EUR)"},
        "details": {"type": "STRING", "description": "Descriere scurtă a obiectului contractului"},
        "address": {"type": "STRING", "description": "Adresa exactă a spațiului sau sediului care face obiectul contractului (ex: str. Unirii nr. 5, Craiova)"},
        "m2": {"type": "NUMBER", "description": "Suprafața spațiului în metri pătrați (m²) dacă este specificată în contract (altfel pune 0 sau lasă gol)"},
        "notice_period_months": {"type": "NUMBER", "description": "Perioada de preaviz în luni (ex: 3) dacă este specificată (altfel pune 0)"}
    },
    "required": ["type", "owner_name", "total_amount", "currency"]
}

prompt = "Te rog să analizezi acest contract scanat și să extragi datele esențiale folosind strict structura JSON cerută. Extrage cu precizie adresa spațiului/locației contractate (pentru coloana address), perioada de preaviz, suprafața m2, numărul contractului, prețul total/lunar și numele furnizorului."

os.makedirs('uploads/contracts', exist_ok=True)
location_id = 5  # Craiova

files_to_import = [
    # Main contract first to link the annex easily
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
    
    # Copy to a temporary ASCII file to avoid Python unicode/ASCII encoding errors on upload
    import shutil
    temp_upload_path = os.path.join('/tmp', f"upload_{uuid.uuid4()}.pdf")
    shutil.copy(fpath, temp_upload_path)
    
    # 1. Upload to Gemini
    try:
        gemini_file = gemini_client.files.upload(file=temp_upload_path)
        print("File uploaded to Gemini successfully.")
    except Exception as e:
        print(f"Error uploading file to Gemini: {e}")
        if os.path.exists(temp_upload_path):
            os.remove(temp_upload_path)
        continue
    finally:
        if os.path.exists(temp_upload_path):
            os.remove(temp_upload_path)
        
    # 2. Extract content with retry
    extracted = None
    for attempt in range(3):
        try:
            response = gemini_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[gemini_file, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            extracted = json.loads(response.text)
            break
        except Exception as e:
            print(f"Attempt {attempt+1} failed: {e}")
            time.sleep(2)
            
    if not extracted:
        print(f"Failed to extract info from {fname}")
        continue
        
    print("Extracted Data:", json.dumps(extracted, indent=2))
    
    # 3. Insert or link
    c_type = extracted.get('type') or 'Altele'
    owner = extracted.get('owner_name') or 'Necunoscut'
    amount = extracted.get('total_amount') or 0
    curr = extracted.get('currency') or 'LEI'
    s_date = extracted.get('start_date') or datetime.now().strftime('%Y-%m-%d')
    e_date = extracted.get('end_date') or None
    c_num = extracted.get('contract_number') or ''
    c_det = extracted.get('details') or ''
    c_addr = extracted.get('address') or None
    c_m2 = extracted.get('m2') or None
    c_notice = extracted.get('notice_period_months') or None
    
    if len(s_date) != 10: s_date = datetime.now().strftime('%Y-%m-%d')
    if e_date and len(e_date) != 10: e_date = None
    
    # Check if this is an annex to be linked to main_rental_contract_id
    if is_annex and main_rental_contract_id:
        # We don't create a new contract for annex. We just save the file and link it to the main rental contract!
        contract_id = main_rental_contract_id
        print(f"Linking annex to existing contract ID: {contract_id}")
    else:
        contract_id = str(uuid.uuid4())
        q = '''INSERT INTO cp2_contracts (id, type, currency, total_amount, start_date, end_date, contract_number, details, owner_name, address, m2, notice_period_months)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)'''
        pg_qry(q, (contract_id, c_type, curr, amount, s_date, e_date, c_num, c_det, owner, c_addr, c_m2, c_notice))
        
        # Link to Craiova (location_id: 5)
        pg_qry('INSERT INTO cp2_contract_locations (contract_id, location_id, amount) VALUES (%s, %s, %s)', (contract_id, location_id, amount))
        print(f"Created new contract with ID: {contract_id}")
        
        # Save main rental contract ID for annex
        if "Contract de închiriere" in fname:
            main_rental_contract_id = contract_id
            
    # 4. Save file to uploads/contracts
    file_id = str(uuid.uuid4())
    safe_name = f"{file_id}_{secure_filename(fname)}"
    dest_path = os.path.join('uploads', 'contracts', safe_name)
    
    import shutil
    shutil.copy(fpath, dest_path)
    
    pg_qry('''INSERT INTO cp2_contract_files (id, contract_id, is_annex, filename, filepath)
                  VALUES (%s, %s, %s, %s, %s)''',
               (file_id, contract_id, is_annex, fname, dest_path))
    print(f"Attached file {fname} as {safe_name} successfully.")
    
print("\nImport completed successfully!")
