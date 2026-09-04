import os
import json
import psycopg2
from google import genai
from google.genai import types

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("EROARE: GEMINI_API_KEY nu este setată! Rulează 'export GEMINI_API_KEY=\"cheia_ta\"' înainte să execuți scriptul.")
    exit(1)

gemini_client = genai.Client()

prompt = "Te rog să analizezi acest contract scanat și să extragi datele esențiale folosind strict structura JSON cerută. Extrage cu precizie suma totală lunară (total_amount), valuta (currency), suprafața m2 (m2) și numărul contractului (contract_number)."

schema = {
    "type": "OBJECT",
    "properties": {
        "contract_number": {"type": "STRING"},
        "total_amount": {"type": "NUMBER"},
        "currency": {"type": "STRING"},
        "m2": {"type": "NUMBER"}
    }
}

conn = psycopg2.connect(**PG_DB_CFG)
c = conn.cursor()

# Găsim cele 3 contracte pe locația 7 (Ploiesti Nord) cu valoare 0 adăugate astăzi
c.execute("""
    SELECT c.id, c.owner_name, cf.filepath
    FROM cp2_contracts c
    JOIN cp2_contract_locations cl ON c.id = cl.contract_id
    JOIN cp2_contract_files cf ON c.id = cf.contract_id
    WHERE cl.location_id = 7 AND c.total_amount = 0 AND cf.is_annex = false
""")
rows = c.fetchall()

if not rows:
    print("Nu s-au găsit contracte de actualizat cu valoare 0 pe locația 7.")
    exit(0)

print(f"Am găsit {len(rows)} contracte de analizat cu Gemini...")

for contract_id, owner_name, filepath in rows:
    print(f"\\nAnalizăm {owner_name} (Fișier: {filepath})...")
    
    if not os.path.exists(filepath):
        print(f"Fisierul {filepath} nu a fost găsit pe disc!")
        continue

    try:
        gemini_file = gemini_client.files.upload(file=filepath)
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[gemini_file, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        extracted = json.loads(response.text)
        print("Date extrase cu succes:", extracted)
        
        amount = extracted.get('total_amount') or 0
        curr = extracted.get('currency') or 'LEI'
        m2 = extracted.get('m2') or 0
        c_num = extracted.get('contract_number') or ''
        
        c.execute("""
            UPDATE cp2_contracts 
            SET total_amount = %s, currency = %s, m2 = %s, contract_number = %s
            WHERE id = %s
        """, (amount, curr, m2, c_num, contract_id))
        
        c.execute("""
            UPDATE cp2_contract_locations 
            SET amount = %s 
            WHERE contract_id = %s AND location_id = 7
        """, (amount, contract_id))
        
        print("Baza de date a fost actualizată pentru acest contract!")
        
    except Exception as e:
        print(f"Eroare la extragerea datelor pentru {owner_name}: {e}")

conn.commit()
print("\\nToate contractele au fost actualizate!")
