import cp2_db
import re
import psycopg2
from psycopg2.extras import RealDictCursor

def sync_inventory():
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Fetch PDF unit prices if any
    price_map = {}
    vendor_pdf_map = {}
    year_pdf_map = {}
    
    try:
        import fitz
        c.execute("SELECT id, contract_id FROM cp2_contract_files")
        c_files = c.fetchall()
        for cf in c_files:
            c.execute("SELECT file_data FROM cp2_contract_file_data WHERE file_id = %s", (cf['id'],))
            fdata = c.fetchone()
            if fdata and fdata.get('file_data'):
                try:
                    doc = fitz.open(stream=bytes(fdata['file_data']), filetype='pdf')
                    full_text = '\n'.join([page.get_text() for page in doc])
                    pat = re.compile(
                        r'(\d+)\.[\s\n]+([A-Za-z0-9\s]+?)\s+serie\s+([0-9]+)(?:[\s\n]+An[\s\n]+fabricatie[\s\n]+([0-9]{4}))?[\s\n]+([^\n]+)[\s\n]+([0-9]+)[\s\n]+([0-9]+(?:\.[0-9]+)?)[\s\n]+([0-9]+(?:\.[0-9]+)?)',
                        re.IGNORECASE
                    )
                    for m in pat.finditer(full_text):
                        s_nr = m.group(3).strip()
                        v_name = m.group(2).strip()
                        fab_yr = m.group(4)
                        u_pr = float(m.group(7))
                        price_map[s_nr] = u_pr
                        if v_name: vendor_pdf_map[s_nr] = v_name
                        if fab_yr: year_pdf_map[s_nr] = int(fab_yr)
                except Exception as ex:
                    pass
    except Exception as e:
        print("PDF parsing note:", e)

    # 2. Fetch stations from casino_stations
    q_stations = '''
        SELECT DISTINCT ON (s.serial_nr)
            s.serial_nr,
            v.name as vendor_name,
            vm.name as model_name,
            c.name as cabinet_name,
            l.name as location_name,
            s.fabrication_year,
            s.purchase_contract,
            s.invoice,
            s.is_deleted
        FROM casino_stations s
        LEFT JOIN casino_vendors v ON s.vendor_id = v.id
        LEFT JOIN casino_vendor_models vm ON s.vendor_model_id = vm.id
        LEFT JOIN casino_cabinets c ON s.cabinet_id = c.id
        LEFT JOIN casino_locations l ON s.location_id = l.id
        ORDER BY s.serial_nr, s.is_deleted ASC, s.updated_at DESC
    '''
    c.execute(q_stations)
    stations = c.fetchall()
    print(f"Loaded {len(stations)} stations from casino_stations")

    # Insert stations
    for st in stations:
        s_nr = str(st['serial_nr']).strip()
        if not s_nr: continue
        
        status = 'În Sală (Activ)'
        if st['is_deleted']:
            status = 'Casat'
        elif not st['location_name'] or st['location_name'] == 'Depozit':
            status = 'În Stoc'
            
        vendor = st['vendor_name'] or vendor_pdf_map.get(s_nr)
        fab_year = st['fabrication_year'] or year_pdf_map.get(s_nr)
        
        c.execute('''
            INSERT INTO cp2_slot_inventory (
                serial_nr, vendor, model, cabinet, fabrication_year,
                current_location, status, purchase_contract_number, purchase_invoice_number,
                entry_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_DATE)
            ON CONFLICT (serial_nr) DO UPDATE SET
                vendor = COALESCE(EXCLUDED.vendor, cp2_slot_inventory.vendor),
                model = COALESCE(EXCLUDED.model, cp2_slot_inventory.model),
                cabinet = COALESCE(EXCLUDED.cabinet, cp2_slot_inventory.cabinet),
                fabrication_year = COALESCE(EXCLUDED.fabrication_year, cp2_slot_inventory.fabrication_year),
                current_location = COALESCE(EXCLUDED.current_location, cp2_slot_inventory.current_location),
                status = COALESCE(EXCLUDED.status, cp2_slot_inventory.status),
                purchase_contract_number = COALESCE(EXCLUDED.purchase_contract_number, cp2_slot_inventory.purchase_contract_number),
                purchase_invoice_number = COALESCE(EXCLUDED.purchase_invoice_number, cp2_slot_inventory.purchase_invoice_number)
        ''', (
            s_nr, vendor, st['model_name'], st['cabinet_name'], fab_year,
            st['location_name'], status, st['purchase_contract'], st['invoice']
        ))
    
    conn.commit()
    print("Stations inserted/updated.")

    # 3. Fetch contract invoices and associate slots
    c.execute('''
        SELECT ci.id, ci.contract_id, c.contract_number, ci.invoice_number, ci.invoice_date,
               ci.amount, ci.currency, ci.supplier, ci.slots_series, ci.slots_count
        FROM cp2_contract_invoices ci
        LEFT JOIN cp2_contracts c ON ci.contract_id = c.id
    ''')
    invoices = c.fetchall()
    
    for inv in invoices:
        s_raw = inv['slots_series'] or ''
        s_list = [s.strip() for s in re.split(r'[\s,;]+', s_raw) if s.strip()]
        if not s_list: continue
        
        tot_amount = float(inv['amount'] or 0)
        avg_price = round(tot_amount / len(s_list), 2) if len(s_list) > 0 and tot_amount > 0 else 0.0
        
        for s_nr in s_list:
            unit_p = price_map.get(s_nr) or avg_price
            vendor = vendor_pdf_map.get(s_nr) or inv['supplier']
            fab_year = year_pdf_map.get(s_nr)
            
            c.execute('''
                INSERT INTO cp2_slot_inventory (
                    serial_nr, vendor, fabrication_year,
                    purchase_contract_id, purchase_contract_number,
                    purchase_invoice_id, purchase_invoice_number, purchase_invoice_date,
                    purchase_supplier, purchase_price, purchase_currency,
                    status, entry_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'În Stoc', %s)
                ON CONFLICT (serial_nr) DO UPDATE SET
                    purchase_contract_id = COALESCE(EXCLUDED.purchase_contract_id, cp2_slot_inventory.purchase_contract_id),
                    purchase_contract_number = COALESCE(EXCLUDED.purchase_contract_number, cp2_slot_inventory.purchase_contract_number),
                    purchase_invoice_id = COALESCE(EXCLUDED.purchase_invoice_id, cp2_slot_inventory.purchase_invoice_id),
                    purchase_invoice_number = COALESCE(EXCLUDED.purchase_invoice_number, cp2_slot_inventory.purchase_invoice_number),
                    purchase_invoice_date = COALESCE(EXCLUDED.purchase_invoice_date, cp2_slot_inventory.purchase_invoice_date),
                    purchase_supplier = COALESCE(EXCLUDED.purchase_supplier, cp2_slot_inventory.purchase_supplier),
                    purchase_price = COALESCE(EXCLUDED.purchase_price, cp2_slot_inventory.purchase_price),
                    purchase_currency = COALESCE(EXCLUDED.purchase_currency, cp2_slot_inventory.purchase_currency),
                    vendor = COALESCE(cp2_slot_inventory.vendor, EXCLUDED.vendor),
                    fabrication_year = COALESCE(cp2_slot_inventory.fabrication_year, EXCLUDED.fabrication_year),
                    entry_date = COALESCE(EXCLUDED.purchase_invoice_date, cp2_slot_inventory.entry_date)
            ''', (
                s_nr, vendor, fab_year,
                inv['contract_id'], inv['contract_number'],
                inv['id'], inv['invoice_number'], inv['invoice_date'],
                inv['supplier'], unit_p, inv['currency'] or 'RON',
                inv['invoice_date']
            ))
            
    conn.commit()
    
    # 4. Count results
    c.execute("SELECT count(*), status FROM cp2_slot_inventory GROUP BY status")
    counts = c.fetchall()
    print("Inventory sync completed! Counts by status:", counts)
    
    c.execute("SELECT count(*) FROM cp2_slot_inventory WHERE purchase_price > 0")
    print(f"Machines with purchase price > 0: {c.fetchone()['count']}")
    
    conn.close()

if __name__ == '__main__':
    sync_inventory()
