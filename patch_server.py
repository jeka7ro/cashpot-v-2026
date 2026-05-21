import re

with open('server.py', 'r') as f:
    content = f.read()

pg_code = """
import psycopg2
import unicodedata

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

def get_pg_conn():
    return psycopg2.connect(**PG_DB_CFG)

def pg_qry(sql, params=None):
    conn = get_pg_conn()
    try:
        with conn.cursor() as c:
            c.execute(sql, params or ())
            try:
                rows = c.fetchall()
                cols = [desc[0] for desc in c.description]
                return [dict(zip(cols, r)) for r in rows]
            except Exception as e:
                return []
    finally:
        conn.close()

def normalize_loc_name(name):
    if not name: return ''
    n = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    return n.lower().replace('(', '').replace(')', '').replace(' ', '')
"""

content = re.sub(r"import psycopg2\nPG_DB_CFG.*?(?=\n\ndef qry)", pg_code.strip(), content, flags=re.DOTALL)

kpi_replacement = """    tin  = safe(row.get('total_in'))
    tout = safe(row.get('total_out'))
    ggr  = safe(row.get('ggr'))
    ngr  = safe(row.get('ngr'))
    jp   = safe(row.get('jackpot'))
    hh   = safe(row.get('hh'))
    cb   = safe(row.get('cashback'))
    days = max(int(row.get('nr_zile') or 1), 1)
    ap   = max(int(row.get('aparate') or 1), 1)
    games= safe(row.get('games'))
    bet  = safe(row.get('bet'))

    # Fetch locations for dynamic mapping
    mysql_locs = qry("SELECT id, code FROM locations")
    pg_locs = pg_qry("SELECT id, name FROM casino_locations")
    
    pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
    
    # Map MySQL ID -> PG UUID
    mysql_to_pg_map = {}
    for ml in mysql_locs:
        norm = normalize_loc_name(ml['code'])
        if norm in pg_name_to_id:
            mysql_to_pg_map[str(ml['id'])] = pg_name_to_id[norm]

    pg_loc_ids = []
    ids_raw = request.args.get('loc_ids', '')
    if ids_raw:
        try:
            ids = [x.strip() for x in ids_raw.split(',') if x.strip()]
            for i in ids:
                if i in mysql_to_pg_map:
                    pg_loc_ids.append(mysql_to_pg_map[i])
        except ValueError:
            pass
    else:
        # If no filter, include all matched PG locs to avoid pulling Focsani/Birou expenses
        pg_loc_ids = list(mysql_to_pg_map.values())

    pg_loc_where = ""
    pg_params = [start + ' 00:00:00', end + ' 23:59:59']
    if pg_loc_ids:
        ph = ','.join(['%s']*len(pg_loc_ids))
        pg_loc_where = f" AND location_id IN ({ph})"
        pg_params.extend(pg_loc_ids)
    else:
        pg_loc_where = " AND 1=0" # If filter is empty and no default locations matched

    exp_res = pg_qry(f\"\"\"
        SELECT SUM(amount) as s 
        FROM casino_payments 
        WHERE direction = 1 AND date >= %s AND date <= %s {pg_loc_where}
    \"\"\", pg_params)
    expenses = float(exp_res[0]['s'] or 0) if exp_res else 0.0

    return jsonify(
        data_start=str(row.get('data_start','') or ''),
        data_end  =str(row.get('data_end','') or ''),
        nr_zile=days, aparate=ap, locatii=int(row.get('locatii') or 0),
        total_in=tin, total_out=tout,
        ggr=ggr, ggr_eur=round(ggr/EUR_RATE,2),
        ngr=ngr, ngr_eur=round(ngr/EUR_RATE,2),
        expenses=expenses, net_profit=ggr - expenses,"""

content = re.sub(r"    tin  = safe\(row\.get\('total_in'\)\).*?expenses=expenses, net_profit=ggr - expenses,", kpi_replacement, content, flags=re.DOTALL)

with open('server.py', 'w') as f:
    f.write(content)

