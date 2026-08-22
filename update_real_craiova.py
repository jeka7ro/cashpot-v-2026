import fitz
import subprocess
import psycopg2
import os

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

def ocr_pdf(filepath):
    doc = fitz.open(filepath)
    text = ""
    for i in range(min(2, len(doc))):
        page = doc.load_page(i)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_path = "/tmp/ocr_tmp.png"
        pix.save(img_path)
        res = subprocess.run(["swift", "mac_ocr.swift", img_path], capture_output=True, text=True)
        text += res.stdout + "\n"
    return text

files_to_ocr = [
    "./Craiova/Contract de închiriere.pdf",
    "./Craiova/Contract COCA-COLA - comodat echipamente frigorifice.pdf",
    "./Craiova/Contract Fort Security - Paza si Interventie.pdf",
    "./Craiova/Contract Iridex Salubrizare.pdf",
    "./Craiova/Contract SC Compania de Apa Oltenia SA.pdf",
    "./Craiova/Contract SC.ROMTEHNIC SYSTEM SRL. - Mentenanta camere sistem de supraveghere video.pdf",
    "./Craiova/S.C. PRESTING SRL - Stingatoare.pdf",
    "./Craiova/UCMR ada.pdf"
]

conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        # We already know the rental contract details from previous OCR output!
        c.execute("""
            UPDATE cp2_contracts
            SET total_amount = 6000,
                currency = 'EUR',
                start_date = '2025-01-01',
                end_date = '2034-12-31',
                address = 'Craiova, str Infratirii 2',
                contract_number = '3/17-12-2024'
            WHERE owner_name = 'Contract de închiriere'
        """)
        c.execute("""
            UPDATE cp2_contract_locations
            SET amount = 6000
            WHERE location_id = 5 AND contract_id = (SELECT id FROM cp2_contracts WHERE owner_name = 'Contract de închiriere')
        """)
        
        # Let's run OCR on the others and just print it so we can update them in the next step
        for f in files_to_ocr:
            if "închiriere" in f: continue
            print(f"\n--- OCR for {os.path.basename(f)} ---")
            txt = ocr_pdf(f)
            lines = [line for line in txt.split('\n') if 'lei' in line.lower() or 'eur' in line.lower() or 'adresa' in line.lower() or 'str' in line.lower()]
            print('\n'.join(lines))
        
        conn.commit()
finally:
    conn.close()
