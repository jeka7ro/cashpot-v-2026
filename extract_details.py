import fitz
import subprocess
import psycopg2
import os
import re

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

def get_contract_number(filepath):
    doc = fitz.open(filepath)
    text = ""
    # Only need the first page for the contract number usually
    page = doc.load_page(0)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    img_path = "/tmp/ocr_tmp_nr.png"
    pix.save(img_path)
    res = subprocess.run(["swift", "mac_ocr.swift", img_path], capture_output=True, text=True)
    text = res.stdout
    
    # Try to find something like "Contract nr. 123" or "Nr. 123" or "Nr. Inregistrare"
    m = re.search(r'(?i)(?:contract\s*nr\.?|nr\.\s*inregistrare|nr\.)\s*([A-Z0-9/\-]+(?:\s*din\s*[0-9\.]+)?)', text)
    if m:
        return m.group(1).strip()
    return "Vezi PDF"

updates = {
    "./Craiova/Contract Fort Security - Paza si Interventie.pdf": "Fort Security",
    "./Craiova/Contract SC.ROMTEHNIC SYSTEM SRL. - Mentenanta camere sistem de supraveghere video.pdf": "SC ROMTEHNIC SYSTEM SRL",
    "./Craiova/Contract Iridex Salubrizare.pdf": "Iridex",
    "./Craiova/Contract SC Compania de Apa Oltenia SA.pdf": "Compania de Apa Oltenia SA",
    "./Craiova/Contract COCA-COLA - comodat echipamente frigorifice.pdf": "COCA-COLA",
    "./Craiova/S.C. PRESTING SRL - Stingatoare.pdf": "S.C. PRESTING SRL",
    "./Craiova/UCMR ada.pdf": "UCMR ADA"
}

conn = psycopg2.connect(**PG_DB_CFG)
try:
    with conn.cursor() as c:
        for filepath, owner in updates.items():
            nr = get_contract_number(filepath)
            print(f"{owner} -> {nr}")
            c.execute("UPDATE cp2_contracts SET contract_number = %s WHERE owner_name = %s", (nr, owner))
        conn.commit()
finally:
    conn.close()
