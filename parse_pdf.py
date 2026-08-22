import os
import pypdf
import psycopg2

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
            conn.commit()
    finally:
        conn.close()

files = [
    "./Craiova/Contract Fort Security - Paza si Interventie.pdf",
    "./Craiova/Contract Iridex Salubrizare.pdf",
    "./Craiova/Contract SC Compania de Apa Oltenia SA.pdf",
    "./Craiova/Contract de închiriere.pdf"
]

for f in files:
    try:
        reader = pypdf.PdfReader(f)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        print(f"--- {os.path.basename(f)} ---")
        print(text[:1000])
        print("--------------------------------------------------")
    except Exception as e:
        print(f"Error reading {f}: {e}")
