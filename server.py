from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import pymysql, os, requests as req_lib, xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import cp2_db
import sqlite3
import hashlib
import secrets
import json
import csv
import time

_API_CACHE = {}

def get_cache_key(prefix, req):
    return f"{prefix}_{req.full_path}"

def get_cached_response(cache_key, includes_today):
    if cache_key in _API_CACHE:
        entry = _API_CACHE[cache_key]
        now = time.time()
        ttl = 60 if includes_today else 86400  # 1 min for today, 24h for past
        if now - entry['time'] < ttl:
            return entry['data']
    return None

def set_cached_response(cache_key, data):
    _API_CACHE[cache_key] = {
        'time': time.time(),
        'data': data
    }
import urllib.request
from io import StringIO
from werkzeug.utils import secure_filename

cp2_db.init_db()

def require_auth():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token: return None
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT * FROM cp2_users WHERE token=%s", (token,))
    user = c.fetchone()
    conn.close()
    return user

def dict_from_row(row):
    if row is None:
        return None
    return dict(row)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)
CORS(app)

EUR_RATE = 5.0  # RON per EUR

# Locations that are the same physical salon (E.S. = same as parent)
# Format: {child_id: parent_id}
LOC_PARENT = {9: 4, 10: 5, 8: 1, 11: 6, 12: 7}
# parent_id → [parent_id, child_id, ...] for SQL IN clauses
LOC_CHILDREN = {}
for _ch, _pr in LOC_PARENT.items():
    LOC_CHILDREN.setdefault(_pr, [_pr]).append(_ch)
# Canonical display names (clean, no E.S.)
LOC_NAMES = {4: 'Valcea', 5: 'Craiova', 1: 'Pitesti', 6: 'Ploiesti Centru', 7: 'Ploiesti Nord', 3: 'Depozit'}

DB_CFG = dict(
    host="161.97.133.165", port=3306,
    user="eugen", password="(@Ee0wRHVohZww33",
    database="cyberslot_dbn",
    connect_timeout=8, read_timeout=60, write_timeout=60,
    ssl_disabled=True, cursorclass=pymysql.cursors.DictCursor
)

def get_conn():
    return pymysql.connect(**DB_CFG)


import psycopg2
from psycopg2.extras import RealDictCursor
import unicodedata

PG_DB_CFG = dict(
    host="82.76.35.50", port=26257,
    user="cashpot", password="129hj8oahwd7yaw3e21321",
    dbname="cashpot"
)

def get_pg_conn():
    return psycopg2.connect(**PG_DB_CFG)


import json
import os

EXP_CFG_FILE = 'expenses_config.json'

def get_exp_config():
    if os.path.exists(EXP_CFG_FILE):
        try:
            with open(EXP_CFG_FILE, 'r') as f:
                data = json.load(f)
                if 'local_departments' not in data: data['local_departments'] = []
                if 'local_types' not in data: data['local_types'] = []
                return data
        except:
            pass
    return {"excluded_departments": [], "excluded_types": [], "local_departments": [], "local_types": []}

@app.route('/api/admin/expenses_config', methods=['GET'])
def get_expenses_config():
    cfg = get_exp_config()
    excl_types = cfg.get('excluded_types', [])
    rows = pg_qry("""
        SELECT et.id::text as id, et.name as type_name, d.name as dep_name, d.id::text as dep_id
        FROM casino_expenditure_types et
        JOIN casino_departments d ON d.id = et.department_id
        WHERE et.is_deleted = false AND d.is_deleted = false
        ORDER BY d.name, et.name;
    """)
    # Group by department
    deps = {}
    for r in rows:
        did = r['dep_id']
        if did not in deps:
            deps[did] = {'id': did, 'name': r['dep_name'], 'types': [], 'is_local': False}
        deps[did]['types'].append({
            'id': r['id'],
            'name': r['type_name'],
            'is_expense': r['id'] not in excl_types,
            'is_local': False
        })
        
    for ld in cfg.get('local_departments', []):
        did = ld['id']
        if did not in deps:
            deps[did] = {'id': did, 'name': ld['name'], 'types': [], 'is_local': True}
            
    for lt in cfg.get('local_types', []):
        did = lt.get('department_id', '')
        if did in deps:
            deps[did]['types'].append({
                'id': lt['id'],
                'name': lt['name'],
                'is_expense': lt['id'] not in excl_types,
                'is_local': True
            })

    result = []
    for dep in deps.values():
        all_on = all(t['is_expense'] for t in dep['types']) if dep['types'] else True
        dep['is_expense'] = all_on
        result.append(dep)
        
    result.sort(key=lambda x: (x.get('is_local', False), x['name'].lower()))
    for dep in result:
        dep['types'].sort(key=lambda x: (x.get('is_local', False), x['name'].lower()))
        
    return jsonify({'departments': result})

@app.route('/api/admin/expenses_config', methods=['POST'])
def save_expenses_config():
    data = request.json or {}
    cfg = get_exp_config()
    
    if 'excluded_departments' in data:
        cfg['excluded_departments'] = data['excluded_departments']
    if 'excluded_types' in data:
        cfg['excluded_types'] = data['excluded_types']
    if 'local_departments' in data:
        cfg['local_departments'] = data['local_departments']
    if 'local_types' in data:
        cfg['local_types'] = data['local_types']
        
    with open(EXP_CFG_FILE, 'w') as f:
        json.dump(cfg, f)
    return jsonify({"success": True})

def pg_qry(sql, params=None):
    conn = get_pg_conn()
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

def normalize_loc_name(name):
    if not name: return ''
    n = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    return n.lower().replace('(', '').replace(')', '').replace(' ', '')

def qry(sql, params=None):
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute(sql, params or ())
            return c.fetchall()
    finally:
        conn.close()

def qry_one(sql, params=None):
    rows = qry(sql, params)
    return rows[0] if rows else {}

def safe(v, default=0):
    return float(v) if v is not None else default

def period_params(req):
    start = req.args.get('start', '')
    end   = req.args.get('end',   '')
    return start, end

def loc_filter(req, alias='mas'):
    """Returns extra SQL fragment and params for loc_ids filter.
    Automatically expands canonical IDs to include E.S. child locations."""
    ids_raw = req.args.get('loc_ids', '')
    if not ids_raw:
        return '', []
    try:
        ids = [int(x) for x in ids_raw.split(',') if x.strip().isdigit()]
    except:
        return '', []
    # Expand each ID to include its E.S. children
    expanded = set()
    for i in ids:
        expanded.add(i)
        expanded.update(LOC_CHILDREN.get(i, []))
    if not expanded:
        return '', []
    placeholders = ','.join(['%s'] * len(expanded))
    return f' AND {alias}.location_id IN ({placeholders})', list(expanded)

# ─── Filters ────────────────────────────────────────────────────────────────
@app.route('/api/filters')
def filters():
    # Only return canonical (parent) locations — E.S. are merged
    canonical_ids = [lid for lid in [1,3,4,5,6,7] ]  # parent IDs + Depozit
    locs_raw = qry("""
        SELECT DISTINCT l.id, COALESCE(l.display_code, l.code) AS name, l.city, l.address 
        FROM locations l
        JOIN machines m ON m.location_id = l.id
        WHERE l.deleted_at IS NULL AND m.deleted_at IS NULL
          AND m.slot_machine_id IS NOT NULL AND TRIM(m.slot_machine_id) != ''
          AND l.id != 3
        ORDER BY l.city, l.id
    """)
    # Build canonical list: skip child E.S. locations
    seen = set()
    locs = []
    for l in locs_raw:
        canon = LOC_PARENT.get(l['id'], l['id'])
        if canon not in seen:
            seen.add(canon)
            locs.append({'id': canon,
                         'name': LOC_NAMES.get(canon, l['name']),
                         'city': l['city'],
                         'all_ids': LOC_CHILDREN.get(canon, [canon])})
    provs = qry("""
        SELECT DISTINCT mm.id, mm.name 
        FROM machine_manufacturers mm
        JOIN machine_types mt ON mt.manufacturer_id = mm.id
        JOIN machines m ON m.machine_type_id = mt.id
        WHERE m.deleted_at IS NULL AND mm.deleted_at IS NULL
        ORDER BY mm.name
    """)
    cabs  = qry("""
        SELECT DISTINCT mct.id, mct.name 
        FROM machine_cabinet_types mct
        JOIN machines m ON m.cabinet_type_id = mct.id
        WHERE m.deleted_at IS NULL AND mct.deleted_at IS NULL
        ORDER BY mct.name
    """)
    return jsonify(locations=locs, providers=provs, cabinets=cabs)

# ─── KPI ────────────────────────────────────────────────────────────────────
@app.route('/api/kpi')
def kpi():
    start, end = period_params(request)
    
    # Cache Check
    today = datetime.now().strftime('%Y-%m-%d')
    includes_today = (start <= today and end >= today)
    c_key = get_cache_key('kpi', request)
    c_data = get_cached_response(c_key, includes_today)
    if c_data:
        return jsonify(c_data)
        
    lf, lp = loc_filter(request)
    row = qry_one("""
        SELECT
            MIN(date) as data_start, MAX(date) as data_end,
            COUNT(DISTINCT date) as nr_zile,
            COUNT(DISTINCT machine_id) as aparate,
            COUNT(DISTINCT location_id) as locatii,
            SUM(`in`) as total_in,
            SUM(`out`) as total_out,
            SUM(`in`-`out`) as ggr,
            SUM(jackpot) as jackpot,
            SUM(hh) as hh,
            SUM(cashback) as cashback,
            SUM(`in`-`out`-COALESCE(jackpot,0)-COALESCE(hh,0)-COALESCE(cashback,0)) as ngr,
            SUM(games) as games,
            SUM(bet) as bet,
            SUM(COALESCE(jackpot,0)+COALESCE(cashback,0)+COALESCE(hh,0)+COALESCE(cb_birthday,0)+COALESCE(cb_fortune_wheel,0)+COALESCE(cb_raffle,0)) as marketing
        FROM machine_audit_summaries mas
        WHERE mas.date >= %s AND mas.date <= %s
          AND mas.`in` > 0
    """ + lf, [start, end] + lp)

    tin  = safe(row.get('total_in'))
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

    cfg = get_exp_config()
    excl_deps = cfg.get('excluded_departments', [])
    excl_types = cfg.get('excluded_types', [])
    
    pg_excl_where = ""
    if excl_deps:
        ph_d = ','.join([f"'{d}'" for d in excl_deps])
        pg_excl_where += f" AND (department_id IS NULL OR department_id::text NOT IN ({ph_d}))"
    if excl_types:
        ph_t = ','.join([f"'{t}'" for t in excl_types])
        pg_excl_where += f" AND (expenditure_type_id IS NULL OR expenditure_type_id::text NOT IN ({ph_t}))"

    exp_res = pg_qry(f"""
        SELECT SUM(amount) as s 
        FROM casino_payments 
        WHERE direction = 1
          AND (is_deleted = false OR is_deleted IS NULL)
          AND date >= %s AND date <= %s {pg_loc_where} {pg_excl_where}
    """, pg_params)
    var_expenses = float(exp_res[0]['s'] or 0) if exp_res else 0.0

    # Calculate Fixed Expenses
    fixed_expenses = 0.0
    fixed_rows = pg_qry("""
        SELECT f.id, f.expense_date as date, f.location_ids, f.total_ron as amount
        FROM cp2_monthly_fixed_expenses f
        WHERE f.expense_date >= %s AND f.expense_date <= %s
    """, (start, end))
    
    if fixed_rows:
        for r in fixed_rows:
            target_locs = r['location_ids']
            if target_locs and isinstance(target_locs, list):
                target_locs = [str(lid) for lid in target_locs]
            else:
                target_locs = None
                
            d_str = r['date'].strftime('%Y-%m-%d')
            active_m = qry("SELECT location_id, COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date=%s GROUP BY location_id", (d_str,))
            if not active_m:
                active_m = qry("SELECT location_id, COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date = (SELECT MAX(date) FROM machine_daily_meters) GROUP BY location_id")
                
            mysql_counts = {str(m['location_id']): m['c'] for m in active_m}
            pg_slots = {}
            for mid, c in mysql_counts.items():
                if mid in mysql_to_pg_map:
                    pid = mysql_to_pg_map[mid]
                    if target_locs is None or pid in target_locs:
                        pg_slots[pid] = pg_slots.get(pid, 0) + c
                        
            total_slots = sum(pg_slots.values())
            if total_slots > 0:
                for lid, slots in pg_slots.items():
                    if lid in pg_loc_ids:
                        fraction = slots / total_slots
                        fixed_expenses += float(r['amount']) * fraction

    expenses = var_expenses + fixed_expenses

    resp_data = {
        "data_start": str(row.get('data_start','') or ''),
        "data_end": str(row.get('data_end','') or ''),
        "nr_zile": days, "aparate": ap, "locatii": int(row.get('locatii') or 0),
        "total_in": tin, "total_out": tout,
        "ggr": ggr, "ggr_eur": round(ggr/EUR_RATE,2),
        "ngr": ngr, "ngr_eur": round(ngr/EUR_RATE,2),
        "expenses": expenses, "net_profit": ggr - expenses,
        "jackpot": jp, "hh": hh, "cashback": cb,
        "games": games, "bet": bet,
        "hold_pct": round(ggr/tin*100,2) if tin else 0,
        "ngr_pct": round(ngr/tin*100,2) if tin else 0,
        "avg_in_zi": round(tin/days,2),
        "avg_ggr_zi": round(ggr/days,2),
        "avg_ngr_zi": round(ngr/days,2),
        "avg_in_ap_zi": round(tin/(days*ap),2),
        "avg_bet_game": round(bet/games,4) if games else 0,
        "avg_games_zi": round(games/days,2),
        "exp_total": expenses,
        "marketing": safe(row.get('marketing'))
    }
    
    set_cached_response(c_key, resp_data)
    return jsonify(resp_data)

# ─── Trend lunar ────────────────────────────────────────────────────────────
@app.route('/api/trend')
def trend():
    start, end = period_params(request)
    
    # Cache Check
    today = datetime.now().strftime('%Y-%m-%d')
    includes_today = (start <= today and end >= today)
    c_key = get_cache_key('trend', request)
    c_data = get_cached_response(c_key, includes_today)
    if c_data:
        return jsonify(c_data)
        
    lf, lp = loc_filter(request)
    res = request.args.get('resolution', 'day')

    if res == 'hour':
        # Casino shift: 08:00 → next day 08:00
        table = 'machine_audit_summary_per_hours'
        date_format = '%%Y-%%m-%%d %%H:00:00'
        start_dt = start + ' 08:00:00'
        end_dt   = (datetime.strptime(end, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d') + ' 08:00:00'
        where_date = 'mas.date >= %s AND mas.date < %s'
    else:
        table = 'machine_audit_summaries'
        date_format = '%%Y-%%m-%%d'
        start_dt = start
        end_dt   = end
        where_date = 'mas.date >= %s AND mas.date <= %s'

    rows = qry(f"""
        SELECT
            DATE_FORMAT(mas.date,'{date_format}') as luna,
            SUM(`in`) as total_in,
            SUM(`in`-`out`) as ggr,
            SUM(`in`-`out`-COALESCE(jackpot,0)-COALESCE(hh,0)-COALESCE(cashback,0)) as ngr,
            SUM(COALESCE(hh,0)) as hh,
            SUM(COALESCE(jackpot,0)) as jackpot,
            SUM(COALESCE(bet,0)) as bet,
            SUM(games) as games,
            COUNT(DISTINCT machine_id) as aparate,
            COUNT(DISTINCT date) as zile,
            SUM(COALESCE(jackpot,0)+COALESCE(cashback,0)+COALESCE(hh,0)+COALESCE(cb_birthday,0)+COALESCE(cb_fortune_wheel,0)+COALESCE(cb_raffle,0)) as marketing
        FROM {table} mas
        WHERE {where_date}
    """ + lf + f"""
        GROUP BY DATE_FORMAT(mas.date,'{date_format}')
        ORDER BY luna ASC
    """, [start_dt, end_dt] + lp)
    
    set_cached_response(c_key, rows)
    return jsonify(rows)

# ─── Floorplan API ────────────────────────────────────────────────────────────
import werkzeug.utils
import psycopg2.extras

@app.route('/api/floorplan/upload', methods=['POST'])
def floorplan_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        loc_id = request.form.get('location_id')
        if not loc_id:
            return jsonify({'error': 'Missing location_id'}), 400
        
        filename = werkzeug.utils.secure_filename(file.filename)
        filename = f"{loc_id}_{filename}"
        save_dir = os.path.join(os.path.dirname(__file__), 'static', 'floorplans')
        os.makedirs(save_dir, exist_ok=True)
        file.save(os.path.join(save_dir, filename))
        
        bg_url = f"/static/floorplans/{filename}"
        conn = cp2_db.get_db()
        c = conn.cursor()
        c.execute("""
            INSERT INTO cp2_floorplan_settings (location_id, floorplan_bg)
            VALUES (%s, %s)
            ON CONFLICT (location_id) DO UPDATE SET floorplan_bg = EXCLUDED.floorplan_bg
        """, (loc_id, bg_url))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'url': bg_url})

@app.route('/api/floorplan/settings', methods=['GET'])
def floorplan_settings():
    loc_id = request.args.get('location_id')
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    c.execute("SELECT floorplan_bg FROM cp2_floorplan_settings WHERE location_id = %s", (loc_id,))
    row = c.fetchone()
    conn.close()
    return jsonify(row if row else {'floorplan_bg': None})

@app.route('/api/floorplan/machines', methods=['GET', 'POST'])
def floorplan_machines():
    if request.method == 'POST':
        data = request.json
        loc_id = data.get('location_id')
        machines = data.get('machines', [])
        
        conn = cp2_db.get_db()
        c = conn.cursor()
        c.execute("DELETE FROM cp2_floorplan_machines WHERE location_id = %s", (loc_id,))
        for m in machines:
            c.execute("""
                INSERT INTO cp2_floorplan_machines (location_id, machine_id, serial_nr, pos_x, pos_y, angle)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (loc_id, m.get('machine_id'), m.get('serial_nr'), m.get('pos_x'), m.get('pos_y'), m.get('angle', 0)))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    else:
        loc_id = request.args.get('location_id')
        conn = cp2_db.get_db()
        c = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        c.execute("SELECT * FROM cp2_floorplan_machines WHERE location_id = %s", (loc_id,))
        rows = c.fetchall()
        conn.close()
        return jsonify(rows)

@app.route('/api/settings/floorplan', methods=['GET', 'POST'])
def global_floorplan_settings():
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    if request.method == 'POST':
        data = request.json
        c.execute("""
            INSERT INTO cp2_global_settings (key, value)
            VALUES ('floorplan_thresholds', %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """, (json.dumps(data),))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    else:
        c.execute("SELECT value FROM cp2_global_settings WHERE key = 'floorplan_thresholds'")
        row = c.fetchone()
        conn.close()
        return jsonify(row['value'] if row and row['value'] else {})

# ─── Per Locație ─────────────────────────────────────────────────────────────
@app.route('/api/analiza/rtp')
def analiza_rtp():
    start = request.args.get('start', '')
    end   = request.args.get('end', '')
    loc   = request.args.get('location', '')

    where = "mas.date BETWEEN %s AND %s"
    params = [start, end]

    if loc:
        where += " AND mas.location_id = %s"
        params.append(loc)

    # Note: Theoretical RTP isn't easily mapped right now, we use a default of 95.00 for presentation
    # The user can later point us to the exact column (e.g. from game_settings or machine_types)
    sql = f"""
        SELECT 
            m.slot_machine_id AS serial,
            l.display_code AS locatie,
            mt.name AS tip,
            mm.name AS manufacturer,
            SUM(mas.`in`) AS total_in,
            SUM(mas.`out`) AS total_out,
            SUM(mas.`jackpot`) AS jackpot,
            SUM(mas.`hh`) AS happy_hour,
            SUM(mas.`cashback`) AS cashback,
            SUM(mas.`in` - mas.`out`) AS ggr,
            COUNT(DISTINCT mas.date) AS active_days,
            m.created_at AS install_date,
            MAX(CASE WHEN m.active = 1 THEN 1 ELSE 0 END) AS is_active
        FROM machine_audit_summaries mas
        JOIN machines m ON m.id = mas.machine_id
        JOIN locations l ON l.id = mas.location_id
        LEFT JOIN machine_types mt ON mt.id = mas.machine_type_id
        LEFT JOIN machine_manufacturers mm ON mm.id = mt.manufacturer_id
        WHERE {where}
        GROUP BY m.id, m.slot_machine_id, l.display_code, mt.name, mm.name, m.created_at
        HAVING SUM(mas.`in`) > 0
    """
    rows = qry(sql, params)

    res = []
    for r in rows:
        t_in = float(r['total_in'] or 0)
        t_out = float(r['total_out'] or 0)
        jp = float(r['jackpot'] or 0)
        hh = float(r['happy_hour'] or 0)
        cb = float(r['cashback'] or 0)
        
        # Real RTP = (Total OUT + Marketing) / Total IN
        marketing = jp + hh + cb
        real_rtp = ((t_out + marketing) / t_in * 100) if t_in > 0 else 0
        
        # Default theoretical RTP
        theoretical_rtp = 95.00
        
        diff = real_rtp - theoretical_rtp
        
        res.append({
            'serial': r['serial'],
            'locatie': r['locatie'],
            'producator': r['manufacturer'] or 'Necunoscut',
            'tip': r['tip'] or '-',
            'total_in': t_in,
            'total_out': t_out,
            'marketing': marketing,
            'ggr': float(r['ggr'] or 0),
            'real_rtp': round(real_rtp, 2),
            'theoretical_rtp': theoretical_rtp,
            'diff': round(diff, 2),
            'install_date': str(r['install_date']) if r['install_date'] else '-',
            'is_active': bool(r['is_active'])
        })

    # Sort descending by Real RTP to spot anomalies easily
    res.sort(key=lambda x: x['real_rtp'], reverse=True)
    return jsonify(res)

@app.route('/api/analiza/resets')
def analiza_resets():
    sql = """
        SELECT 
            m.slot_machine_id AS serial,
            l.display_code AS locatie,
            mt.name AS tip,
            resets.last_ram_clear,
            SUM(mas.`in`) AS total_in,
            SUM(mas.`out`) AS total_out,
            SUM(mas.`in` - mas.`out`) AS ggr,
            COUNT(DISTINCT mas.date) AS zile_de_la_reset,
            MAX(mas.date) AS max_date,
            MAX(CASE WHEN m.active = 1 THEN 1 ELSE 0 END) AS is_active
        FROM machines m
        JOIN locations l ON l.id = m.location_id
        LEFT JOIN machine_types mt ON mt.id = m.machine_type_id
        LEFT JOIN (
            SELECT m2.slot_machine_id, MAX(mr2.datetime) as last_ram_clear 
            FROM machine_resets mr2
            JOIN machines m2 ON m2.id = mr2.machine_id
            WHERE mr2.reset_type = 0 
            GROUP BY m2.slot_machine_id
        ) resets ON resets.slot_machine_id = m.slot_machine_id
        JOIN machine_audit_summaries mas ON mas.machine_id = m.id AND (resets.last_ram_clear IS NULL OR mas.date >= DATE(resets.last_ram_clear))
        GROUP BY m.slot_machine_id, l.display_code, mt.name, resets.last_ram_clear
        HAVING SUM(mas.`in`) > 0
    """
    rows = qry(sql)
    
    machines = {}
    for r in rows:
        serial = r['serial']
        if serial not in machines:
            machines[serial] = {
                'serial': serial,
                'locatie': r['locatie'],
                'tip': r['tip'] or '-',
                'data_reset': str(r['last_ram_clear']) if r['last_ram_clear'] else '-',
                'total_in': 0,
                'total_out': 0,
                'ggr': 0,
                'zile': 0,
                'max_date': r['max_date'],
                'is_active': bool(r['is_active'])
            }
        
        m = machines[serial]
        m['total_in'] += float(r['total_in'] or 0)
        m['total_out'] += float(r['total_out'] or 0)
        m['ggr'] += float(r['ggr'] or 0)
        m['zile'] += int(r['zile_de_la_reset'] or 0)
        
        if r['max_date'] and m['max_date'] and r['max_date'] > m['max_date']:
            m['locatie'] = r['locatie']
            m['tip'] = r['tip'] or '-'
            m['max_date'] = r['max_date']
            m['is_active'] = bool(r['is_active'])

    res = []
    for m in machines.values():
        t_in = m['total_in']
        t_out = m['total_out']
        m['real_rtp'] = round((t_out / t_in * 100), 2) if t_in > 0 else 0
        del m['max_date']  # Nu mai avem nevoie să trimitem la frontend
        res.append(m)

    res.sort(key=lambda x: x['real_rtp'], reverse=True)
    return jsonify(res)

@app.route('/api/locations')
def locations():
    start, end = period_params(request)
    lf, lp = loc_filter(request)
    # Get distinct card players per location
    card_players = qry("""
        SELECT location_id, COUNT(DISTINCT player_id) as card_players
        FROM player_card_logs
        WHERE created_at >= %s AND created_at <= %s + INTERVAL 1 DAY
        GROUP BY location_id
    """, [start, end])
    cp_map = {r['location_id']: r['card_players'] for r in card_players}

    # Expenses Logic
    pg_locs = pg_qry("SELECT id, name FROM casino_locations")
    pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
    
    mysql_locs = qry("SELECT id, code FROM locations")
    mysql_to_pg_map = {}
    for ml in mysql_locs:
        norm = normalize_loc_name(ml['code'])
        if norm in pg_name_to_id:
            mysql_to_pg_map[str(ml['id'])] = pg_name_to_id[norm]

    cfg = get_exp_config()
    excl_deps = cfg.get('excluded_departments', [])
    excl_types = cfg.get('excluded_types', [])
    
    pg_excl_where = ""
    if excl_deps:
        ph_d = ','.join([f"'{d}'" for d in excl_deps])
        pg_excl_where += f" AND (department_id IS NULL OR department_id::text NOT IN ({ph_d}))"
    if excl_types:
        ph_t = ','.join([f"'{t}'" for t in excl_types])
        pg_excl_where += f" AND (expenditure_type_id IS NULL OR expenditure_type_id::text NOT IN ({ph_t}))"

    # Var expenses
    exp_res = pg_qry(f"""
        SELECT location_id, SUM(amount) as s 
        FROM casino_payments 
        WHERE direction = 1
          AND (is_deleted = false OR is_deleted IS NULL)
          AND date >= %s AND date <= %s {pg_excl_where}
        GROUP BY location_id
    """, [start + ' 00:00:00', end + ' 23:59:59'])
    pg_exp_map = {str(r['location_id']): float(r['s'] or 0) for r in exp_res} if exp_res else {}

    # Fixed expenses
    fixed_rows = pg_qry("""
        SELECT f.id, f.expense_date as date, f.location_ids, f.total_ron as amount
        FROM cp2_monthly_fixed_expenses f
        WHERE f.expense_date >= %s AND f.expense_date <= %s
    """, (start, end))
    
    pg_fixed_exp = {}
    if fixed_rows:
        for r in fixed_rows:
            target_locs = r['location_ids']
            if target_locs and isinstance(target_locs, list):
                target_locs = [str(lid) for lid in target_locs]
            else:
                target_locs = None
                
            d_str = r['date'].strftime('%Y-%m-%d')
            active_m = qry("SELECT location_id, COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date=%s GROUP BY location_id", (d_str,))
            if not active_m:
                active_m = qry("SELECT location_id, COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date = (SELECT MAX(date) FROM machine_daily_meters) GROUP BY location_id")
                
            mysql_counts = {str(m['location_id']): m['c'] for m in active_m}
            pg_slots = {}
            for mid, c in mysql_counts.items():
                if mid in mysql_to_pg_map:
                    pid = mysql_to_pg_map[mid]
                    if target_locs is None or pid in target_locs:
                        pg_slots[pid] = pg_slots.get(pid, 0) + c
                        
            total_slots = sum(pg_slots.values())
            if total_slots > 0:
                for lid, slots in pg_slots.items():
                    fraction = slots / total_slots
                    pg_fixed_exp[lid] = pg_fixed_exp.get(lid, 0) + float(r['amount']) * fraction
                    
    # Map back to mysql locations
    loc_expenses = {}
    loc_pos = {}
    
    # Query POS payments
    pos_res = pg_qry(f"""
        SELECT p.location_id, SUM(p.amount) as s
        FROM casino_payments p
        LEFT JOIN casino_payment_types pt ON p.type_id = pt.id
        LEFT JOIN casino_departments cd ON p.department_id = cd.id
        WHERE p.operational_date >= %s::date AND p.operational_date <= %s::date
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
          AND (pt.name ILIKE '%%pos%%' OR cd.name ILIKE '%%pos%%')
        GROUP BY p.location_id
    """, [start, end])
    pg_pos_map = {str(r['location_id']): float(r['s'] or 0) for r in pos_res} if pos_res else {}

    for ml in mysql_locs:
        mid = str(ml['id'])
        if mid in mysql_to_pg_map:
            pid = mysql_to_pg_map[mid]
            loc_expenses[mid] = pg_exp_map.get(pid, 0) + pg_fixed_exp.get(pid, 0)
            loc_pos[mid] = pg_pos_map.get(pid, 0)

    rows = qry("""
        SELECT
            l.id,
            COALESCE(l.display_code, l.code) AS locatie,
            l.city AS oras,
            COUNT(DISTINCT mas.machine_id) AS buc,
            COUNT(DISTINCT mas.date) AS zile,
            SUM(mas.`in`) AS total_in,
            SUM(mas.`out`) AS total_out,
            SUM(mas.`in`-mas.`out`) AS ggr,
            SUM(mas.jackpot) AS jackpot,
            SUM(mas.hh) AS hh,
            SUM(mas.cashback) AS cashback,
            SUM(mas.cb_fortune_wheel) AS roata,
            SUM(mas.cb_raffle) AS raffles,
            SUM(mas.`in`-mas.`out`-COALESCE(mas.jackpot,0)-COALESCE(mas.hh,0)-COALESCE(mas.cashback,0)) AS ngr,
            SUM(mas.games) AS games,
            SUM(mas.bet) AS bet,
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cashback,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)+COALESCE(mas.cb_fortune_wheel,0)+COALESCE(mas.cb_raffle,0)) AS marketing
        FROM machine_audit_summaries mas
        JOIN locations l ON l.id = mas.location_id
        WHERE mas.date >= %s AND mas.date <= %s
          AND (mas.`in` > 0 OR mas.`out` > 0 OR mas.games > 0)
    """ + lf + """
        GROUP BY l.id, l.display_code, l.code, l.city
        ORDER BY total_in DESC
    """, [start, end] + lp)

    # Merge E.S. child rows into their parent canonical location
    merged = {}  # canon_id → row dict
    for r in rows:
        lid   = r['id'] if 'id' in r else None
        # Determine location id from the row (we need to re-query with l.id)
        # Since we GROUP BY l.id, use the id column
        rid   = r.get('id')
        canon = LOC_PARENT.get(rid, rid) if rid else rid
        name  = LOC_NAMES.get(canon, r.get('locatie','—'))
        if canon not in merged:
            merged[canon] = dict(r)
            merged[canon]['locatie'] = name
            merged[canon]['id']      = canon
        else:
            for k in ('total_in','total_out','ggr','jackpot','hh','cashback','roata','raffles','ngr','games','bet','marketing'):
                merged[canon][k] = (merged[canon].get(k) or 0) + (r.get(k) or 0)
            merged[canon]['buc']  = max(merged[canon].get('buc',0) or 0, r.get('buc',0) or 0)
            merged[canon]['zile'] = max(merged[canon].get('zile',0) or 0, r.get('zile',0) or 0)

    result = []
    for r in merged.values():
        tin  = safe(r['total_in']); ggr=safe(r['ggr']); ngr=safe(r['ngr'])
        days = max(int(r['zile'] or 1),1)
        buc  = max(int(r['buc'] or 1),1)
        bet  = safe(r['bet']); games=safe(r['games']); mkt=safe(r.get('marketing',0))
        cc = cp_map.get(r['id'], 0)
        avg_ggr = 1500
        est_fara = max(0, int((ggr - (cc * avg_ggr)) / avg_ggr)) if ggr > 0 else 0
        
        result.append({**r,
            'clienti_card': cc,
            'clienti_total': cc + est_fara,
            'cheltuieli': loc_expenses.get(str(r['id']), 0),
            'pos': loc_pos.get(str(r['id']), 0),
            'ggr_eur': round(ggr/EUR_RATE,2), 'ngr_eur': round(ngr/EUR_RATE,2),
            'hold_pct': round(ggr/tin*100,2) if tin else 0,
            'ngr_pct':  round(ngr/tin*100,2) if tin else 0,
            'avg_drop': round(tin/days/buc,2),
            'games_day':round(games/days,2),
            'bet_game': round(bet/games,4) if games else 0,
            'marketing': round(mkt,2),
            'bonus_cost_pct': round(mkt/bet*100,2) if bet else 0,
        })
    result.sort(key=lambda x: x.get('ggr',0), reverse=True)
    return jsonify(result)

# ─── Per Provider ────────────────────────────────────────────────────────────
@app.route('/api/providers')
def providers():
    start, end = period_params(request)
    lf, lp = loc_filter(request)
    rows = qry("""
        SELECT
            mm.id AS id,
            COALESCE(NULLIF(mm.name,''), NULLIF(mt.manufacturer,''), 'Necunoscut') AS provider,
            COUNT(DISTINCT mas.machine_id) AS buc,
            COUNT(DISTINCT mas.date) AS zile,
            SUM(mas.`in`) AS total_in,
            SUM(mas.`in`-mas.`out`) AS ggr,
            SUM(mas.jackpot) AS jackpot, SUM(mas.hh) AS hh,
            SUM(mas.cashback) AS cashback, SUM(mas.cb_fortune_wheel) AS roata, SUM(mas.cb_raffle) AS raffles,
            SUM(mas.games) AS games, SUM(mas.bet) AS bet,
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cashback,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)+COALESCE(mas.cb_fortune_wheel,0)+COALESCE(mas.cb_raffle,0)) AS marketing
        FROM machine_audit_summaries mas
        LEFT JOIN machine_types mt ON mt.id = mas.machine_type_id
        LEFT JOIN machine_manufacturers mm ON mm.id = mt.manufacturer_id
        WHERE mas.date >= %s AND mas.date <= %s
          AND mas.`in` > 0
    """ + lf + """
        GROUP BY mm.id, COALESCE(NULLIF(mm.name,''), NULLIF(mt.manufacturer,''), 'Necunoscut')
        ORDER BY ggr DESC
    """, [start, end] + lp)
    result = []
    for r in rows:
        tin=safe(r['total_in']); ggr=safe(r['ggr'])
        days=max(int(r['zile'] or 1),1); buc=max(int(r['buc'] or 1),1)
        bet=safe(r['bet']); games=safe(r['games']); mkt=safe(r.get('marketing',0))
        result.append({**r,
            'ggr_eur':round(ggr/EUR_RATE,2),
            'hold_pct':round(ggr/tin*100,2) if tin else 0,
            'avg_drop':round(tin/days/buc,2),
            'games_day':round(games/days,2),
            'bet_game':round(bet/games,4) if games else 0,
            'marketing':round(mkt,2),
            'bonus_cost_pct':round(mkt/bet*100,2) if bet else 0,
        })
    return jsonify(result)

# ─── Per Tip Slot / Mix ──────────────────────────────────────────────────────
@app.route('/api/types')
def types():
    start, end = period_params(request)
    lf, lp = loc_filter(request)
    rows = qry("""
        SELECT
            mt.id,
            mt.name AS tip_slot,
            COALESCE(mct.name,'—') AS cabinet,
            COALESCE(NULLIF(mm.name,''), NULLIF(mt.manufacturer,''), 'Necunoscut') AS provider,
            COUNT(DISTINCT mas.machine_id) AS buc,
            COUNT(DISTINCT mas.date) AS zile,
            SUM(mas.`in`) AS total_in,
            SUM(mas.`in`-mas.`out`) AS ggr,
            SUM(mas.jackpot) AS jackpot, SUM(mas.hh) AS hh,
            SUM(mas.cashback) AS cashback,
            SUM(mas.games) AS games, SUM(mas.bet) AS bet,
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cashback,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)) AS marketing
        FROM machine_audit_summaries mas
        JOIN machines m ON m.id = mas.machine_id
        LEFT JOIN machine_cabinet_types mct ON mct.id = m.cabinet_type_id
        LEFT JOIN machine_types mt ON mt.id = mas.machine_type_id
        LEFT JOIN machine_manufacturers mm ON mm.id = mt.manufacturer_id
        WHERE mas.date >= %s AND mas.date <= %s
          AND mas.`in` > 0
    """ + lf + """
        GROUP BY mt.id, mt.name, mct.name, mm.name, mt.manufacturer
        ORDER BY ggr DESC
    """, [start, end] + lp)
    result = []
    for r in rows:
        tin=safe(r['total_in']); ggr=safe(r['ggr'])
        days=max(int(r['zile'] or 1),1); buc=max(int(r['buc'] or 1),1)
        bet=safe(r['bet']); games=safe(r['games']); mkt=safe(r.get('marketing',0))
        result.append({**r,
            'ggr_eur':round(ggr/EUR_RATE,2),
            'hold_pct':round(ggr/tin*100,2) if tin else 0,
            'avg_drop':round(tin/days/buc,2),
            'games_day':round(games/days,2),
            'bet_game':round(bet/games,4) if games else 0,
            'marketing':round(mkt,2),
            'bonus_cost_pct':round(mkt/bet*100,2) if bet else 0,
        })
    return jsonify(result)

# ─── Per Cabinet ─────────────────────────────────────────────────────────────
@app.route('/api/cabinets')
def cabinets():
    start, end = period_params(request)
    lf, lp = loc_filter(request)
    rows = qry("""
        SELECT
            COALESCE(mct.name,'Necunoscut') AS cabinet,
            MAX(COALESCE(NULLIF(mm.name,''), NULLIF(mt.manufacturer,''), 'Necunoscut')) as provider,
            COUNT(DISTINCT mas.machine_id) AS buc,
            COUNT(DISTINCT mas.date) AS zile,
            SUM(mas.`in`) AS total_in,
            SUM(mas.`in`-mas.`out`) AS ggr,
            SUM(mas.jackpot) AS jackpot, SUM(mas.hh) AS hh,
            SUM(mas.cashback) AS cashback,
            SUM(mas.games) AS games, SUM(mas.bet) AS bet,
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cashback,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)) AS marketing
        FROM machine_audit_summaries mas
        JOIN machines m ON m.id = mas.machine_id
        LEFT JOIN machine_cabinet_types mct ON mct.id = m.cabinet_type_id
        LEFT JOIN machine_types mt ON mas.machine_type_id = mt.id
        LEFT JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id
        WHERE mas.date >= %s AND mas.date <= %s
          AND mas.`in` > 0
    """ + lf + """
        GROUP BY mct.name
        ORDER BY ggr DESC
        LIMIT 50
    """, [start, end] + lp)
    result = []
    for r in rows:
        tin=safe(r['total_in']); ggr=safe(r['ggr'])
        days=max(int(r['zile'] or 1),1); buc=max(int(r['buc'] or 1),1)
        bet=safe(r['bet']); games=safe(r['games']); mkt=safe(r.get('marketing',0))
        result.append({**r,
            'ggr_eur':round(ggr/EUR_RATE,2),
            'hold_pct':round(ggr/tin*100,2) if tin else 0,
            'avg_drop':round(tin/days/buc,2),
            'games_day':round(games/days,2),
            'bonus_cost_pct':round(mkt/bet*100,2) if bet else 0,
        })
    return jsonify(result)

# ─── Per Aparat Individual ───────────────────────────────────────────────────
@app.route('/api/machines')
def machines():
    start, end = period_params(request)
    loc_id  = request.args.get('location_id','')
    prov_id = request.args.get('provider_id','')
    cab_id  = request.args.get('cabinet_id','')
    filters = ["mas.date >= %s AND mas.date <= %s"]
    params  = [start, end]
    if loc_id and loc_id != 'all':
        try:
            lid = int(loc_id)
            all_ids = LOC_CHILDREN.get(lid, [lid])
            ph = ','.join(['%s'] * len(all_ids))
            filters.append(f"mas.location_id IN ({ph})")
            params.extend(all_ids)
            if request.args.get('fp_mode') == '1':
                filters.append(f"m.location_id IN ({ph})")
                params.extend(all_ids)
        except:
            filters.append("mas.location_id = %s"); params.append(loc_id)
            if request.args.get('fp_mode') == '1':
                filters.append("m.location_id = %s"); params.append(loc_id)
    loc_ids_raw = request.args.get('loc_ids', '')
    if loc_ids_raw and (not loc_id or loc_id == 'all'):
        try:
            ids = [int(x) for x in loc_ids_raw.split(',') if x.strip().isdigit()]
            expanded = set()
            for i in ids:
                expanded.add(i)
                expanded.update(LOC_CHILDREN.get(i, []))
            if expanded:
                ph = ','.join(['%s'] * len(expanded))
                filters.append(f"mas.location_id IN ({ph})")
                params.extend(list(expanded))
                if request.args.get('fp_mode') == '1':
                    filters.append(f"m.location_id IN ({ph})")
                    params.extend(list(expanded))
        except:
            pass
    # Filter by provider via machine_types.manufacturer_id
    if prov_id and prov_id != 'all':
        filters.append("mt.manufacturer_id = %s"); params.append(prov_id)
    if cab_id and cab_id != 'all':
        filters.append("m.cabinet_type_id = %s"); params.append(cab_id)

    where = " AND ".join(filters)

    rows = qry(f"""
        SELECT
            m.slot_machine_id              AS serial_nr,
            m.`order`                      AS position,
            mt.name                        AS mix,
            COALESCE(mct.name,'—')         AS cabinet,
            mas.machine_id                 AS id,
            COALESCE(l.display_code,l.code)AS locatie,
            mt.name                        AS tip_slot,
            COALESCE(NULLIF(mm.name,''), NULLIF(mt.manufacturer,''), 'Necunoscut') AS provider,
            COUNT(DISTINCT mas.date)       AS zile,
            SUM(mas.`in`)                  AS total_in,
            SUM(mas.`in`-mas.`out`)        AS ggr,
            SUM(COALESCE(mas.jackpot,0))   AS jackpot,
            SUM(COALESCE(mas.hh,0))        AS hh,
            SUM(COALESCE(mas.cb_birthday,0)) AS cb_birthday,
            SUM(COALESCE(mas.cashback,0))  AS cashback,
            SUM(COALESCE(mas.cb_fortune_wheel,0)) AS cb_fortune_wheel,
            SUM(COALESCE(mas.cb_raffle,0)) AS cb_raffle,
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cashback,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)+COALESCE(mas.cb_fortune_wheel,0)+COALESCE(mas.cb_raffle,0)) AS marketing,
            SUM(CASE WHEN mas.`out` > 0 OR mas.jackpot > 0 OR mas.hh > 0 THEN 1 ELSE 0 END) AS handpays,
            GROUP_CONCAT(CASE WHEN mas.`out` > 0 THEN CONCAT(mas.date, '|', mas.`out`) ELSE NULL END SEPARATOR ';') AS hp_details,
            SUM(mas.games)                 AS games,
            SUM(mas.bet)                   AS bet
        FROM machine_audit_summaries mas
        JOIN machines m   ON m.id  = mas.machine_id
        LEFT JOIN machine_types mt        ON mt.id  = mas.machine_type_id
        LEFT JOIN machine_manufacturers mm ON mm.id = mt.manufacturer_id
        LEFT JOIN machine_cabinet_types mct ON mct.id = m.cabinet_type_id
        LEFT JOIN locations l             ON l.id   = mas.location_id
        WHERE {where}
        GROUP BY m.id, m.slot_machine_id, mct.name, mt.id, mt.name, mt.manufacturer,
                 l.id, l.display_code, l.code
        ORDER BY ggr DESC
        LIMIT 500
    """, params)

    result = []
    for r in rows:
        tin  = safe(r['total_in']); ggr=safe(r['ggr'])
        days = max(int(r['zile'] or 1),1)
        bet  = safe(r['bet']); games=safe(r['games'])
        mkt  = safe(r['marketing'])
        result.append({**r,
            'ggr_eur':  round(ggr/EUR_RATE,2),
            'hold_pct': round(ggr/tin*100,2) if tin else 0,
            'avg_drop': round(tin/days,2),
            'in_zi':    round(tin/days,2),
            'games_day':round(games/days,2),
            'bet_game': round(bet/games,4) if games else 0,
            'mkt_eur':  round(mkt/EUR_RATE,2),
        })
    return jsonify(result)

# ─── Daily GGR (calendar widget) ────────────────────────────────────────────
@app.route('/api/daily')
def daily():
    start, end = period_params(request)
    lf, lp = loc_filter(request)
    
    res = request.args.get('res', '')
    
    if res == 'hour' or (start == end and res != 'day'):
        rows = qry("""
            SELECT
                DATE_FORMAT(mas.date, '%%H:00') as date,
                mas.location_id,
                REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
                SUM(mas.`in`) as total_in,
                SUM(mas.`in`-mas.`out`) as ggr,
                SUM(COALESCE(mas.jackpot, 0)) as jackpot,
                SUM(COALESCE(mas.hh, 0)) as hh,
                SUM(COALESCE(mas.cashback, 0)) as cashback,
                SUM(mas.bet) as bet,
                COUNT(DISTINCT mas.machine_id) as aparate
            FROM machine_audit_summary_per_hours mas
            LEFT JOIN locations l ON mas.location_id = l.id
            WHERE mas.date >= %s AND mas.date < %s
              AND mas.`in` > 0
        """ + lf + """
            GROUP BY DATE_FORMAT(mas.date, '%%H:00'), mas.location_id, COALESCE(l.display_code, l.code)
        """, [start + " 08:00:00", (datetime.strptime(end, "%Y-%m-%d") + __import__('datetime').timedelta(days=1)).strftime("%Y-%m-%d") + " 08:00:00"] + lp)
        
        hourly_data = {}
        for r in rows:
            hour = r['date']
            if hour not in hourly_data:
                hourly_data[hour] = {
                    'date': hour, 'total_in': 0, 'ggr': 0, 'jackpot': 0, 
                    'hh': 0, 'cashback': 0, 'bet': 0, 'aparate': 0, 'loc_details': []
                }
            hd = hourly_data[hour]
            hd['total_in'] += safe(r['total_in'])
            hd['ggr'] += safe(r['ggr'])
            hd['jackpot'] += safe(r['jackpot'])
            hd['hh'] += safe(r['hh'])
            hd['cashback'] += safe(r['cashback'])
            hd['bet'] += safe(r['bet'])
            hd['aparate'] += r['aparate']
            hd['loc_details'].append({
                'locatie': r['locatie'] or 'Necunoscut',
                'in': safe(r['total_in']),
                'ggr': safe(r['ggr']),
                'hh': safe(r['hh'])
            })
            
        # Pre-fetch all machines for all hours to find top/bottom per hour
        machines_hr = qry("""
            SELECT 
                DATE_FORMAT(mas.date, '%%H:00') as hr,
                m.slot_machine_id as serial_nr,
                COALESCE(NULLIF(mt.name,''), '—') as mix,
                COALESCE(mct.name,'—') as cabinet,
                mas.`in`-mas.`out` as ggr
            FROM machine_audit_summary_per_hours mas
            JOIN machines m ON mas.machine_id = m.id
            LEFT JOIN machine_types mt ON mas.machine_type_id = mt.id
            LEFT JOIN machine_cabinet_types mct ON m.cabinet_type_id = mct.id
            WHERE mas.date >= %s AND mas.date < %s AND mas.`in` > 0
        """ + lf, [start + " 08:00:00", (datetime.strptime(end, "%Y-%m-%d") + __import__('datetime').timedelta(days=1)).strftime("%Y-%m-%d") + " 08:00:00"] + lp)

        # Group machines by hour
        m_by_hr = {}
        for m in machines_hr:
            h = m['hr']
            if h not in m_by_hr: m_by_hr[h] = []
            m_by_hr[h].append(m)

        result = []
        for hd in sorted(hourly_data.values(), key=lambda x: x['date']):
            hd['loc_details'].sort(key=lambda x: x['in'], reverse=True)
            hr = hd['date']
            if hr in m_by_hr and m_by_hr[hr]:
                sorted_m = sorted(m_by_hr[hr], key=lambda x: x['ggr'], reverse=True)
                hd['top_machine'] = sorted_m[0]
                hd['bottom_machine'] = sorted_m[-1]
            result.append(hd)
        return jsonify(result)
    else:
        rows = qry("""
            SELECT
                mas.date,
                mas.location_id,
                REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
                SUM(mas.`in`) as total_in,
                SUM(mas.`in`-mas.`out`) as ggr,
                SUM(COALESCE(mas.jackpot, 0)) as jackpot,
                SUM(COALESCE(mas.hh, 0)) as hh,
                SUM(COALESCE(mas.cashback, 0)) as cashback,
                SUM(COALESCE(mas.cb_fortune_wheel, 0)) as roata,
                SUM(COALESCE(mas.cb_raffle, 0)) as raffles,
                SUM(mas.bet) as bet,
                SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cashback,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)+COALESCE(mas.cb_fortune_wheel,0)+COALESCE(mas.cb_raffle,0)) as marketing,
                COUNT(DISTINCT mas.machine_id) as aparate
            FROM machine_audit_summaries mas
            LEFT JOIN locations l ON mas.location_id = l.id
            WHERE mas.date >= %s AND mas.date <= %s
              AND mas.`in` > 0
        """ + lf + """
            GROUP BY mas.date, mas.location_id, COALESCE(l.display_code, l.code)
            ORDER BY mas.date
        """, [start, end] + lp)

        daily_data = {}
        for r in rows:
            day = str(r['date'])
            loc = LOC_NAMES.get(r.get('location_id'), r.get('locatie') or 'Necunoscut')
            if day not in daily_data:
                daily_data[day] = {
                    'date': day, 'ggr': 0, 'total_in': 0, 'jp': 0,
                    'hh': 0, 'cb': 0, 'roata': 0, 'raffles': 0, 'bet': 0, 'aparate': 0,
                    'marketing': 0,
                    'loc_details': []
                }
            dd = daily_data[day]
            dd['total_in'] += safe(r['total_in'])
            dd['ggr']      += safe(r['ggr'])
            dd['jp']       += safe(r['jackpot'])
            dd['hh']       += safe(r['hh'])
            dd['cb']       += safe(r['cashback'])
            dd['roata']    += safe(r['roata'])
            dd['raffles']  += safe(r['raffles'])
            dd['bet']      += safe(r['bet'])
            dd['marketing'] += safe(r['marketing'])
            dd['aparate']  += int(r['aparate'] or 0)
            dd['loc_details'].append({
                'locatie': loc,
                'in': round(safe(r['total_in']), 2),
                'ggr': round(safe(r['ggr']), 2),
                'hh': round(safe(r['hh']), 2),
                'jp': round(safe(r['jackpot']), 2),
            })

        result = []
        for day_key in sorted(daily_data.keys()):
            dd = daily_data[day_key]
            dd['loc_details'].sort(key=lambda x: x['in'], reverse=True)
            dd['ggr']  = round(dd['ggr'], 2)
            dd['total_in'] = round(dd['total_in'], 2)
            dd['bet']  = round(dd['bet'], 2)
            result.append(dd)
        return jsonify(result)


# ─── Happy Hour History ─────────────────────────────────────────────────────
@app.route('/api/hh_history')
def hh_history():
    start, end = period_params(request)
    lf, lp = loc_filter(request)
    
    rows = qry("""
        SELECT
            mas.date,
            mas.location_id,
            COALESCE(loc.display_code, loc.code) as locatie,
            SUM(mas.hh) as hh_cost,
            SUM(mas.`in`) as total_in,
            SUM(mas.bet) as total_bet,
            SUM(mas.`in` - mas.`out`) as ggr
        FROM machine_audit_summaries mas
        LEFT JOIN locations loc ON loc.id = mas.location_id
        WHERE mas.date >= %s AND mas.date <= %s
          AND mas.hh > 0
    """ + lf + """
        GROUP BY mas.date, mas.location_id
        ORDER BY mas.date DESC, locatie ASC
    """, [start, end] + lp)
    
    result = []
    for r in rows:
        result.append({
            'date': str(r['date']),
            'location_id': r['location_id'],
            'locatie': r['locatie'] or 'Necunoscut',
            'hh_cost': round(safe(r['hh_cost']), 2),
            'total_in': round(safe(r['total_in']), 2),
            'total_bet': round(safe(r['total_bet']), 2),
            'ggr': round(safe(r['ggr']), 2)
        })
    return jsonify(result)


# ─── BNR EUR/RON rate ────────────────────────────────────────────────────────
_bnr_cache = {'rate': 5.0, 'date': ''}
@app.route('/api/eur_rate')
def eur_rate():
    today = str(datetime.now().date())
    if _bnr_cache['date'] != today:
        try:
            r = req_lib.get('https://www.cursbnr.ro/', timeout=5)
            import re
            match = re.search(r'1 EURO = ([\d\.]+) Lei', r.text)
            if match:
                _bnr_cache['rate'] = float(match.group(1))
                _bnr_cache['date'] = today
        except Exception as e:
            print("Failed to fetch BNR rate:", e)
    return jsonify(rate=_bnr_cache['rate'], date=_bnr_cache['date'])

# ─── Serve frontend ──────────────────────────────────────────────────────────
@app.after_request
def add_header(r):
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    return r

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/style.css')
def serve_css():
    return send_from_directory(BASE_DIR, 'style.css')

@app.route('/app.js')
def serve_app_js():
    return send_from_directory(BASE_DIR, 'app.js')

@app.route('/dashboard2.js')
def serve_dashboard2_js():
    return send_from_directory(BASE_DIR, 'dashboard2.js')

@app.route('/onjn.js')
def serve_onjn_js():
    return send_from_directory(BASE_DIR, 'onjn.js')

@app.route('/game_uuids.js')
def serve_game_uuids_js():
    return send_from_directory(BASE_DIR, 'game_uuids.js')

@app.route('/chart.umd.min.js')
def serve_chart():
    return send_from_directory(BASE_DIR, 'chart.umd.min.js')

@app.route('/chartjs-plugin-datalabels.min.js')
def serve_chart_plugin():
    return send_from_directory(BASE_DIR, 'chartjs-plugin-datalabels.min.js')

@app.route('/xlsx.full.min.js')
def serve_xlsx():
    return send_from_directory(BASE_DIR, 'xlsx.full.min.js')

@app.route('/slot_icon.png')
def serve_img():
    return send_from_directory(BASE_DIR, 'slot_icon.png')

@app.route('/logo_cashpot.png')
def serve_logo():
    return send_from_directory(BASE_DIR, 'logo_cashpot.png')

@app.route('/favicon.ico')
def serve_favicon():
    return send_from_directory(BASE_DIR, 'favicon.ico')

@app.route('/favicon.png')
def serve_favicon_png():
    return send_from_directory(BASE_DIR, 'favicon.png')

# ─── Raport pe Ore ────────────────────────────────────────────────────────────
def sync_hourly_incomes():
    try:
        conn = get_pg_conn()
        c = conn.cursor()
        c.execute("SELECT MAX(dt) FROM cp2_hourly_incomes")
        row = c.fetchone()
        max_dt = row[0] if row and row[0] else None
        
        import datetime
        now = datetime.datetime.now()
        # Cutoff is today at 08:00
        cutoff = now.replace(hour=8, minute=0, second=0, microsecond=0)
        if now < cutoff:
            cutoff = cutoff - datetime.timedelta(days=1)
            
        if max_dt is None:
            # Start from 30 days ago to avoid pulling years of hourly data live
            start_sync = cutoff - datetime.timedelta(days=30)
        else:
            start_sync = max_dt + datetime.timedelta(hours=1)
            
        if start_sync >= cutoff:
            conn.close()
            return
            
        mysql_sql = '''
            SELECT 
                mas.date as dt, mas.location_id, mas.machine_id, mas.machine_type_id,
                mas.`in` as total_in, mas.`out` as total_out, mas.games, mas.bet, mas.win,
                mas.jackpot, mas.hh, mas.cb_fortune_wheel, mas.cashback
            FROM machine_audit_summary_per_hours mas
            WHERE mas.date >= %s AND mas.date < %s
        '''
        mysql_data = qry(mysql_sql, [start_sync.strftime('%Y-%m-%d %H:%M:%S'), cutoff.strftime('%Y-%m-%d %H:%M:%S')])
        
        if mysql_data:
            for row in mysql_data:
                try:
                    c.execute('''
                        INSERT INTO cp2_hourly_incomes 
                        (dt, location_id, machine_id, machine_type_id, total_in, total_out, games, bet, win, jackpot, hh, cb_fortune_wheel, cashback)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (dt, location_id, machine_id) DO NOTHING
                    ''', (
                        row['dt'], str(row['location_id']), str(row['machine_id']), str(row['machine_type_id']),
                        row['total_in'] or 0, row['total_out'] or 0, row['games'] or 0, row['bet'] or 0, row['win'] or 0,
                        row['jackpot'] or 0, row['hh'] or 0, row['cb_fortune_wheel'] or 0, row['cashback'] or 0
                    ))
                except:
                    pass
            conn.commit()
        conn.close()
    except Exception as e:
        print("Error in sync_hourly_incomes:", e)

@app.route('/api/reports/hourly')
def reports_hourly():
    sync_hourly_incomes()
    
    start, end = period_params(request)
    lf_mysql, lp_mysql = loc_filter(request, alias='mas')
    
    prov_id = request.args.get('prov_id', '')
    if prov_id:
        lf_mysql += " AND mas.machine_type_id = %s "
        lp_mysql.append(prov_id)
        
    end_dt = end + ' 23:59:59'
    
    import datetime
    now = datetime.datetime.now()
    cutoff = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if now < cutoff:
        cutoff = cutoff - datetime.timedelta(days=1)
    
    cutoff_str = cutoff.strftime('%Y-%m-%d %H:%M:%S')
    
    # PG Filter
    lf_pg = ""
    lp_pg = []
    ids_raw = request.args.get('loc_ids', '')
    if ids_raw:
        try:
            ids = [int(x) for x in ids_raw.split(',') if x.strip().isdigit()]
            expanded = set()
            from server import LOC_CHILDREN
            for i in ids:
                expanded.add(i)
                expanded.update(LOC_CHILDREN.get(i, []))
            if expanded:
                ph = ','.join(['%s'] * len(expanded))
                lf_pg = f" AND mas.location_id::int IN ({ph})"
                lp_pg = list(expanded)
        except:
            pass
            
    if prov_id:
        lf_pg += " AND mas.machine_type_id = %s "
        lp_pg.append(str(prov_id))
    
    # Postgres query for historical data (up to cutoff)
    pg_sql = f"""
        SELECT
            mas.dt as dt,
            mas.location_id,
            mas.machine_id as serial_nr,
            mas.machine_type_id,
            mas.total_in as "in", mas.total_out as "out", mas.total_in - mas.total_out as ggr,
            mas.games, mas.bet, mas.win, mas.jackpot, mas.hh
        FROM cp2_hourly_incomes mas
        WHERE mas.dt >= %s AND mas.dt <= %s AND mas.dt < %s AND mas.total_in > 0
    """ + lf_pg + """
        ORDER BY mas.dt DESC, mas.total_in DESC
    """
    pg_rows = pg_qry(pg_sql, [start, end_dt, cutoff_str] + lp_pg)
    
    # MySQL query for today (after cutoff)
    mysql_sql = f"""
        SELECT
            mas.date as dt,
            mas.location_id,
            mas.machine_id,
            m.slot_machine_id as serial_nr,
            COALESCE(NULLIF(mm.name,''), NULLIF(mt.manufacturer,''), 'Necunoscut') as provider,
            mas.`in`, mas.`out`, mas.`in`-mas.`out` as ggr,
            mas.games, mas.bet, mas.win, mas.jackpot, mas.hh,
            CONCAT(p.first_name, ' ', p.last_name) as player_name
        FROM machine_audit_summary_per_hours mas
        LEFT JOIN locations l ON mas.location_id = l.id
        LEFT JOIN machines m ON mas.machine_id = m.id
        LEFT JOIN machine_types mt ON mas.machine_type_id = mt.id
        LEFT JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id
        LEFT JOIN players p ON m.player_id = p.id
        WHERE mas.date >= %s AND mas.date <= %s AND mas.date >= %s AND mas.`in` > 0
    """ + lf_mysql + """
        ORDER BY mas.date DESC, mas.`in` DESC
    """
    mysql_rows = qry(mysql_sql, [start, end_dt, cutoff_str] + lp_mysql)
    
    # Post-process PG rows (add name/provider/player)
    # We can pre-fetch mappings from MySQL
    machines_map = qry("SELECT m.id as machine_id, m.slot_machine_id, COALESCE(NULLIF(mm.name,''), NULLIF(mt.manufacturer,''), 'Necunoscut') as provider, CONCAT(p.first_name, ' ', p.last_name) as player_name FROM machines m LEFT JOIN machine_types mt ON m.machine_type_id = mt.id LEFT JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id LEFT JOIN players p ON m.player_id = p.id")
    m_dict = {str(r['machine_id']): r for r in machines_map}
    
    combined = []
    for r in mysql_rows:
        if r.get('dt'):
            r['dt'] = str(r['dt'])
        r['locatie'] = LOC_NAMES.get(r.get('location_id'), '—')
        combined.append(r)
        
    for r in pg_rows:
        mid = str(r.get('serial_nr')) # It was stored as machine_id actually
        m_info = m_dict.get(mid, {})
        r['serial_nr'] = m_info.get('slot_machine_id', mid)
        r['provider'] = m_info.get('provider', 'Necunoscut')
        r['player_name'] = m_info.get('player_name', None)
        
        if r.get('dt'):
            r['dt'] = str(r['dt'])
        r['locatie'] = LOC_NAMES.get(r.get('location_id'), '—')
        
        # Format numbers
        for k in ['in', 'out', 'ggr', 'games', 'bet', 'win', 'jackpot', 'hh']:
            if r.get(k) is not None:
                r[k] = float(r[k])
        
        combined.append(r)
        
    # Sort combined
    combined.sort(key=lambda x: (x['dt'], x['in']), reverse=True)
        
    return jsonify(combined)

@app.route('/api/reports/hourly_machine_games')
def hourly_machine_games():
    serial = request.args.get('serial')
    dt = request.args.get('dt') # YYYY-MM-DD HH:MM
    if not serial or not dt: return jsonify([])
    
    dt_start = dt if len(dt) > 16 else dt + ':00'
    from datetime import datetime, timedelta
    try:
        dt_end = (datetime.strptime(dt_start, '%Y-%m-%d %H:%M:%S') + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
    except: return jsonify([])

    rows = qry("""
        SELECT
            mg.id as game_id,
            COALESCE(NULLIF(mg.name, ''), NULLIF(mgs.sas_game_name, ''), 'Necunoscut') as game_name,
            ROUND((MAX(mgs.c_52_bet) - MIN(mgs.c_52_bet))   / 100, 0) as bet,
            ROUND((MAX(mgs.c_52_win) - MIN(mgs.c_52_win))   / 100, 0) as win,
            ROUND((MAX(mgs.c_52_jackpot) - MIN(mgs.c_52_jackpot))/100, 0) as jp,
            (MAX(mgs.c_52_games) - MIN(mgs.c_52_games))                  as games,
            ROUND(((MAX(mgs.c_52_bet) - MIN(mgs.c_52_bet)) - (MAX(mgs.c_52_win) - MIN(mgs.c_52_win))) / 100, 0) as ggr
        FROM machine_audit_games_g_s mgs
        JOIN machines m ON mgs.machine_id = m.id
        LEFT JOIN machine_games mg ON mgs.machine_game_id = mg.id
        WHERE m.slot_machine_id = %s
          AND mgs.created_at >= %s AND mgs.created_at < %s
        GROUP BY mg.id, COALESCE(mg.name, mgs.sas_game_name)
        HAVING bet > 0
        ORDER BY bet DESC
    """, [serial, dt_start, dt_end])
    return jsonify(rows)

# ─── Live Monitor ────────────────────────────────────────────────────────────

@app.route('/api/reports/day_smart')
def day_smart():
    start, end = period_params(request)
    lf, lp = loc_filter(request, alias='pcl')
    
    end_dt = end + " 23:59:59"

    # 1. Card players
    p_count = qry(f"SELECT COUNT(DISTINCT player_id) as c FROM player_card_logs pcl WHERE pcl.created_at >= %s AND pcl.created_at <= %s {lf}", [start, end_dt] + lp)[0]['c']
    
    # Totals from machine_audit_summaries
    lf_mas, lp_mas = loc_filter(request, alias='mas')
    
    # PG Filter
    lf_pg = ""
    lp_pg = []
    ids_raw = request.args.get('loc_ids', '')
    if ids_raw:
        try:
            ids = [int(x) for x in ids_raw.split(',') if x.strip().isdigit()]
            expanded = set()
            from server import LOC_CHILDREN
            for i in ids:
                expanded.add(i)
                expanded.update(LOC_CHILDREN.get(i, []))
            if expanded:
                ph = ','.join(['%s'] * len(expanded))
                lf_pg = f" AND mas.location_id::int IN ({ph})"
                lp_pg = list(expanded)
        except:
            pass
            
    import datetime
    now = datetime.datetime.now()
    cutoff = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if now < cutoff:
        cutoff = cutoff - datetime.timedelta(days=1)
    
    cutoff_str = cutoff.strftime('%Y-%m-%d %H:%M:%S')
    end_dt_str = end + " 23:59:59"
    
    pg_totals = pg_qry(f"""
        SELECT 
            SUM(mas.jackpot) as jp, 
            SUM(mas.cb_fortune_wheel) as wh, 
            SUM(mas.cashback) as cb 
        FROM cp2_hourly_incomes mas 
        WHERE mas.dt >= %s AND mas.dt <= %s AND mas.dt < %s {lf_pg}
    """, [start, end_dt_str, cutoff_str] + lp_pg)[0]
    
    mysql_totals = qry(f"""
        SELECT 
            SUM(mas.jackpot) as jp, 
            SUM(mas.cb_fortune_wheel) as wh, 
            SUM(mas.cashback) as cb 
        FROM machine_audit_summary_per_hours mas 
        WHERE mas.date >= %s AND mas.date <= %s AND mas.date >= %s {lf_mas}
    """, [start, end_dt_str, cutoff_str] + lp_mas)[0]
    
    mas_totals = {
        'jp': (pg_totals['jp'] or 0) + (mysql_totals['jp'] or 0),
        'wh': (pg_totals['wh'] or 0) + (mysql_totals['wh'] or 0),
        'cb': (pg_totals['cb'] or 0) + (mysql_totals['cb'] or 0),
    }
    
    jp_val = mas_totals['jp'] or 0
    wh_val = mas_totals['wh'] or 0
    cb_val = mas_totals['cb'] or 0
    
    # 5. Location Insights (Active vs Churned clients)
    loc_insights = []
    locations_qry = qry("SELECT DISTINCT l.id, REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as name FROM locations l WHERE l.active = 1")
    
    end_dt = end + " 23:59:59"
    for loc in locations_qry:
        l_id = loc['id']
        l_name = loc['name']
        
        today_clients = qry("""
            SELECT p.id, p.first_name, p.last_name, COUNT(pcl.id) as evts
            FROM player_card_logs pcl JOIN players p ON pcl.player_id = p.id
            WHERE pcl.location_id = %s AND pcl.created_at >= %s AND pcl.created_at <= %s AND pcl.log_type = 2
            GROUP BY p.id, p.first_name, p.last_name ORDER BY evts DESC
        """, [l_id, start, end_dt])
        
        past_clients = qry("""
            SELECT p.id, p.first_name, p.last_name, COUNT(pcl.id) as evts
            FROM player_card_logs pcl JOIN players p ON pcl.player_id = p.id
            WHERE pcl.location_id = %s AND pcl.created_at >= DATE_SUB(%s, INTERVAL 30 DAY) AND pcl.created_at < %s AND pcl.log_type = 2
            GROUP BY p.id, p.first_name, p.last_name ORDER BY evts DESC
        """, [l_id, start, start])
        
        if not today_clients and not past_clients: continue
            
        today_ids = {c['id']: c for c in today_clients}
        past_ids = {c['id']: c for c in past_clients}
        
        fidel = [c for c in today_clients if c['id'] in past_ids]
        nou = [c for c in today_clients if c['id'] not in past_ids]
        lipsa = [c for c in past_clients if c['id'] not in today_ids]
        
        def fmt_name(c):
            fn = c['first_name'] or 'C.'
            ln = c['last_name'] or ''
            name = f"{fn} {ln[0]}." if ln else fn
            return {"name": name, "v": c['evts']}

        loc_insights.append({
            'locatie': l_name,
            'fidel': [fmt_name(c) for c in fidel], 'fidel_count': len(fidel),
            'nou': [fmt_name(c) for c in nou], 'nou_count': len(nou),
            'lipsa': [fmt_name(c) for c in lipsa], 'lipsa_count': len(lipsa)
        })
        
    return jsonify({
        "card_players": p_count,
        "jackpots": float(jp_val),
        "wheel": float(wh_val),
        "cashback": float(cb_val),
        "location_insights": loc_insights
    })

@app.route('/api/live')
def live_monitor():
    # Build location filters with correct alias for each query type
    lf_m, lp_m = loc_filter(request, alias='m')   # via machines.location_id

    # 1. Online machines (last 10 min)
    live_rows = qry("""
        SELECT
            REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
            l.id as loc_id,
            COUNT(rta.id) as aparate_online,
            COUNT(CASE WHEN rta.card_reader=1 THEN 1 END) as cu_card,
            ROUND(SUM(rta.current_credits * COALESCE(m.denomination, 0.01)), 2) as credite_totale,
            ROUND(AVG(rta.current_bet   * COALESCE(m.denomination, 0.01)), 4) as bet_mediu,
            MAX(rta.updated_at) as ultima_activitate
        FROM machine_real_time_activities rta
        LEFT JOIN machines m ON rta.machine_id = m.id
        LEFT JOIN locations l ON m.location_id = l.id
        WHERE rta.updated_at >= NOW() - INTERVAL 10 MINUTE
    """ + lf_m + """
        GROUP BY l.id, l.display_code, l.code
        ORDER BY aparate_online DESC
    """, lp_m)

    # 2. Today audit per location
    audit_rows = qry("""
        SELECT
            REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
            l.id as loc_id,
            COUNT(DISTINCT mas.machine_id) as aparate_azi,
            ROUND(SUM(mas.`in`)) as total_in_azi,
            ROUND(SUM(mas.`in`-mas.`out`)) as ggr_azi,
            ROUND(SUM(COALESCE(mas.hh,0))) as hh_azi,
            ROUND(SUM(COALESCE(mas.jackpot,0))) as jp_azi
        FROM machine_audit_summaries mas
        LEFT JOIN machines m ON mas.machine_id = m.id
        LEFT JOIN locations l ON m.location_id = l.id
        WHERE mas.date = CURDATE()
    """ + lf_m + """
        GROUP BY l.id, l.display_code, l.code
        HAVING total_in_azi > 0
        ORDER BY total_in_azi DESC
    """, lp_m)

    # 3. Players today
    player_today = qry("""
        SELECT COUNT(DISTINCT player_id) as total
        FROM player_card_logs
        WHERE DATE(created_at) = CURDATE() AND player_id IS NOT NULL
    """, [])

    # 4. Top machines - rich details
    top_machines = qry("""
        SELECT
            m.slot_machine_id       as serial_nr,
            m.id                    as machine_id,
            REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
            mt.name                 as tip_cabinet,
            mt.manufacturer         as producator,
            NULLIF(mg.name, '')     as joc_activ,
            mg.id                   as game_id,
            rta.game_position       as pozitie,
            rta.current_credits,
            rta.current_bet,
            m.denomination,
            m.multiplication,
            ROUND(rta.current_credits * COALESCE(m.denomination, 0.01), 2) as credite_ron,
            ROUND(rta.current_bet    * COALESCE(m.denomination, 0.01), 4) as bet_ron,
            rta.card_reader,
            m.last_bet_at,
            m.player_id             as player_id_live,
            CONCAT(p.first_name, ' ', p.last_name) as player_name,
            COALESCE(aud.total_in, 0)  as in_azi,
            COALESCE(aud.ggr_azi, 0)   as ggr_azi
        FROM machine_real_time_activities rta
        JOIN machines m ON rta.machine_id = m.id
        JOIN locations l ON m.location_id = l.id
        LEFT JOIN machine_types mt  ON m.machine_type_id = mt.id
        LEFT JOIN machine_games mg  ON rta.machine_game_id = mg.id
        LEFT JOIN players p         ON m.player_id = p.id
        LEFT JOIN (
            SELECT machine_id,
                   ROUND(SUM(`in`),0)          as total_in,
                   ROUND(SUM(`in`-`out`),0)    as ggr_azi
            FROM machine_audit_summaries
            WHERE date = CURDATE()
            GROUP BY machine_id
        ) aud ON aud.machine_id = m.id
        WHERE rta.updated_at >= NOW() - INTERVAL 10 MINUTE
        """ + (" AND ((rta.current_credits * COALESCE(m.denomination, 0.01)) >= 1 OR (rta.current_bet * COALESCE(m.denomination, 0.01)) >= 1)" if request.args.get('active_only') == 'true' else "") + """
    """ + lf_m + """
        ORDER BY credite_ron DESC
        LIMIT 30
    """, lp_m)

    # Calculate Est. IN for top_machines: suma IN de la ultimul HH/Jackpot pana azi
    tm_fixed = []
    from datetime import datetime
    for tm in top_machines:
        machine_id = tm['machine_id']
        hist = qry("""
            SELECT date, `in`, hh, jackpot
            FROM machine_audit_summaries
            WHERE machine_id = %s
              AND date <= CURDATE()
              AND date >= CURDATE() - INTERVAL 14 DAY
            ORDER BY date DESC
        """, (machine_id,))

        est_in = 0
        prev_date = None
        for row in hist:
            row_date = row['date']
            row_in = float(row.get('in') or 0)
            row_hh = float(row.get('hh') or 0)
            row_jp = float(row.get('jackpot') or 0)

            if prev_date is not None:
                try:
                    import datetime as _dt
                    d1 = prev_date if not isinstance(prev_date, str) else _dt.date.fromisoformat(prev_date)
                    d2 = row_date if not isinstance(row_date, str) else _dt.date.fromisoformat(row_date)
                    if (d1 - d2).days > 1: break
                except: break

            est_in += row_in
            prev_date = row_date
            if (row_hh > 0 or row_jp > 0) and row_date < datetime.now().date(): break

        row_dict = dict(tm)
        row_dict['est_in'] = round(est_in, 0)
        tm_fixed.append(row_dict)

    top_machines = tm_fixed

    # Live active players count
    live_active_count = qry("""
        SELECT COUNT(DISTINCT rta.machine_id) as cnt
        FROM machine_real_time_activities rta
        JOIN machines m ON rta.machine_id = m.id
        WHERE rta.updated_at >= NOW() - INTERVAL 10 MINUTE
          AND ((rta.current_credits * COALESCE(m.denomination, 0.01)) >= 1 OR (rta.current_bet * COALESCE(m.denomination, 0.01)) >= 1)
    """ + lf_m, lp_m)
    live_players_count = int(live_active_count[0]['cnt']) if live_active_count else 0
    
    # Latest cashouts with PROPER Est. IN = suma IN de la ultimul handpay/jackpot
    latest_cashouts = qry("""
        SELECT
            m.slot_machine_id       as serial_nr,
            m.id                    as machine_id,
            REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
            mt.name                 as tip_cabinet,
            mt.manufacturer         as producator,
            mas.`out`               as cashout_ron,
            mas.jackpot             as jackpot_ron,
            mas.hh                  as hh_ron,
            mas.`in`                as in_azi,
            mas.updated_at          as cashout_time,
            mas.date                as cashout_date,
            CONCAT(p.first_name, ' ', p.last_name) as player_name,
            mt.name                 as mix,
            mct.name                as cabinet,
            (SELECT mg2.name FROM machine_real_time_activities rta2
             LEFT JOIN machine_games mg2 ON rta2.machine_game_id = mg2.id
             WHERE rta2.machine_id = m.id
             ORDER BY rta2.updated_at DESC LIMIT 1) as joc,
            -- Data ultimului handpay ANTERIOR datei de azi
            (SELECT MAX(mas2.date) FROM machine_audit_summaries mas2
             WHERE mas2.machine_id = mas.machine_id
               AND mas2.date < CURDATE()
               AND (mas2.hh > 0 OR mas2.jackpot > 0)
            ) as last_hh_date
        FROM machine_audit_summaries mas
        JOIN machines m ON mas.machine_id = m.id
        JOIN locations l ON m.location_id = l.id
        LEFT JOIN machine_types mt  ON m.machine_type_id = mt.id
        LEFT JOIN machine_cabinet_types mct ON m.cabinet_type_id = mct.id
        LEFT JOIN players p         ON m.player_id = p.id
        WHERE mas.date = CURDATE() AND (mas.`out` > 0 OR mas.jackpot > 0 OR mas.hh > 0)
    """ + lf_m + """
        ORDER BY mas.updated_at DESC
        LIMIT 20
    """, lp_m)

    # Calculam Est. IN pentru fiecare cashout: suma IN de la ultimul HH pana azi
    co_fixed = []
    for co in latest_cashouts:
        machine_id = co['machine_id']
        # Sumam IN-urile consecutive in spate (fara gap > 1 zi) pana la ultimul HH sau max 14 zile
        hist = qry("""
            SELECT date, `in`, hh, jackpot
            FROM machine_audit_summaries
            WHERE machine_id = %s
              AND date <= CURDATE()
              AND date >= CURDATE() - INTERVAL 14 DAY
            ORDER BY date DESC
        """, (machine_id,))

        est_in = 0
        prev_date = None
        for row in hist:
            row_date = row['date']
            row_in = float(row.get('in') or 0)
            row_hh = float(row.get('hh') or 0)
            row_jp = float(row.get('jackpot') or 0)

            if prev_date is not None:
                try:
                    import datetime as _dt
                    d1 = prev_date if not isinstance(prev_date, str) else _dt.date.fromisoformat(prev_date)
                    d2 = row_date if not isinstance(row_date, str) else _dt.date.fromisoformat(row_date)
                    if (d1 - d2).days > 1: break
                except: break

            est_in += row_in
            prev_date = row_date
            if (row_hh > 0 or row_jp > 0) and row_date < datetime.now().date(): break

        row_dict = dict(co)
        row_dict['est_in'] = round(est_in, 0)
        if row_dict.get('cashout_date'): row_dict['cashout_date'] = str(row_dict['cashout_date'])
        if row_dict.get('cashout_time'): row_dict['cashout_time'] = str(row_dict['cashout_time'])
        co_fixed.append(row_dict)

    # 5. Global live totals - COUNT SLOTURI ACTIVE (credits >= 1)
    totals_live = qry("""
        SELECT
            COUNT(DISTINCT rta.machine_id) as total_aparate_online,
            COUNT(DISTINCT CASE WHEN (rta.current_credits * COALESCE(m.denomination, 0.01)) >= 1 THEN rta.machine_id END) as total_cu_card,
            ROUND(SUM(rta.current_credits * COALESCE(m.denomination, 0.01)), 2) as total_credite,
            ROUND(AVG(rta.current_bet    * COALESCE(m.denomination, 0.01)), 4) as avg_bet
        FROM machine_real_time_activities rta
        LEFT JOIN machines m ON rta.machine_id = m.id
        WHERE rta.updated_at >= NOW() - INTERVAL 10 MINUTE
          AND ((rta.current_credits * COALESCE(m.denomination, 0.01)) >= 1
            OR (rta.current_bet * COALESCE(m.denomination, 0.01)) >= 1)
    """ + lf_m, lp_m)

    # 6. Today totals
    totals_today = qry("""
        SELECT
            COUNT(DISTINCT mas.machine_id) as aparate_azi,
            ROUND(SUM(mas.`in`)) as total_in_azi,
            ROUND(SUM(mas.`in`-mas.`out`)) as ggr_azi,
            ROUND(SUM(COALESCE(mas.hh,0))) as hh_azi
        FROM machine_audit_summaries mas
        LEFT JOIN machines m ON mas.machine_id = m.id
        WHERE mas.date = CURDATE()
    """ + lf_m, lp_m)

    def fix(rows):
        result = []
        for r in rows:
            nr = {}
            for k, v in r.items():
                if hasattr(v, 'strftime'): nr[k] = v.strftime('%Y-%m-%d %H:%M:%S')
                elif hasattr(v, 'isoformat'): nr[k] = v.isoformat()
                elif v is None: nr[k] = None
                else: nr[k] = v
            result.append(nr)
        return result

    tl = fix(totals_live)[0] if totals_live else {}
    active_count = tl.get('total_cu_card', 0)

    return jsonify({
        'ts': datetime.now().strftime('%H:%M:%S'),
        'live_locations': fix(live_rows),
        'audit_today': fix(totals_today),
        'players_today': int(player_today[0]['total']) if player_today else 0,
        'top_machines': fix(top_machines),
        'latest_cashouts': co_fixed,
        'totals_live': tl,
        'active_slots': active_count
    })
@app.route('/api/temp_schema')
def temp_schema():
    return jsonify([r for r in qry("SHOW TABLES")])

@app.route('/api/reports/retention')
def report_retention():
    start, end = period_params(request)
    if not start: return jsonify([])
    
    end_dt = end + ' 23:59:59'
    
    # We query players who received a raffle or jackpot or cashback in this period
    # Since we don't have the exact promo assignment table, we will use player_points_bets
    # to show a list of players and their bets. In a real scenario we'd join with player_jackpots etc.
    # For now, let's fetch top players by bet to simulate the UI, and return 0 for promos if empty.
    
    try:
        rows = qry("""
            SELECT 
                p.id as player_id,
                COALESCE(p.first_name, 'Anonim') as fname,
                COALESCE(p.last_name, '') as lname,
                (SELECT COALESCE(l.display_code, l.code) FROM player_card_logs pcl JOIN locations l ON pcl.location_id = l.id WHERE pcl.player_id = p.id ORDER BY pcl.created_at DESC LIMIT 1) as loc_name,
                (SELECT SUM(total_bet) FROM player_points_bets pb WHERE pb.player_id = p.id AND pb.bet_at >= %s AND pb.bet_at <= %s) as total_recycled,
                (
                    COALESCE((SELECT SUM(amount) FROM player_cashback_in_outs WHERE player_id = p.id AND created_at BETWEEN %s AND %s), 0) +
                    COALESCE((SELECT SUM(amount) FROM player_fortune_wheel_transactions WHERE player_id = p.id AND created_at BETWEEN %s AND %s), 0) +
                    COALESCE((SELECT SUM(amount) FROM player_raffle_transactions WHERE player_id = p.id AND created_at BETWEEN %s AND %s), 0) +
                    COALESCE((SELECT SUM(credits) FROM player_bonus_conversions WHERE player_id = p.id AND created_at BETWEEN %s AND %s), 0) +
                    COALESCE((SELECT SUM(amount) FROM player_transactions WHERE player_id = p.id AND created_at BETWEEN %s AND %s AND (reason LIKE '%%Campanie%%' OR reason LIKE '%%Fortune%%' OR reason LIKE '%%Birthday%%' OR reason = 'JP' OR reason LIKE '%%Tombol%%')), 0) +
                    COALESCE((SELECT SUM(hit_value) FROM player_jackpot_histories WHERE player_id = p.id AND hit_date BETWEEN %s AND %s), 0)
                ) as promo_amount
            FROM players p
            HAVING promo_amount > 0 OR total_recycled > 0
            ORDER BY total_recycled DESC
        """, [start, end_dt] * 7)
        
        # Calculate totals and cast Decimals
        for r in rows:
            r['promo_amount'] = float(r['promo_amount'] or 0)
            r['total_recycled'] = float(r['total_recycled'] or 0)
            
        total_promo = sum(r['promo_amount'] for r in rows)
        total_recycled = sum(r['total_recycled'] for r in rows)
        
        return jsonify({
            'total_promo': total_promo,
            'total_recycled': total_recycled,
            'rate': round((total_recycled / total_promo * 100) if total_promo > 0 else 0, 2),
            'players': rows
        })
    except Exception as e:
        print("RETENTION ERROR:", e)
        return jsonify({'total_promo': 0, 'total_recycled': 0, 'rate': 0, 'players': []})


@app.route('/api/reports/clients')
def report_clients():
    try:
        import datetime as dt_mod
        start, end = period_params(request)
        if not start: start = dt_mod.date.today().strftime('%Y-%m-%d')
        if not end:   end   = start

        try:
            s_dt = dt_mod.datetime.strptime(start, '%Y-%m-%d')
            e_dt = dt_mod.datetime.strptime(end,   '%Y-%m-%d')
        except ValueError:
            try:
                s_dt = dt_mod.datetime.strptime(start, '%d.%m.%Y')
                e_dt = dt_mod.datetime.strptime(end,   '%d.%m.%Y')
                start = s_dt.strftime('%Y-%m-%d')
                end   = e_dt.strftime('%Y-%m-%d')
            except ValueError:
                return jsonify({'error': f'Invalid date: {start}/{end}'}), 400

        start_str = start + ' 08:00:00'
        end_dt_str = (e_dt + dt_mod.timedelta(days=1)).strftime('%Y-%m-%d') + ' 08:00:00'

        loc_where = ''
        loc_params = []
        ids_raw = request.args.get('loc_ids', '')
        if ids_raw:
            try:
                ids = [int(x) for x in ids_raw.split(',') if x.strip()]
                if ids:
                    placeholders = ','.join(['%s'] * len(ids))
                    loc_where = f' AND pcl.location_id IN ({placeholders})'
                    loc_params = ids
            except ValueError:
                pass

        # 1. Player logs from Newton
        q_logs = f"""
            SELECT pcl.id, p.id as player_id, p.first_name, p.last_name, pcl.params, pcl.created_at, pcl.location_id
            FROM player_card_logs pcl
            JOIN players p ON pcl.player_id = p.id
            WHERE pcl.log_type = 2
              AND pcl.created_at >= %s AND pcl.created_at <= %s
              {loc_where}
        """
        logs = qry(q_logs, [start_str, end_dt_str] + loc_params)

        # 2. Extract machine IDs and Dates
        import json
        m_ids = set()
        for log in logs:
            try:
                p_json = json.loads(log['params'])
                mid = p_json.get('machine_id')
                if mid:
                    log['machine_id'] = mid
                    m_ids.add(mid)
            except:
                log['machine_id'] = None

        pg_reports = []
        from collections import defaultdict
        reports_map = defaultdict(lambda: defaultdict(list))

        if m_ids:
            # 2.1 Get slot_machine_ids for these machines
            local_machines = qry(f"SELECT id, slot_machine_id FROM machines WHERE id IN ({','.join(['%s']*len(m_ids))})", list(m_ids))
            slot_to_mid = {r['slot_machine_id']: r['id'] for r in local_machines if r['slot_machine_id']}
            slot_ids = list(set(slot_to_mid.keys()))

            if slot_ids:
                # 3. Fetch PG reports
                pg_q = f"""
                    SELECT station_serial_nr, event_date_time, bet, profit, game_name, cabinet_name
                    FROM casino_processed_simple_report
                    WHERE event_date_time >= %s AND event_date_time <= %s
                      AND station_serial_nr IN ({','.join(['%s']*len(slot_ids))})
                """
                pg_reports = pg_qry(pg_q, [start_str, end_dt_str] + slot_ids)

            # 4. Group PG reports by internal machine ID and date+hour
            for r in pg_reports:
                dt_hour = r['event_date_time'].strftime('%Y-%m-%d %H')
                internal_mid = slot_to_mid.get(r['station_serial_nr'])
                if internal_mid:
                    reports_map[internal_mid][dt_hour].append(r)

        # 5. Build final result
        clients_data = []
        for log in logs:
            if not log.get('machine_id'): continue
            mid = log['machine_id']
            
            # Try to match the exact hour of the log
            dt_hour = log['created_at'].strftime('%Y-%m-%d %H')
            
            reps = reports_map[mid].get(dt_hour, [])
            # If no report for exact hour, fallback to any report from that day for that machine
            if not reps:
                dt_day = log['created_at'].strftime('%Y-%m-%d')
                reps = [r for r_hour, r_list in reports_map[mid].items() if r_hour.startswith(dt_day) for r in r_list]

            bet = sum([r['bet'] for r in reps]) if reps else 0
            ggr = sum([r['profit'] for r in reps]) if reps else 0
            
            games = list(set([r['game_name'] for r in reps if r['game_name']]))
            cabs = list(set([r['cabinet_name'] for r in reps if r['cabinet_name']]))

            clients_data.append({
                'player_id': log['player_id'],
                'first_name': log['first_name'],
                'last_name': log['last_name'],
                'date_time': log['created_at'].strftime('%Y-%m-%d %H:%M:%S'),
                'machine_id': mid,
                'location_id': log['location_id'],
                'bet': float(bet),
                'ggr': float(ggr),
                'games': ', '.join(games) if games else 'N/A',
                'cabinets': ', '.join(cabs) if cabs else 'N/A'
            })

        # Sort by date descending
        clients_data.sort(key=lambda x: x['date_time'], reverse=True)

        return jsonify({'success': True, 'data': clients_data})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/multigame')
def multigame():
    try:
        import datetime as dt_mod
        start, end = period_params(request)
        if not start: start = dt_mod.date.today().strftime('%Y-%m-%d')
        if not end:   end   = start

        try:
            s_dt = dt_mod.datetime.strptime(start, '%Y-%m-%d')
            e_dt = dt_mod.datetime.strptime(end,   '%Y-%m-%d')
        except ValueError:
            try:
                s_dt = dt_mod.datetime.strptime(start, '%d.%m.%Y')
                e_dt = dt_mod.datetime.strptime(end,   '%d.%m.%Y')
                start = s_dt.strftime('%Y-%m-%d')
                end   = e_dt.strftime('%Y-%m-%d')
            except ValueError:
                return jsonify({'error': f'Invalid date: {start}/{end}'}), 400

        # Casino shift: start day 08:00 → (end+1) day 08:00
        start = start + ' 08:00:00'
        end_dt = (e_dt + dt_mod.timedelta(days=1)).strftime('%Y-%m-%d') + ' 08:00:00'

        loc_where = ''
        loc_params = []
        ids_raw = request.args.get('loc_ids', '')
        if ids_raw:
            try:
                ids = [int(x) for x in ids_raw.split(',') if x.strip()]
                if ids:
                    placeholders = ','.join(['%s'] * len(ids))
                    loc_where = f' AND mgs.location_id IN ({placeholders})'
                    loc_params = ids
            except ValueError:
                pass

        # Provider filter: machines → machine_types.manufacturer_id
        ids_raw2 = request.args.get('provider_id', '')
        if ids_raw2:
            try:
                p_ids = [int(x) for x in ids_raw2.split(',') if x.strip()]
                if p_ids:
                    ph = ','.join(['%s'] * len(p_ids))
                    loc_where += f''' AND mgs.machine_id IN (
                        SELECT m2.id FROM machines m2
                        JOIN machine_types mt2 ON m2.machine_type_id = mt2.id
                        WHERE mt2.manufacturer_id IN ({ph})
                    )'''
                    loc_params += p_ids
            except ValueError:
                pass

        # Cabinet filter: machines.machine_type_id
        ids_raw3 = request.args.get('cabinet_id', '')
        if ids_raw3:
            try:
                c_ids = [int(x) for x in ids_raw3.split(',') if x.strip()]
                if c_ids:
                    ph = ','.join(['%s'] * len(c_ids))
                    loc_where += f' AND mgs.machine_id IN (SELECT id FROM machines WHERE machine_type_id IN ({ph}))'
                    loc_params += c_ids
            except ValueError:
                pass
                
        # Mix name filter
        mix_name = request.args.get('mix_name', '')
        if mix_name:
            loc_where += f" AND (mg.name = %s OR mgs.sas_game_name = %s)"
            loc_params.extend([mix_name, mix_name])

        # NOTE: c_52_bet is a cumulative SAS meter (not delta per session)
        # Values are useful for RELATIVE ranking and house_edge % calculation
        # Division by 100 applies the standard 0.01 denomination factor
        rows = qry("""
            SELECT
                MAX(game_id) as game_id,
                game_name,
                COUNT(DISTINCT machine_id) as aparate,
                ROUND(SUM(delta_bet) / 100, 0) as total_bet,
                ROUND(SUM(delta_win) / 100, 0) as total_win,
                ROUND(SUM(delta_jp) / 100, 0) as total_jp,
                SUM(delta_games) as total_games,
                ROUND(SUM(delta_bet - delta_win) / 100, 0) as ggr,
                ROUND(
                    CASE WHEN SUM(delta_bet) > 0
                    THEN (1 - SUM(delta_win)/SUM(delta_bet))*100
                    ELSE NULL END, 2
                ) as house_edge_pct,
                ROUND(
                    CASE WHEN SUM(delta_games) > 0
                    THEN SUM(delta_bet) / SUM(delta_games) / 100
                    ELSE NULL END, 3
                ) as avg_bet_per_game
            FROM (
                SELECT
                    mg.id as game_id,
                    COALESCE(NULLIF(mg.name, ''), NULLIF(mgs.sas_game_name, ''), 'Necunoscut') as game_name,
                    mgs.machine_id,
                    (MAX(mgs.c_52_bet) - MIN(mgs.c_52_bet)) as delta_bet,
                    (MAX(mgs.c_52_win) - MIN(mgs.c_52_win)) as delta_win,
                    (MAX(mgs.c_52_jackpot) - MIN(mgs.c_52_jackpot)) as delta_jp,
                    (MAX(mgs.c_52_games) - MIN(mgs.c_52_games)) as delta_games
                FROM machine_audit_games_g_s mgs
                LEFT JOIN machine_games mg ON mgs.machine_game_id = mg.id
                WHERE mgs.created_at >= %s AND mgs.created_at < %s
            """ + loc_where + """
                GROUP BY mgs.machine_id, mg.id, COALESCE(NULLIF(mg.name, ''), NULLIF(mgs.sas_game_name, ''), 'Necunoscut')
            ) sub
            GROUP BY game_name
            HAVING total_bet > 0
            ORDER BY total_bet DESC
            LIMIT 100
        """, [start, end_dt] + loc_params)

        total_bet_all = sum(float(r['total_bet'] or 0) for r in rows)

        result = []
        for r in rows:
            bet = float(r['total_bet'] or 0)
            ggr = float(r['ggr'] or 0)
            result.append({
                'game_id':    r['game_id'],
                'game':       r['game_name'],
                'aparate':    int(r['aparate'] or 0),
                'bet':        bet,
                'win':        float(r['total_win'] or 0),
                'jp':         float(r['total_jp'] or 0),
                'games':      int(r['total_games'] or 0),
                'ggr':        ggr,
                'house_edge': float(r['house_edge_pct'] or 0),
                'avg_bet':    float(r['avg_bet_per_game'] or 0),
                'bet_pct':    round(bet / total_bet_all * 100, 1) if total_bet_all > 0 else 0,
            })
        return jsonify(result)
    except Exception as ex:
        return jsonify({'error': str(ex)}), 500

@app.route('/api/multigame/details')
def multigame_details():
    try:
        game_name = request.args.get('game_name', '')
        if not game_name: return jsonify({'error': 'Missing game_name'}), 400
        
        start, end = period_params(request)
        if not start: start = datetime.now().strftime('%Y-%m-%d')
        if not end:   end   = start
        
        s_dt = datetime.strptime(start, '%Y-%m-%d')
        e_dt = datetime.strptime(end,   '%Y-%m-%d')
        start_ts = start + ' 08:00:00'
        end_ts = (e_dt + timedelta(days=1)).strftime('%Y-%m-%d') + ' 08:00:00'

        # Find game IDs first to avoid slow JOIN on millions of rows
        game_ids_query = qry("SELECT id FROM machine_games WHERE name = %s OR name = %s", [game_name, game_name + game_name])
        gids = [str(r['id']) for r in game_ids_query]
        gids_sql = f"mgs.machine_game_id IN ({','.join(gids)})" if gids else "1=0"
        
        # 1. Overall stats for this game
        stats = qry(f"""
            SELECT
                MAX(game_id) as game_id,
                COUNT(DISTINCT machine_id) as aparate,
                ROUND(SUM(delta_bet) / 100, 0) as total_bet,
                ROUND(SUM(delta_win) / 100, 0) as total_win,
                SUM(delta_games) as total_games,
                ROUND(SUM(delta_bet - delta_win) / 100, 0) as ggr,
                ROUND(
                    CASE WHEN SUM(delta_bet) > 0
                    THEN (1 - SUM(delta_win)/SUM(delta_bet))*100
                    ELSE NULL END, 2
                ) as house_edge_pct
            FROM (
                SELECT
                    mgs.machine_game_id as game_id,
                    mgs.machine_id,
                    (MAX(mgs.c_52_bet) - MIN(mgs.c_52_bet)) as delta_bet,
                    (MAX(mgs.c_52_win) - MIN(mgs.c_52_win)) as delta_win,
                    (MAX(mgs.c_52_games) - MIN(mgs.c_52_games)) as delta_games
                FROM machine_audit_games_g_s mgs
                WHERE ({gids_sql} OR mgs.sas_game_name = %s)
                  AND mgs.created_at >= %s AND mgs.created_at < %s
                GROUP BY mgs.machine_id, mgs.machine_game_id
            ) sub
        """, [game_name, start_ts, end_ts])
        
        # 2. List of machines having this game
        machines = qry(f"""
            SELECT DISTINCT
                m.id, m.serial_nr, l.name as location_name,
                mt.name as cabinet, mm.name as manufacturer,
                m.mix as active_mix
            FROM machine_audit_games_g_s mgs
            JOIN machines m ON mgs.machine_id = m.id
            JOIN locations l ON m.location_id = l.id
            JOIN machine_types mt ON m.machine_type_id = mt.id
            JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id
            WHERE ({gids_sql} OR mgs.sas_game_name = %s)
              AND mgs.created_at >= %s AND mgs.created_at < %s
            ORDER BY l.name, m.serial_nr
        """, [game_name, start_ts, end_ts])

        return jsonify({
            'game': game_name,
            'stats': stats[0] if stats else {},
            'machines': machines
        })
    except Exception as ex:
        return jsonify({'error': str(ex)}), 500


@app.route('/api/rapoarte/lunare')
def rep_lunare():
    lf, lp = loc_filter(request)
    serials_raw = request.args.get('serials', '')
    serial_filter = ""
    serial_params = []
    
    if serials_raw:
        serials = [s.strip() for s in serials_raw.replace(',', ' ').split() if s.strip()]
        if serials:
            placeholders = ','.join(['%s'] * len(serials))
            serial_filter = f" AND m.slot_machine_id IN ({placeholders})"
            serial_params = serials

    query = f"""
        SELECT 
            m.slot_machine_id as serial_nr,
            COALESCE(l.display_code, l.code) as location_name,
            mt.manufacturer as provider,
            mt.name as cabinet,
            DATE_FORMAT(mas.date, '%%Y-%%m') as month,
            SUM(mas.`in`) as in_val,
            SUM(mas.`out`) as out_val,
            SUM(mas.`in` - mas.`out`) as ggr,
            SUM(mas.win) as win,
            SUM(mas.bet) as bet,
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cashback,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)+COALESCE(mas.cb_fortune_wheel,0)+COALESCE(mas.cb_raffle,0)) AS marketing,
            SUM(mas.`in` - mas.`out` + COALESCE(mas.jackpot,0) + COALESCE(mas.cashback,0) + COALESCE(mas.hh,0) + COALESCE(mas.cb_birthday,0) + COALESCE(mas.cb_fortune_wheel,0) + COALESCE(mas.cb_raffle,0)) as ngr,
            COUNT(DISTINCT DATE(mas.date)) as days_active
        FROM machine_audit_summaries mas
        JOIN locations l ON l.id = mas.location_id
        JOIN machines m ON m.id = mas.machine_id
        JOIN machine_types mt ON m.machine_type_id = mt.id
        WHERE mas.date >= %s AND mas.date <= %s {lf} {serial_filter}
        GROUP BY serial_nr, location_name, provider, cabinet, month
        ORDER BY month DESC, location_name ASC, serial_nr ASC
    """
    start, end = period_params(request)
    rows = qry(query, [start, end] + lp + serial_params)
    return jsonify(rows)

# ─── HH Advanced Analysis (from Prompt) ──────────────────────────────────────
@app.route('/api/hh_advanced')
def hh_advanced():
    start, end = period_params(request)
    lf, lp = loc_filter(request)
    
    # 1. Analiza pe Ore (IN/oră cu HH vs fără HH)
    # Get hourly aggregated data per location
    rows_hourly = qry(f"""
        SELECT 
            location_id,
            DATE(date) as data_zi,
            HOUR(date) as ora,
            SUM(`in`) as total_in,
            SUM(`in`-`out`) as ggr,
            SUM(hh) as hh_cost,
            SUM(games) as games,
            COUNT(DISTINCT machine_id) as active_machines
        FROM machine_audit_summary_per_hours mas
        WHERE date >= %s AND date < %s + INTERVAL 1 DAY
    """ + lf + """
        GROUP BY location_id, DATE(date), HOUR(date)
    """, [start, end] + lp)

    loc_stats = {}
    for r in rows_hourly:
        lid = r['location_id']
        if lid not in loc_stats:
            loc_stats[lid] = {
                'ore_hh': {'count':0, 'in':0, 'ggr':0, 'cost':0},
                'ore_normale': {'count':0, 'in':0, 'ggr':0},
                'aparate_in_hh': {}, # machine_id -> IN
                'aparate_in_total': {} # machine_id -> IN
            }
            
        st = loc_stats[lid]
        is_hh = r['hh_cost'] and float(r['hh_cost']) > 0
        
        if is_hh:
            st['ore_hh']['count'] += 1
            st['ore_hh']['in'] += float(r['total_in'] or 0)
            st['ore_hh']['ggr'] += float(r['ggr'] or 0)
            st['ore_hh']['cost'] += float(r['hh_cost'] or 0)
        else:
            st['ore_normale']['count'] += 1
            st['ore_normale']['in'] += float(r['total_in'] or 0)
            st['ore_normale']['ggr'] += float(r['ggr'] or 0)

    # 1.1 Gasim orele cu HH la nivel de locatie
    rows_hh = qry(f'''
        SELECT DISTINCT location_id, DATE(date) as d, HOUR(date) as h
        FROM machine_audit_summary_per_hours mas
        WHERE date >= %s AND date < %s + INTERVAL 1 DAY AND hh > 0 {lf}
    ''', [start, end] + lp)
    
    hh_hours = set()
    for r in rows_hh:
        hh_hours.add((r['location_id'], str(r['d']), int(r['h'])))

    # 2. Analiza Aparate Dependente (Din baza orara)
    rows_mach_raw = qry(f"""
        SELECT 
            location_id,
            machine_id,
            DATE(date) as d,
            HOUR(date) as h,
            `in`,
            (`in`-`out`) as ggr,
            hh
        FROM machine_audit_summary_per_hours mas
        WHERE date >= %s AND date < %s + INTERVAL 1 DAY
    """ + lf, [start, end] + lp)

    mach_aggs = {}
    for r in rows_mach_raw:
        lid = r['location_id']
        mid = r['machine_id']
        if (lid, mid) not in mach_aggs:
            mach_aggs[(lid, mid)] = {'in_total': 0, 'in_hh': 0, 'ggr_total': 0, 'ggr_hh': 0, 'hh_primit': 0}
        
        m = mach_aggs[(lid, mid)]
        m['in_total'] += float(r['in'] or 0)
        m['ggr_total'] += float(r['ggr'] or 0)
        m['hh_primit'] += float(r['hh'] or 0)
        
        if (lid, str(r['d']), int(r['h'])) in hh_hours:
            m['in_hh'] += float(r['in'] or 0)
            m['ggr_hh'] += float(r['ggr'] or 0)
            
    rows_mach = []
    for (lid, mid), m in mach_aggs.items():
        if m['in_total'] > 1000:
            rows_mach.append({
                'location_id': lid, 'machine_id': mid,
                'in_hh': m['in_hh'], 'in_total': m['in_total'],
                'ggr_hh': m['ggr_hh'], 'ggr_total': m['ggr_total'], 'hh_primit': m['hh_primit']
            })

    for r in rows_mach:
        lid = r['location_id']
        if lid not in loc_stats: continue
        st = loc_stats[lid]
        if 'aparate_dependente' not in st: st['aparate_dependente'] = []
        
        in_hh = float(r['in_hh'] or 0)
        in_total = float(r['in_total'] or 0)
        pct_in_hh = (in_hh / in_total * 100) if in_total > 0 else 0
        
        if pct_in_hh > 20: # Top aparate ca procentaj in HH
            # Luam numele aparatului
            st['aparate_dependente'].append({
                'machine_id': r['machine_id'],
                'pct_in_hh': pct_in_hh,
                'in_total': in_total,
                'in_hh': in_hh,
                'ggr_hh': float(r['ggr_hh'] or 0),
                'ggr_total': float(r['ggr_total'] or 0),
                'hh_primit': float(r['hh_primit'] or 0)
            })

    # 3. Analiza Clienti (Card) in Ore HH vs Ore Normale
    # Cream o lista de ore HH per locatie pentru join logic
    # E mai simplu sa scriem un query direct daca avem orele.
    
    result = {}
    for lid, st in loc_stats.items():
        # Skip locations with no real HH activity (less than 2 HH hours or < 100 RON cost)
        if st['ore_hh']['count'] < 2 or st['ore_hh']['cost'] < 100:
            continue
        
        o_hh = max(1, st['ore_hh']['count'])
        o_no = max(1, st['ore_normale']['count'])
        
        in_med_hh = st['ore_hh']['in'] / o_hh
        in_med_no = st['ore_normale']['in'] / o_no
        
        ggr_med_hh = st['ore_hh']['ggr'] / o_hh
        ggr_med_no = st['ore_normale']['ggr'] / o_no

        # Sortam aparatele dependente descrescator dupa IN
        deps = sorted(st.get('aparate_dependente', []), key=lambda x: x['in_total'], reverse=True)[:5]
        # Ne trebuie un nume scurt pt ele
        deps_names = []
        for d in deps:
            m_info = qry_one("SELECT m.slot_machine_id as mname, mct.name as cname FROM machines m LEFT JOIN machine_cabinet_types mct ON m.cabinet_type_id=mct.id WHERE m.id=%s", [d['machine_id']])
            name = f"{m_info['mname']} ({m_info['cname']})" if m_info else str(d['machine_id'])
            deps_names.append({**d, 'name': name})

        # Alerte si Insights
        alert = "VERDE"
        insight = ""
        
        if in_med_hh > in_med_no * 2:
            alert = "VERDE"
            insight = "HH DUBLEAZĂ RULAJUL: Când e HH activ, sala generează peste dublu IN per oră comparativ cu restul zilei!"
        elif in_med_hh < in_med_no:
            alert = "ROSU"
            insight = "INEFICIENT PENTRU RULAJ: În orele de HH, clienții introduc MAI PUȚIN IN/oră decât în mod normal."
        elif st['ore_hh']['ggr'] < 0:
            alert = "PORTOCALIU"
            insight = "GGR NEGATIV PE HH: Volumul de IN e bun, dar aparatele au plătit masiv. Nu opri campania, dar monitorizează!"
        else:
            alert = "VERDE"
            insight = "CAMPANIE SĂNĂTOASĂ: HH aduce rulaj superior orelor normale și menține un GGR stabil."

        result[lid] = {
            'ore_hh_count': st['ore_hh']['count'],
            'ore_no_count': st['ore_normale']['count'],
            'in_med_hh': in_med_hh,
            'in_med_no': in_med_no,
            'ggr_med_hh': ggr_med_hh,
            'ggr_med_no': ggr_med_no,
            'cost_total': st['ore_hh']['cost'],
            'in_total_hh': st['ore_hh']['in'],
            'in_total_no': st['ore_normale']['in'],
            'ggr_total_hh': st['ore_hh']['ggr'],
            'ggr_total_no': st['ore_normale']['ggr'],
            'alerta': alert,
            'insight': insight,
            'dependente': deps_names
        }

    return jsonify(result)




@app.route('/api/hh_players')
def hh_players():
    start, end = period_params(request)
    lf, lp = loc_filter(request, alias='mas')
    
    # Gasim orele cu HH
    rows_hh = qry(f'''
        SELECT DISTINCT location_id, DATE(date) as d, HOUR(date) as h
        FROM machine_audit_summary_per_hours mas
        WHERE date >= %s AND date < %s + INTERVAL 1 DAY AND hh > 0 {lf}
    ''', [start, end] + lp)
    
    if not rows_hh:
        return jsonify([])
        
    hh_hours = set()
    for r in rows_hh:
        hh_hours.add((r['location_id'], str(r['d']), int(r['h'])))
        
    q = f'''
        SELECT 
            pcl.location_id, pcl.created_at,
            p.id, p.first_name, p.last_name, p.phone,
            COALESCE(l.display_code, l.code) as locatie
        FROM player_card_logs pcl
        JOIN players p ON pcl.player_id = p.id
        LEFT JOIN locations l ON pcl.location_id = l.id
        WHERE pcl.created_at >= %s AND pcl.created_at < %s + INTERVAL 1 DAY
          AND pcl.log_type = 2 {lf.replace('mas.', 'pcl.')}
    '''
    rows_pcl = qry(q, [start, end] + lp)
    
    player_stats = {}
    for r in rows_pcl:
        if not r['created_at']: continue
        d = str(r['created_at'].date())
        h = r['created_at'].hour
        loc = r['location_id']
        pid = r['id']
        
        if pid not in player_stats:
            player_stats[pid] = {
                'id': pid, 'first_name': r['first_name'], 'last_name': r['last_name'], 
                'phone': r['phone'], 'sessions_in_hh': 0, 'sessions_outside_hh': 0, 'last_hh_session': None,
                'locatie': r['locatie']
            }
            
        if (loc, d, h) in hh_hours:
            player_stats[pid]['sessions_in_hh'] += 1
            if not player_stats[pid]['last_hh_session'] or r['created_at'] > player_stats[pid]['last_hh_session']:
                player_stats[pid]['last_hh_session'] = r['created_at']
                player_stats[pid]['locatie'] = r['locatie']
        else:
            player_stats[pid]['sessions_outside_hh'] += 1
                
    result = list(player_stats.values())
    # Returnam doar cei care au macar 1 sesiune in HH
    result = [p for p in result if p['sessions_in_hh'] > 0]
    for p in result:
        p['exclusiv_hh'] = (p['sessions_outside_hh'] == 0)
    result.sort(key=lambda x: x['sessions_in_hh'], reverse=True)
    result = result[:50]
    
    for r in result:
        r['last_hh_session'] = str(r['last_hh_session'])
        
    return jsonify(result)


def sync_player_sessions_incremental():
    try:
        import datetime
        conn = get_pg_conn()
        c = conn.cursor()
        c.execute("SELECT MAX(dt) FROM cp2_player_sessions")
        row = c.fetchone()
        max_dt = row[0] if row and row[0] else None
        
        now = datetime.datetime.now()
        cutoff_date = (now - datetime.timedelta(hours=8)).date()
        
        if max_dt is None:
            start_date = cutoff_date - datetime.timedelta(days=30)
        else:
            start_date = max_dt
            
        if start_date >= cutoff_date:
            conn.close()
            return
            
        mysql_sql = '''
            SELECT 
                DATE(ppb.bet_at - INTERVAL 8 HOUR) as dt,
                ppb.player_id, ppb.machine_id, m.location_id,
                SUM(ppb.total_bet) as total_bet, SUM(ppb.points) as points
            FROM player_points_bets ppb
            LEFT JOIN machines m ON ppb.machine_id = m.id
            WHERE DATE(ppb.bet_at - INTERVAL 8 HOUR) >= %s 
              AND DATE(ppb.bet_at - INTERVAL 8 HOUR) < %s AND ppb.total_bet > 0
            GROUP BY 1, 2, 3, 4
        '''
        mysql_data = qry(mysql_sql, [start_date.strftime('%Y-%m-%d'), cutoff_date.strftime('%Y-%m-%d')])
        
        if mysql_data:
            for row in mysql_data:
                try:
                    c.execute('''
                        INSERT INTO cp2_player_sessions 
                        (dt, player_id, location_id, machine_id, total_bet, points)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (dt, player_id, machine_id) DO UPDATE SET
                            total_bet = cp2_player_sessions.total_bet + EXCLUDED.total_bet,
                            points = cp2_player_sessions.points + EXCLUDED.points
                    ''', (
                        row['dt'], str(row['player_id']), str(row['location_id']), str(row['machine_id']),
                        row['total_bet'] or 0, row['points'] or 0
                    ))
                except:
                    pass
            conn.commit()
        conn.close()
    except Exception as e:
        print("Error sync_player_sessions:", e)

@app.route('/api/players/<int:pid>')
@app.route('/api/players/<int:pid>/details')
def api_player_details(pid):
    sync_player_sessions_incremental()
    
    player = qry_one("SELECT id, first_name, last_name, phone, points/100 as points, total_bets/100 as total_bets, avg_bet/100 as avg_bet FROM players WHERE id = %s", [pid])
    if not player:
        return jsonify({'error': 'Player not found'}), 404

    start = request.args.get('start')
    end   = request.args.get('end')
    
    date_filter = ''
    date_params = [pid]
    if start and end:
        date_filter = ' AND DATE(pcl.created_at) >= %s AND DATE(pcl.created_at) <= %s'
        date_params = [pid, start, end]
        
    sessions = qry(f'''
        SELECT 
            pcl.created_at,
            DATE(pcl.created_at - INTERVAL 8 HOUR) as dt,
            REPLACE(COALESCE(l.display_code, l.code), ' E.S', '') as locatie,
            m.slot_machine_id as serial_nr,
            m.id as machine_id,
            mm.name as producator,
            mt.name as mix,
            mct.name as cabinet,
            (SELECT rg.name FROM machine_real_time_activities rta2
             LEFT JOIN machine_games rg ON rg.id = rta2.machine_game_id
             WHERE rta2.machine_id = m.id ORDER BY rta2.updated_at DESC LIMIT 1) as joc,
            COALESCE((SELECT SUM(mas.`in`)  FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as `in`,
            COALESCE((SELECT SUM(mas.`out`) FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as `out`,
            COALESCE((SELECT SUM(mas.bet)   FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as bet,
            COALESCE((SELECT SUM(mas.`in` - mas.`out`) FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as ggr
        FROM player_card_logs pcl
        JOIN machines m ON m.id = JSON_UNQUOTE(JSON_EXTRACT(pcl.params, '$.machine_id'))
        LEFT JOIN machine_types mt ON m.machine_type_id = mt.id
        LEFT JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id
        LEFT JOIN machine_cabinet_types mct ON m.cabinet_type_id = mct.id
        LEFT JOIN locations l ON pcl.location_id = l.id
        WHERE pcl.player_id = %s AND pcl.log_type = 2
        {date_filter}
        ORDER BY pcl.created_at DESC
        LIMIT 200
    ''', date_params)
    
    # Pre-fetch Postgres historical data
    pg_rows = pg_qry("SELECT dt, machine_id, total_bet, points FROM cp2_player_sessions WHERE player_id = %s", [str(pid)])
    pg_dict = {}
    for r in pg_rows:
        pg_dict[(str(r['dt']), str(r['machine_id']))] = {'total_bet': float(r['total_bet'] or 0), 'points': float(r['points'] or 0)}
        
    # Pre-fetch MySQL live data for today
    import datetime
    now = datetime.datetime.now()
    cutoff_date = (now - datetime.timedelta(hours=8)).date()
    live_rows = qry("SELECT DATE(bet_at - INTERVAL 8 HOUR) as dt, machine_id, SUM(total_bet) as total_bet, SUM(points) as points FROM player_points_bets WHERE player_id = %s AND DATE(bet_at - INTERVAL 8 HOUR) >= %s GROUP BY 1, 2", [pid, cutoff_date.strftime('%Y-%m-%d')])
    live_dict = {}
    for r in live_rows:
        live_dict[(str(r['dt']), str(r['machine_id']))] = {'total_bet': float(r['total_bet'] or 0), 'points': float(r['points'] or 0)}
    
    result_sessions = []
    seen_machine_day = set()
    for s in sessions:
        row = dict(s)
        dt_str = str(s['dt'])
        mid = str(s['machine_id'])
        row['created_at'] = str(s['created_at'])
        
        # Merge data from cache or live
        if dt_str >= cutoff_date.strftime('%Y-%m-%d'):
            metrics = live_dict.get((dt_str, mid), {'total_bet': 0, 'points': 0})
        else:
            metrics = pg_dict.get((dt_str, mid), {'total_bet': 0, 'points': 0})
            
        row['total_bet'] = metrics['total_bet']
        row['points'] = metrics['points']
        
        key = (s['machine_id'], dt_str)
        row['counted'] = key not in seen_machine_day
        seen_machine_day.add(key)
        result_sessions.append(row)

    return jsonify({
        'player': player,
        'sessions': result_sessions
    }), 404

    start = request.args.get('start')
    end   = request.args.get('end')
    
    date_filter = ''
    date_params = [pid]
    if start and end:
        date_filter = ' AND DATE(pcl.created_at) >= %s AND DATE(pcl.created_at) <= %s'
        date_params = [pid, start, end]
        
    # Sessions with daily machine stats — shows machine IN/GGR on days the player was active
    sessions = qry(f'''
        SELECT 
            pcl.created_at,
            REPLACE(COALESCE(l.display_code, l.code), ' E.S', '') as locatie,
            m.slot_machine_id as serial_nr,
            m.id as machine_id,
            mm.name as producator,
            mt.name as mix,
            mct.name as cabinet,
            (SELECT rg.name FROM machine_real_time_activities rta2
             LEFT JOIN machine_games rg ON rg.id = rta2.machine_game_id
             WHERE rta2.machine_id = m.id ORDER BY rta2.updated_at DESC LIMIT 1) as joc,
            COALESCE((SELECT SUM(mas.`in`)  FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as `in`,
            COALESCE((SELECT SUM(mas.`out`) FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as `out`,
            COALESCE((SELECT SUM(mas.bet)   FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as bet,
            COALESCE((SELECT SUM(mas.`in` - mas.`out`) FROM machine_audit_summaries mas WHERE mas.machine_id = m.id AND mas.date = DATE(pcl.created_at)), 0) as ggr
        FROM player_card_logs pcl
        JOIN machines m ON m.id = JSON_UNQUOTE(JSON_EXTRACT(pcl.params, '$.machine_id'))
        LEFT JOIN machine_types mt ON m.machine_type_id = mt.id
        LEFT JOIN machine_manufacturers mm ON mt.manufacturer_id = mm.id
        LEFT JOIN machine_cabinet_types mct ON m.cabinet_type_id = mct.id
        LEFT JOIN locations l ON pcl.location_id = l.id
        WHERE pcl.player_id = %s AND pcl.log_type = 2
        {date_filter}
        ORDER BY pcl.created_at DESC
        LIMIT 200
    ''', date_params)
    
    result_sessions = []
    seen_machine_day = set()  # Deduplicate: count each (machine, day) once for totals
    for s in sessions:
        row = dict(s)
        row['created_at'] = str(s['created_at'])
        row['in']  = float(s.get('in')  or 0)
        row['out'] = float(s.get('out') or 0)
        row['bet'] = float(s.get('bet') or 0)
        row['ggr'] = float(s.get('ggr') or 0)
        # Flag duplicate (machine, day) — frontend uses this to avoid double-counting in totals
        key = (s['machine_id'], str(s['created_at'])[:10])
        row['counted'] = key not in seen_machine_day
        seen_machine_day.add(key)
        result_sessions.append(row)
        

    return jsonify({
        'player': player,
        'sessions': result_sessions
    })

@app.route('/api/players')
def api_players():
    start, end = period_params(request)
    lf, lp = loc_filter(request, alias='pcl')
    
    end_dt = end + ' 23:59:59'
    rows = qry("""
        SELECT
            p.id,
            p.first_name,
            p.last_name,
            p.phone,
            REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
            MAX(pcl.created_at) as ultima_vizita,
            COUNT(DISTINCT DATE(pcl.created_at)) as zile_active,
            COUNT(pcl.id) as total_interactiuni,
            ROUND(COUNT(pcl.id) / NULLIF(COUNT(DISTINCT DATE(pcl.created_at)), 0), 1) as vizite_pe_zi,
            
            -- Calculăm Total IN și Medie IN pe zi activă
            (SELECT SUM(mas.`in`) 
             FROM machine_audit_summaries mas 
             WHERE mas.id IN (
                 SELECT DISTINCT m_a_s.id
                 FROM player_card_logs pcl2
                 JOIN machine_audit_summaries m_a_s ON m_a_s.machine_id = JSON_UNQUOTE(JSON_EXTRACT(pcl2.params, '$.machine_id')) 
                                                   AND m_a_s.date = DATE(pcl2.created_at)
                 WHERE pcl2.player_id = p.id AND pcl2.created_at >= %s AND pcl2.created_at <= %s AND pcl2.log_type = 2
             )
            ) as total_in_perioada,
            
            (SELECT COUNT(DISTINCT DATE(pcl3.created_at))
             FROM player_card_logs pcl3
             WHERE pcl3.player_id = p.id 
               AND pcl3.created_at >= DATE_SUB(%s, INTERVAL DATEDIFF(%s, %s)+1 DAY)
               AND pcl3.created_at < %s
               AND pcl3.log_type = 2
            ) as zile_active_anterior,

            p.points,
            p.total_bets,
            p.avg_bet,
            SUM(CASE WHEN HOUR(pcl.created_at) BETWEEN 6 AND 11 THEN 1 ELSE 0 END) as dimineata,
            SUM(CASE WHEN HOUR(pcl.created_at) BETWEEN 12 AND 17 THEN 1 ELSE 0 END) as pranz,
            SUM(CASE WHEN HOUR(pcl.created_at) BETWEEN 18 AND 23 THEN 1 ELSE 0 END) as seara,
            SUM(CASE WHEN HOUR(pcl.created_at) BETWEEN 0 AND 5 THEN 1 ELSE 0 END) as noaptea
        FROM player_card_logs pcl
        JOIN players p ON pcl.player_id = p.id
        LEFT JOIN locations l ON pcl.location_id = l.id
        WHERE pcl.created_at >= %s AND pcl.created_at <= %s
          AND pcl.log_type = 2
    """ + lf + """
        GROUP BY p.id, p.first_name, p.last_name, p.phone, p.points, p.total_bets, p.avg_bet, l.display_code, l.code
        ORDER BY total_interactiuni DESC
        LIMIT 500
    """, [start, end_dt, start, end, start, start, start, end_dt] + lp)
    
    for r in rows:
        if r.get('ultima_vizita'):
            r['ultima_vizita'] = str(r['ultima_vizita'])
        
        # Calculăm media IN pe zi
        z_act = r.get('zile_active', 1) or 1
        t_in = r.get('total_in_perioada', 0) or 0
        r['media_in_pe_zi'] = round(t_in / z_act, 1)
            
        t_counts = {
            'Dimineața': r.get('dimineata', 0),
            'Prânz': r.get('pranz', 0),
            'Seara': r.get('seara', 0),
            'Noaptea': r.get('noaptea', 0)
        }
        max_time = max(t_counts, key=t_counts.get) if any(t_counts.values()) else 'Necunoscut'
        r['timp_preferat'] = max_time

    return jsonify(rows)





# ─── Cashouts Report ─────────────────────────────────────────────────────────
@app.route('/api/cashouts')
def api_cashouts():
    try:
        import datetime as dt_mod
        start, end = period_params(request)
        if not start: start = dt_mod.date.today().strftime('%Y-%m-%d')
        if not end:   end   = start
        
        try:
            s_dt = dt_mod.datetime.strptime(start, '%Y-%m-%d')
            e_dt = dt_mod.datetime.strptime(end,   '%Y-%m-%d')
        except ValueError:
            try:
                s_dt = dt_mod.datetime.strptime(start, '%d.%m.%Y')
                e_dt = dt_mod.datetime.strptime(end,   '%d.%m.%Y')
                start = s_dt.strftime('%Y-%m-%d')
                end   = e_dt.strftime('%Y-%m-%d')
            except ValueError:
                pass
                
        # loc_filter foloseste request.args, NU user
        lf_m, lp_m = loc_filter(request, 'm')
        
        # Add date filters
        if lf_m:
            lf_m += " AND mas.date >= %s AND mas.date <= %s "
        else:
            lf_m = " AND mas.date >= %s AND mas.date <= %s "
        lp_m.extend([start, end])
        
        rows = qry("""
            SELECT
                mas.id                  as cashout_id,
                mas.date                as c_date,
                mas.updated_at          as c_time,
                m.slot_machine_id       as serial_nr,
                m.id                    as machine_id,
                REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
                mt.manufacturer         as producator,
                mt.name                 as mix,
                mct.name                as cabinet,
                (SELECT mg.name FROM machine_real_time_activities rta
                 LEFT JOIN machine_games mg ON rta.machine_game_id = mg.id
                 WHERE rta.machine_id = m.id
                 ORDER BY rta.updated_at DESC LIMIT 1) as joc,
                mas.`out`               as cashout_ron,
                mas.jackpot             as jackpot_ron,
                mas.hh                  as hh_ron,
                mas.`in`                as in_azi,
                mas.`in` - mas.`out`    as ggr_azi,
                CONCAT(p.first_name, ' ', p.last_name) as player_name,
                -- Est. IN: suma IN din ziua cashout-ului + ultimele zile consecutive fara gap
                (SELECT COALESCE(SUM(mas3.`in`), mas.`in`)
                 FROM machine_audit_summaries mas3
                 WHERE mas3.machine_id = mas.machine_id
                   AND mas3.date >= GREATEST(
                       COALESCE(
                           (SELECT MAX(mas4.date) FROM machine_audit_summaries mas4
                            WHERE mas4.machine_id = mas.machine_id
                              AND mas4.date < mas.date
                              AND (mas4.hh > 0 OR mas4.jackpot > 0)),
                           mas.date - INTERVAL 14 DAY
                       ),
                       mas.date - INTERVAL 14 DAY
                   )
                   AND mas3.date <= mas.date
                ) as est_in
            FROM machine_audit_summaries mas
            JOIN machines m ON mas.machine_id = m.id
            JOIN locations l ON m.location_id = l.id
            LEFT JOIN machine_types mt  ON m.machine_type_id = mt.id
            LEFT JOIN machine_cabinet_types mct ON m.cabinet_type_id = mct.id
            LEFT JOIN players p         ON m.player_id = p.id
            WHERE (mas.`out` > 0 OR mas.jackpot > 0 OR mas.hh > 0)
        """ + lf_m + """
            ORDER BY mas.date DESC, mas.`out` DESC, mas.jackpot DESC, mas.hh DESC
        """, lp_m)
        
        result = []
        for r in rows:
            row = dict(r)
            if row.get('c_date'): row['c_date'] = str(row['c_date'])
            if row.get('c_time'): row['c_time'] = str(row['c_time'])
            result.append(row)
            
        return jsonify(result)
    except Exception as e:
        print(f"Error in /api/cashouts: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ─── Auth API ───────────────────────────────────────────────────────────────
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email')
    pwd = data.get('password', '')
    pwd_hash = hashlib.sha256(pwd.encode()).hexdigest()
    
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT * FROM cp2_users WHERE email=%s AND password_hash=%s", (email, pwd_hash))
    user = c.fetchone()
    if user:
        token = hashlib.sha256((email + "CASHPOT_STATIC_SEC_2026").encode()).hexdigest()
        c.execute("UPDATE cp2_users SET token=%s WHERE id=%s", (token, user['id']))
        conn.commit()
        u = dict_from_row(user)
        u['token'] = token
        del u['password_hash']
        conn.close()
        return jsonify(u)
    conn.close()
    return jsonify({"error": "Credențiale invalide"}), 401

@app.route('/api/me', methods=['GET'])
def me():
    user = require_auth()
    if not user: return jsonify({"error": "Unauthorized"}), 401
    u = dict_from_row(user)
    del u['password_hash']
    return jsonify(u)

@app.route('/api/logout', methods=['POST'])
def logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token:
        conn = cp2_db.get_db()
        c = conn.cursor(cursor_factory=RealDictCursor)
        c.execute("UPDATE cp2_users SET token=NULL WHERE token=%s", (token,))
        conn.commit()
        conn.close()
    return jsonify({"success": True})

@app.route('/api/me/theme', methods=['POST'])
def update_my_theme():
    user = require_auth()
    if not user: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    new_theme = data.get('theme')
    if new_theme not in ['light', 'dark']: return jsonify({'error': 'Invalid theme'}), 400
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute('SELECT permissions FROM cp2_users WHERE id = %s', (user['id'],))
    row = c.fetchone()
    if row:
        import json
        try: perms = json.loads(row['permissions'] or '{}')
        except: perms = {}
        perms['theme'] = new_theme
        c.execute('UPDATE cp2_users SET permissions = %s WHERE id = %s', (json.dumps(perms), user['id']))
        conn.commit()
    conn.close()
    return jsonify({'success': True})

# ─── Users CRUD ─────────────────────────────────────────────────────────────
@app.route('/api/users', methods=['GET'])
def get_users():
    user = require_auth()
    if not user or user['role'] != 'Super Admin': return jsonify({"error": "Unauthorized"}), 401
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT id, name, email, role, phone, permissions FROM cp2_users")
    users = [dict_from_row(r) for r in c.fetchall()]
    conn.close()
    return jsonify(users)

@app.route('/api/users', methods=['POST'])
def create_user():
    user = require_auth()
    if not user or user['role'] != 'Super Admin': return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    pwd_hash = hashlib.sha256(data['password'].encode()).hexdigest()
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    try:
        c.execute("INSERT INTO cp2_users (name, email, password_hash, role, phone, permissions) VALUES (%s, %s, %s, %s, %s, %s)",
                  (data.get('name'), data.get('email'), pwd_hash, data.get('role', 'Operational'),
                   data.get('phone', ''), json.dumps(data.get('permissions', {}))))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()


@app.route('/api/users/<int:uid>', methods=['PUT', 'DELETE'])
def user_uid_ops(uid):
    user = require_auth()
    if not user: return jsonify({"error": "Unauthorized"}), 401
    
    if request.method == 'PUT':
        if user['role'] != 'Super Admin' and user['id'] != uid:
            return jsonify({"error": "Unauthorized"}), 401
            
        data = request.json
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        role = data.get('role')
        permissions = data.get('permissions')
        new_password = data.get('new_password')
        
        try:
            conn = cp2_db.get_db()
            c = conn.cursor(cursor_factory=RealDictCursor)
            
            if new_password:
                pwd_hash = hashlib.sha256(new_password.encode()).hexdigest()
                c.execute("UPDATE cp2_users SET name=%s, email=%s, phone=%s, permissions=%s, role=%s, password_hash=%s WHERE id=%s", 
                          (name, email, phone, permissions, role, pwd_hash, uid))
            else:
                c.execute("UPDATE cp2_users SET name=%s, email=%s, phone=%s, permissions=%s, role=%s WHERE id=%s", 
                          (name, email, phone, permissions, role, uid))
                
            conn.commit()
            conn.close()
            return jsonify({"success": True})
        except Exception as e:
            if "UNIQUE constraint failed" in str(e):
                return jsonify({"error": "Acest email este deja folosit."}), 400
            return jsonify({"error": str(e)}), 500
        
    elif request.method == 'DELETE':
        if user['role'] != 'Super Admin': return jsonify({"error": "Unauthorized"}), 401
        if user['id'] == uid: return jsonify({"error": "Cannot delete self"}), 400
        conn = cp2_db.get_db()
        c = conn.cursor(cursor_factory=RealDictCursor)
        c.execute("DELETE FROM cp2_users WHERE id=%s", (uid,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})



# ─── Slots Inventory API ────────────────────────────────────────────────────
@app.route('/api/slots/inventory')
def slots_inventory():
    conn = get_conn()
    cp_conn = cp2_db.get_db()
    try:
        # Get machine RAM clears
        with conn.cursor() as c:
            c.execute("SELECT machine_id, MAX(datetime) as last_ram_clear FROM machine_resets WHERE reset_type = 0 GROUP BY machine_id")
            resets = {r['machine_id']: r['last_ram_clear'].strftime('%Y-%m-%d') for r in c.fetchall() if r['last_ram_clear']}
            
            # Get machines data
            c.execute("""
                SELECT m.id, m.slot_machine_id, m.status, m.mechanical_status,
                       REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
                       l.id as location_id,
                       mt.name as mix,
                       mt.manufacturer as provider,
                       mct.name as cabinet,
                       m.tva_expiration_date
                FROM machines m
                LEFT JOIN locations l ON l.id = m.location_id
                LEFT JOIN machine_types mt ON mt.id = m.machine_type_id
                LEFT JOIN machine_cabinet_types mct ON mct.id = m.cabinet_type_id
                WHERE m.deleted_at IS NULL
            """)
            machines = c.fetchall()
            
            # Calculate hold pct (all time)
            c.execute("SELECT machine_id, SUM(`in`) as tot_in, SUM(`in` - `out`) as ggr FROM machine_audit_summaries GROUP BY machine_id")
            hold_pcts = {}
            for r in c.fetchall():
                if r['tot_in'] and r['tot_in'] > 0:
                    hold_pcts[r['machine_id']] = round(r['ggr'] / r['tot_in'] * 100, 2)
                    
        # Get notes and files from local DB
        c2 = cp_conn.cursor(cursor_factory=RealDictCursor)
        c2.execute("SELECT machine_id, note, created_at FROM cp2_slot_notes ORDER BY created_at DESC")
        notes_map = {}
        for row in c2.fetchall():
            mid = row['machine_id']
            if mid not in notes_map: notes_map[mid] = []
            notes_map[mid].append(dict_from_row(row))
            
        c2.execute("SELECT machine_id, filename, filepath, created_at FROM cp2_slot_files ORDER BY created_at DESC")
        files_map = {}
        for row in c2.fetchall():
            mid = row['machine_id']
            if mid not in files_map: files_map[mid] = []
            files_map[mid].append(dict_from_row(row))
            
        result = []
        for m in machines:
            mid = m['id']
            m['last_ram_clear'] = resets.get(mid, '—')
            m['rto_pct'] = hold_pcts.get(mid, 0)
            m['notes'] = notes_map.get(mid, [])
            m['files'] = files_map.get(mid, [])
            # Convert dates to string safely
            if m['tva_expiration_date']:
                m['tva_expiration_date'] = m['tva_expiration_date'].strftime('%Y-%m-%d')
            result.append(m)
            
        return jsonify(result)
    finally:
        conn.close()
        cp_conn.close()

@app.route('/api/slots/<int:mid>/notes', methods=['POST'])
def add_slot_note(mid):
    data = request.json
    note = data.get('note')
    if not note: return jsonify({"error": "Note empty"}), 400
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("INSERT INTO cp2_slot_notes (machine_id, note) VALUES (%s, %s)", (mid, note))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/slots/<int:mid>/files', methods=['POST'])
def upload_slot_file(mid):
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "Empty filename"}), 400
    
    os.makedirs('uploads', exist_ok=True)
    filename = secure_filename(file.filename)
    filepath = os.path.join('uploads', filename)
    file.save(filepath)
    
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("INSERT INTO cp2_slot_files (machine_id, filename, filepath) VALUES (%s, %s, %s)", 
              (mid, filename, filepath))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "filename": filename, "filepath": filepath})


from flask import send_from_directory

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory('uploads', filename)

@app.route('/api/invitations', methods=['POST'])
def create_invitation():
    user = require_auth()
    if not user or user['role'] != 'Super Admin': return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    email = data.get('email')
    role = data.get('role', 'Operational')
    permissions = data.get('permissions', '{}')
    if not email: return jsonify({"error": "Missing email"}), 400
    
    code = secrets.token_urlsafe(16)
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    # Ensure invitations table has permissions column
    try:
        c.execute('ALTER TABLE cp2_invitations ADD COLUMN permissions TEXT')
    except:
        pass
    c.execute("INSERT INTO cp2_invitations (code, email, role, permissions) VALUES (%s, %s, %s, %s)", (code, email, role, permissions))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "code": code})

@app.route('/api/invitations', methods=['GET'])
def list_invitations():
    user = require_auth()
    if not user or user['role'] != 'Super Admin': return jsonify({"error": "Unauthorized"}), 401
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT code, email, role, permissions, created_at FROM cp2_invitations")
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/invitations/<code>', methods=['GET', 'DELETE'])
def check_invitation(code):
    user = None
    if request.method == 'DELETE':
        user = require_auth()
        if not user or user['role'] != 'Super Admin': return jsonify({"error": "Unauthorized"}), 401
        
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    
    if request.method == 'DELETE':
        c.execute("DELETE FROM cp2_invitations WHERE code = %s", (code,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
        
    c.execute("SELECT * FROM cp2_invitations WHERE code=%s AND used=FALSE", (code,))
    inv = c.fetchone()
    conn.close()
    if not inv: return jsonify({"error": "Cod invalid sau deja folosit"}), 400
    return jsonify({"email": inv['email'], "role": inv['role']})

@app.route('/api/register', methods=['POST'])
def register_with_invite():
    data = request.json
    code = data.get('code')
    name = data.get('name')
    phone = data.get('phone', '')
    password = data.get('password')
    
    if not all([code, name, password]): return jsonify({"error": "Missing fields"}), 400
    
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT * FROM cp2_invitations WHERE code=%s AND used=FALSE", (code,))
    inv = c.fetchone()
    if not inv:
        conn.close()
        return jsonify({"error": "Cod invalid sau expirat"}), 400
    
    pwd_hash = hashlib.sha256(password.encode()).hexdigest()
    try:
        perms = inv['permissions'] if 'permissions' in inv.keys() and inv['permissions'] else '{}'
        c.execute("INSERT INTO users (name, email, phone, password_hash, role, permissions) VALUES (%s, %s, %s, %s, %s, %s)",
                  (name, inv['email'], phone, pwd_hash, inv['role'], perms))
        c.execute("UPDATE cp2_invitations SET used=TRUE WHERE id=%s", (inv['id'],))
        conn.commit()
        success = True
    except sqlite3.IntegrityError:
        success = False
    conn.close()
    
    if not success: return jsonify({"error": "Email-ul exista deja"}), 400
    return jsonify({"success": True})

# ─── EXPENSES MANAGEMENT ──────────────────────────────────────────────────

@app.route('/api/admin/expense_form_data')
def expense_form_data():
    date_param = request.args.get('date', '')
    if not date_param:
        date_param = datetime.datetime.now().strftime('%Y-%m-%d')
        
    deps = pg_qry("SELECT id, name FROM casino_departments ORDER BY name")
    types = pg_qry("SELECT id, name, department_id FROM casino_expenditure_types ORDER BY name")
    pg_locs = pg_qry("SELECT id, name FROM casino_locations ORDER BY name")
    
    cfg = get_exp_config()
    excl = set(cfg.get('excluded_types', []))
    
    for ld in cfg.get('local_departments', []):
        deps.append({'id': ld['id'], 'name': ld['name']})
        
    filtered_types = []
    for t in types:
        if str(t['id']) not in excl:
            filtered_types.append(t)
    types = filtered_types
            
    for lt in cfg.get('local_types', []):
        if str(lt['id']) not in excl:
            types.append({'id': lt['id'], 'name': lt['name'], 'department_id': lt.get('department_id', '')})
        
    deps.sort(key=lambda x: x['name'].lower())
    types.sort(key=lambda x: x['name'].lower())
    
    mysql_locs = qry("SELECT id, code FROM locations")
    pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
    
    active_m = qry("SELECT location_id, COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date=%s GROUP BY location_id", (date_param,))
    
    if not active_m:
        # Fallback to current active machines
        active_m = qry("SELECT location_id, COUNT(id) as c FROM machines WHERE active=1 GROUP BY location_id")
        
    mysql_slot_counts = {str(r['location_id']): r['c'] for r in active_m}
    
    pg_slots = {str(l['id']): 0 for l in pg_locs}
    for ml in mysql_locs:
        norm = normalize_loc_name(ml['code'])
        if norm in pg_name_to_id:
            pid = pg_name_to_id[norm]
            pg_slots[pid] += mysql_slot_counts.get(str(ml['id']), 0)
            
    locations = []
    for l in pg_locs:
        locations.append({
            'id': str(l['id']),
            'name': l['name'],
            'slots': pg_slots.get(str(l['id']), 0)
        })
        
    return jsonify({
        'departments': deps,
        'types': types,
        'locations': locations
    })

@app.route('/api/admin/expenses', methods=['POST'])
def save_manual_expense():
    user = require_auth()
    if not user: return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    loc_ids = data.get('loc_ids', [])
    if not loc_ids: return jsonify({'error': 'Nicio locatie selectata'}), 400
    
    amount = float(data.get('amount', 0))
    split_mode = data.get('split_mode', 'equal')
    date_param = data.get('date', '')
    
    slots_map = {}
    if split_mode == 'slots':
        mysql_locs = qry("SELECT id, code FROM locations")
        pg_locs = pg_qry("SELECT id, name FROM casino_locations")
        pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
        
        today = datetime.now().strftime('%Y-%m-%d')
        if date_param < today:
            active_m = qry("SELECT location_id, COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date=%s GROUP BY location_id", (date_param,))
        else:
            active_m = qry("SELECT location_id, COUNT(*) as c FROM machines WHERE deleted_at IS NULL GROUP BY location_id")
            
        if not active_m and date_param < today:
            active_m = qry("SELECT location_id, COUNT(*) as c FROM machines WHERE deleted_at IS NULL GROUP BY location_id")
            
        mysql_slot_counts = {str(r['location_id']): r['c'] for r in active_m}
        
        pg_slots = {str(l['id']): 0 for l in pg_locs}
        for ml in mysql_locs:
            norm = normalize_loc_name(ml['code'])
            if norm in pg_name_to_id:
                pid = pg_name_to_id[norm]
                pg_slots[pid] += mysql_slot_counts.get(str(ml['id']), 0)
        slots_map = pg_slots

    total_slots = sum([slots_map.get(str(lid), 0) for lid in loc_ids]) if split_mode == 'slots' else 0
    
    for lid in loc_ids:
        lid_str = str(lid)
        
        if split_mode == 'slots' and total_slots > 0:
            s_count = slots_map.get(lid_str, 0)
            loc_amount = round(amount * (s_count / total_slots), 2)
        else:
            loc_amount = round(amount / len(loc_ids), 2)
            
        if loc_amount == 0: continue
            
        import uuid
        pg_qry("""
            INSERT INTO casino_payments 
            (id, date, operational_date, explanation, amount, location_id, department_id, expenditure_type_id, direction, details)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1, %s)
        """, (
            str(uuid.uuid4()),
            data['date'],
            data['date'],
            data['explanation'],
            loc_amount,
            lid_str,
            data['department_id'],
            data['expenditure_type_id'],
            user.get('name', 'User')
        ))
        
    return jsonify({'success': True})

@app.route('/api/admin/expenses_import', methods=['POST'])
def import_google_sheets_expense():
    data = request.json
    link = data.get('link', '')
    is_preview = data.get('preview', False)
    
    if '/d/' not in link: return jsonify({'error': 'Link invalid'}), 400
    sheet_id = link.split('/d/')[1].split('/')[0]
    
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    
    try:
        req = urllib.request.Request(csv_url)
        with urllib.request.urlopen(req) as response:
            csv_data = response.read().decode('utf-8')
    except Exception as e:
        return jsonify({'error': f'Nu s-a putut descărca documentul. Sigur este public? ({str(e)})'}), 400
        
    reader = csv.reader(StringIO(csv_data))
    header = next(reader, None)
    if not header: return jsonify({'error': 'Fișier gol.'}), 400
    
    h_lower = [h.lower().strip() for h in header]
    try:
        idx_date = h_lower.index('data') if 'data' in h_lower else h_lower.index('date')
        idx_expl = h_lower.index('explicatie') if 'explicatie' in h_lower else h_lower.index('explanation')
        idx_amt = h_lower.index('suma') if 'suma' in h_lower else h_lower.index('amount')
        idx_loc = h_lower.index('locatie') if 'locatie' in h_lower else h_lower.index('location')
        idx_dep = h_lower.index('departament') if 'departament' in h_lower else h_lower.index('department')
        idx_cat = h_lower.index('categorie') if 'categorie' in h_lower else (h_lower.index('tip') if 'tip' in h_lower else -1)
    except ValueError as e:
        return jsonify({'error': f'Coloană lipsă. Găsite: {", ".join(h_lower)}. Necesare: Data, Explicatie, Suma, Locatie, Departament.'}), 400
        
    pg_locs = pg_qry("SELECT id, name FROM casino_locations")
    pg_deps = pg_qry("SELECT id, name FROM casino_departments")
    pg_types = pg_qry("SELECT id, name FROM casino_expenditure_types")
    
    loc_map = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
    dep_map = {d['name'].strip().lower(): str(d['id']) for d in pg_deps}
    type_map = {t['name'].strip().lower(): str(t['id']) for t in pg_types}
    
    inserted = 0
    preview_data = []
    import uuid
    for row in reader:
        if len(row) <= idx_amt: continue
        
        date_str = row[idx_date].strip()
        expl_str = row[idx_expl].strip()
        amt_str = row[idx_amt].strip().replace(',', '.')
        loc_str = row[idx_loc].strip()
        dep_str = row[idx_dep].strip().lower()
        cat_str = row[idx_cat].strip().lower() if idx_cat >= 0 and idx_cat < len(row) else ''
        
        if not amt_str or not date_str or not loc_str: continue
            
        try:
            amt = float(amt_str)
        except:
            continue
            
        norm_loc = normalize_loc_name(loc_str)
        if norm_loc not in loc_map: continue
        if dep_str not in dep_map: continue
        
        if is_preview:
            preview_data.append({
                'date': date_str,
                'explanation': expl_str,
                'amount': amt,
                'location_name': norm_loc.upper(),
                'department_name': dep_str.upper(),
                'category_name': cat_str.upper() if cat_str else '-'
            })
            continue

        loc_id = loc_map[norm_loc]
        dep_id = dep_map[dep_str]
        cat_id = type_map[cat_str] if cat_str in type_map else None
        
        pg_qry("""
            INSERT INTO casino_payments 
            (id, date, operational_date, explanation, amount, location_id, department_id, expenditure_type_id, direction, details)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1, 'Google Sheet')
        """, (
            str(uuid.uuid4()),
            date_str,
            date_str,
            expl_str,
            amt,
            loc_id,
            dep_id,
            cat_id
        ))
        inserted += 1

    if is_preview:
        return jsonify({'success': True, 'preview_data': preview_data})

    return jsonify({'success': True, 'inserted_count': inserted})

@app.route('/api/admin/expenses/<expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    try:
        pg_qry("DELETE FROM casino_payments WHERE id = %s", (expense_id,))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/expenses/<expense_id>', methods=['PUT'])
def edit_expense(expense_id):
    data = request.json
    try:
        pg_qry("""
            UPDATE casino_payments 
            SET date = %s, operational_date = %s, amount = %s, explanation = %s, department_id = %s, expenditure_type_id = %s
            WHERE id = %s
        """, (
            data.get('date'),
            data.get('date'),
            float(data.get('amount', 0)),
            data.get('explanation'),
            data.get('department_id'),
            data.get('expenditure_type_id'),
            expense_id
        ))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/expenses/<expense_id>/toggle_hide', methods=['POST'])
def toggle_hide_expense(expense_id):
    try:
        # Toggle boolean: if NULL or false -> true, if true -> false
        pg_qry("""
            UPDATE casino_payments
            SET is_hidden = NOT COALESCE(is_hidden, FALSE)
            WHERE id = %s
        """, (expense_id,))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/expenses/bulk', methods=['DELETE'])
def bulk_delete_expenses():
    data = request.json
    ids = data.get('ids', [])
    if not ids: return jsonify({'error': 'No ids provided'}), 400
    try:
        ph = ','.join(['%s'] * len(ids))
        pg_qry(f"DELETE FROM casino_payments WHERE id IN ({ph})", tuple(ids))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/expenses/bulk', methods=['PUT'])
def bulk_edit_expenses():
    data = request.json
    ids = data.get('ids', [])
    if not ids: return jsonify({'error': 'No ids provided'}), 400
    
    updates, params = [], []
    if 'date' in data and data['date']:
        updates.append("date = %s")
        updates.append("operational_date = %s")
        params.extend([data['date'], data['date']])
    if 'department_id' in data and data['department_id']:
        updates.append("department_id = %s")
        params.append(data['department_id'])
    if 'expenditure_type_id' in data and data['expenditure_type_id']:
        updates.append("expenditure_type_id = %s")
        params.append(data['expenditure_type_id'])
        
    if not updates: return jsonify({'success': True})
        
    try:
        ph = ','.join(['%s'] * len(ids))
        sql = f"UPDATE casino_payments SET {', '.join(updates)} WHERE id IN ({ph})"
        params.extend(ids)
        pg_qry(sql, tuple(params))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def sync_historical_incomes():
    try:
        # Get max date from Postgres
        pg_rows = pg_qry("SELECT MAX(date) as max_d FROM cp2_daily_incomes")
        max_d = pg_rows[0]['max_d'] if pg_rows and pg_rows[0]['max_d'] else None
        
        import datetime
        today = datetime.date.today()
        yesterday = today - datetime.timedelta(days=1)
        
        if max_d is None:
            # First run, get last 12 months
            start_sync = today - datetime.timedelta(days=365)
        else:
            start_sync = max_d + datetime.timedelta(days=1)
            
        if start_sync > yesterday:
            return
            
        # Query MySQL for these dates
        mysql_sql = "SELECT mas.date, mas.location_id, SUM(mas.`in`) as total_in, SUM(mas.`out`) as total_out, SUM(mas.`in` - mas.`out`) as total_ggr FROM machine_audit_summaries mas WHERE mas.date >= %s AND mas.date <= %s GROUP BY mas.date, mas.location_id"
        mysql_data = qry(mysql_sql, [start_sync.strftime('%Y-%m-%d'), yesterday.strftime('%Y-%m-%d')])
        
        if not mysql_data:
            return
            
        conn = get_pg_conn()
        c = conn.cursor()
        
        for row in mysql_data:
            c.execute("INSERT INTO cp2_daily_incomes (date, location_id, total_in, total_out, total_ggr) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (date, location_id) DO NOTHING", (row['date'], str(row['location_id']), row['total_in'], row['total_out'], row['total_ggr']))
            
        conn.commit()
        conn.close()
    except Exception as e:
        print("Error in sync_historical_incomes:", e)


@app.route('/api/reports/pl_heatmap')
def api_pl_heatmap():
    sync_historical_incomes()
    
    lf_mysql, lp_mysql = loc_filter(request, alias='mas')
    
    # Build a specific pg filter because cp2_daily_incomes uses varchar for location_id
    lf_pg = ""
    lp_pg = []
    ids_raw = request.args.get('loc_ids', '')
    if ids_raw:
        try:
            ids = [int(x) for x in ids_raw.split(',') if x.strip().isdigit()]
            expanded = set()
            from server import LOC_CHILDREN
            for i in ids:
                expanded.add(i)
                expanded.update(LOC_CHILDREN.get(i, []))
            if expanded:
                ph = ','.join(['%s'] * len(expanded))
                lf_pg = f" AND cp.location_id::int IN ({ph})"
                lp_pg = list(expanded)
        except:
            pass

    mysql_locs = qry("SELECT id, COALESCE(display_code, code) as name FROM locations")
    mysql_name_map = {str(l['id']): l['name'] for l in mysql_locs}

    # 1. Postgres historical query (up to yesterday)
    pg_sql = f"""
        SELECT 
            TO_CHAR(cp.date, 'YYYY-MM') AS month,
            cp.location_id,
            SUM(cp.total_ggr) as ngr
        FROM cp2_daily_incomes cp
        WHERE cp.date >= CURRENT_DATE - INTERVAL '12 months'
          AND cp.date < CURRENT_DATE
        {lf_pg}
        GROUP BY month, cp.location_id
    """
    pg_rev_rows = pg_qry(pg_sql, lp_pg)
    
    # 2. MySQL today query
    mysql_sql = f"""
        SELECT 
            DATE_FORMAT(mas.date, '%%Y-%%m') AS month,
            mas.location_id,
            SUM(mas.`in`-mas.`out`) as ngr
        FROM machine_audit_summaries mas
        WHERE mas.date = CURDATE()
        {lf_mysql}
        GROUP BY month, mas.location_id
    """
    mysql_rev_rows = qry(mysql_sql, lp_mysql)
    
    # Combine results
    combined_rev = {}
    
    for r in pg_rev_rows:
        key = (r['month'], str(r['location_id']))
        if key not in combined_rev:
            combined_rev[key] = {'month': r['month'], 'location_id': str(r['location_id']), 'ngr': 0}
        combined_rev[key]['ngr'] += float(r['ngr'])
        
    for r in mysql_rev_rows:
        key = (r['month'], str(r['location_id']))
        if key not in combined_rev:
            combined_rev[key] = {'month': r['month'], 'location_id': str(r['location_id']), 'ngr': 0}
        combined_rev[key]['ngr'] += float(r['ngr'] or 0)
        
    # Format for output
    rev_rows = []
    for k, v in combined_rev.items():
        rev_rows.append({
            'month': v['month'],
            'location_name': mysql_name_map.get(v['location_id'], 'Unknown'),
            'ngr': v['ngr']
        })

    
    cfg = get_exp_config()
    excl_types = cfg.get('excluded_types', [])
    
    # Build PG location filter matching the active MySQL loc_ids
    mysql_locs = qry("SELECT id, code FROM locations")
    pg_locs = pg_qry("SELECT id, name FROM casino_locations")
    pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
    mysql_to_pg_map = {}
    for ml in mysql_locs:
        norm = normalize_loc_name(ml['code'])
        if norm in pg_name_to_id:
            mysql_to_pg_map[str(ml['id'])] = pg_name_to_id[norm]

    ids_raw = request.args.get('loc_ids', '')
    pg_loc_ids = []
    if ids_raw:
        for i in [x.strip() for x in ids_raw.split(',') if x.strip()]:
            if i in mysql_to_pg_map:
                pg_loc_ids.append(mysql_to_pg_map[i])
    else:
        pg_loc_ids = list(mysql_to_pg_map.values())

    pg_loc_where = ""
    pg_params = []
    if pg_loc_ids:
        ph = ','.join(['%s'] * len(pg_loc_ids))
        pg_loc_where = f" AND p.location_id IN ({ph})"
        pg_params.extend(pg_loc_ids)
    else:
        pg_loc_where = " AND 1=0"

    pg_name_map = {str(l['id']): l['name'] for l in pg_locs}

    pg_excl = ""
    if excl_types:
        ph_t = ','.join([f"'{t}'" for t in excl_types])
        pg_excl = f" AND (p.expenditure_type_id IS NULL OR p.expenditure_type_id::text NOT IN ({ph_t}))"

    pg_sql = f"""
        SELECT 
            SUBSTRING(p.date::text FROM 1 FOR 7) AS month,
            p.location_id,
            SUM(p.amount) as expenses
        FROM casino_payments p
        WHERE p.direction = 1 AND p.date >= CURRENT_DATE - INTERVAL '12 months'
        {pg_loc_where}{pg_excl}
        GROUP BY month, p.location_id
    """
    exp_rows = pg_qry(pg_sql, pg_params)
    for r in exp_rows:
        r['location_name'] = pg_name_map.get(str(r['location_id']), 'Unknown')
        r['expenses'] = float(r['expenses'] or 0)
    
    return jsonify({
        "revenue": rev_rows,
        "expenses": exp_rows
    })


@app.route('/api/reports/expenses')
def api_expenses():
    start, end = period_params(request)
    
    mysql_locs = qry("SELECT id, code FROM locations")
    pg_locs = pg_qry("SELECT id, name FROM casino_locations")
    pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
    
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
        pg_loc_ids = list(mysql_to_pg_map.values())

    pg_loc_where = ""
    pg_params = [start + ' 00:00:00', end + ' 23:59:59']
    if pg_loc_ids:
        ph = ','.join(['%s']*len(pg_loc_ids))
        pg_loc_where = f" AND p.location_id IN ({ph})"
        pg_params.extend(pg_loc_ids)
    else:
        pg_loc_where = " AND 1=0"

    cfg = get_exp_config()
    excl_deps = cfg.get('excluded_departments', [])
    excl_types = cfg.get('excluded_types', [])
    
    pg_excl_where = ""
    if excl_types:
        ph_t = ','.join([f"'{t}'" for t in excl_types])
        pg_excl_where += f" AND (p.expenditure_type_id IS NULL OR p.expenditure_type_id::text NOT IN ({ph_t}))"

    rows = pg_qry(f"""
        SELECT
            p.id,
            p.date,
            p.operational_date,
            p.explanation,
            p.amount,
            cl.name AS location_name,
            cd.name AS department_name,
            pt.name AS type_name,
            et.name AS expenditure_type_name,
            v.name AS vendor_name,
            p.other_info,
            p.department_id,
            p.expenditure_type_id,
            p.details,
            u.first_name,
            u.last_name,
            p.is_hidden
        FROM casino_payments p
        LEFT JOIN casino_locations cl ON p.location_id = cl.id
        LEFT JOIN casino_departments cd ON p.department_id = cd.id
        LEFT JOIN casino_payment_types pt ON p.type_id = pt.id
        LEFT JOIN casino_expenditure_types et ON p.expenditure_type_id = et.id
        LEFT JOIN casino_vendors v ON p.vendor_id = v.id
        LEFT JOIN users u ON p.created_by_id = u.id
        WHERE p.direction = 1
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
          AND p.date >= %s AND p.date <= %s
          {pg_loc_where} {pg_excl_where}
        ORDER BY p.date DESC
    """, pg_params)
    
    data = []
    cfg = get_exp_config()
    ld_map = {ld['id']: ld['name'] for ld in cfg.get('local_departments', [])}
    lt_map = {lt['id']: lt['name'] for lt in cfg.get('local_types', [])}
    
    for r in rows:
        d_name = r['department_name']
        t_name = r['expenditure_type_name']
        
        if not d_name and r['department_id'] in ld_map:
            d_name = ld_map[r['department_id']]
        if not t_name and r['expenditure_type_id'] in lt_map:
            t_name = lt_map[r['expenditure_type_id']]
            
        added_by = '-'
        if r['first_name'] or r['last_name']:
            added_by = f"{r['first_name'] or ''} {r['last_name'] or ''}".strip()
        elif r['details']:
            added_by = r['details']
            
        data.append({
            'id': r['id'],
            'date': str(r['date'])[:10] if r['date'] else '-',
            'explanation': r['explanation'] or '-',
            'amount': float(r['amount'] or 0),
            'location_name': r['location_name'] or '-',
            'department_name': d_name or '-',
            'type_name': r['type_name'] or '-',
            'expenditure_type_name': t_name or '-',
            'vendor_name': r['vendor_name'] or '-',
            'added_by': added_by,
            'is_manual': not bool(r['other_info']),
            'is_hidden': bool(r['is_hidden'])
        })
        
    # FETCH AND APPEND FIXED EXPENSES
    fixed_rows = pg_qry("""
        SELECT
            f.id,
            f.expense_date as date,
            f.location_ids,
            f.department_id,
            f.type_id,
            f.total_ron as amount,
            cd.name AS department_name,
            et.name AS expenditure_type_name
        FROM cp2_monthly_fixed_expenses f
        JOIN casino_departments cd ON f.department_id = cd.id
        JOIN casino_expenditure_types et ON f.type_id = et.id
        WHERE f.expense_date >= %s AND f.expense_date <= %s
    """, (start, end))

    for r in fixed_rows:
        target_locs = r['location_ids']
        if target_locs and isinstance(target_locs, list):
            target_locs = [str(lid) for lid in target_locs]
        else:
            target_locs = None # implies ALL

        # Proportional Split based on slot counts
        d_str = r['date'].strftime('%Y-%m-%d')
        active_m = qry("SELECT location_id, COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date=%s GROUP BY location_id", (d_str,))
        if not active_m:
            active_m = qry("SELECT location_id, COUNT(DISTINCT machine_id) as c FROM machine_daily_meters WHERE date = (SELECT MAX(date) FROM machine_daily_meters) GROUP BY location_id")
        
        mysql_counts = {str(m['location_id']): m['c'] for m in active_m}
        
        pg_slots = {}
        for mid, c in mysql_counts.items():
            if mid in mysql_to_pg_map:
                pid = mysql_to_pg_map[mid]
                if target_locs is None or pid in target_locs:
                    pg_slots[pid] = pg_slots.get(pid, 0) + c
                
        total_slots = sum(pg_slots.values())
        if total_slots > 0:
            for lid, slots in pg_slots.items():
                if lid in pg_loc_ids: # only include in report if lid is requested by user filters
                    fraction = slots / total_slots
                    amt = float(r['amount']) * fraction
                    loc_name = next((l['name'] for l in pg_locs if str(l['id']) == lid), '-')
                    
                    data.append({
                        'id': f"fixed_{r['id']}_{lid}",
                        'date': str(r['date'])[:10],
                        'explanation': 'Taxă Recurentă (Repartizată)' if target_locs is None else 'Taxă Recurentă (Selecție)',
                        'amount': round(amt, 2),
                        'location_name': loc_name,
                        'department_name': r['department_name'],
                        'type_name': '-',
                        'expenditure_type_name': r['expenditure_type_name'],
                        'vendor_name': '-',
                        'added_by': 'Sistem (Automat)',
                        'is_manual': True
                    })

    # FETCH AND APPEND ACTIVE CONTRACTS WITH AUTO EXPENSE
    contracts_rows = pg_qry("""
        SELECT
            c.id,
            c.type,
            cl.amount,
            cl.location_id,
            c.owner_name,
            c.details
        FROM cp2_contracts c
        JOIN cp2_contract_locations cl ON c.id = cl.contract_id
        WHERE c.auto_expense = true
          AND c.start_date <= %s
          AND (c.end_date IS NULL OR c.end_date >= %s)
    """, (end, start))

    for r in contracts_rows:
        lid = str(r['location_id'])
        if lid in pg_loc_ids:
            loc_name = next((l['name'] for l in pg_locs if str(l['id']) == lid), '-')
            dep_name = 'Chirie' if r['type'] and r['type'].lower().startswith('chiri') else 'Contracte Automate'
            
            data.append({
                'id': f"contract_{r['id']}_{lid}",
                'date': start[:10],
                'explanation': f"Contract: {r['type'] or ''}",
                'amount': float(r['amount'] or 0),
                'location_name': loc_name,
                'department_name': dep_name,
                'type_name': '-',
                'expenditure_type_name': r['type'] or 'Contract',
                'vendor_name': r['owner_name'] or '-',
                'added_by': 'Sistem (Contract)',
                'is_manual': True
            })

    data.sort(key=lambda x: x['date'], reverse=True)
    return jsonify(data)

@app.route('/api/reports/pos')
def api_reports_pos():
    start, end = period_params(request)
    
    mysql_locs = qry("SELECT id, code FROM locations")
    pg_locs = pg_qry("SELECT id, name FROM casino_locations")
    pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
    
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
        pg_loc_ids = list(mysql_to_pg_map.values())

    pg_loc_where = ""
    pg_params = [start, end]
    if pg_loc_ids:
        ph = ','.join(['%s']*len(pg_loc_ids))
        pg_loc_where = f" AND p.location_id IN ({ph})"
        pg_params.extend(pg_loc_ids)
    else:
        pg_loc_where = " AND 1=0"

    sql = f"""
        SELECT 
            cl.name AS location_name,
            p.operational_date AS op_date,
            SUM(p.amount) AS total_amount,
            COUNT(p.id) AS trx_count
        FROM casino_payments p
        JOIN casino_locations cl ON p.location_id = cl.id
        LEFT JOIN casino_payment_types pt ON p.type_id = pt.id
        LEFT JOIN casino_departments cd ON p.department_id = cd.id
        WHERE p.operational_date >= %s::date AND p.operational_date <= %s::date
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
          AND (pt.name ILIKE '%%pos%%' OR cd.name ILIKE '%%pos%%')
          {pg_loc_where}
        GROUP BY cl.name, p.operational_date
        ORDER BY p.operational_date ASC
    """
    
    rows = pg_qry(sql, pg_params)
    
    in_sql = f"""
        SELECT 
            cl.name AS location_name,
            cp.date AS op_date,
            SUM(cp.total_in) AS total_in
        FROM cp2_daily_incomes cp
        JOIN casino_locations cl ON cp.location_id::text = cl.id::text
        WHERE cp.date >= %s::date AND cp.date <= %s::date
    """
    in_params = [start, end]
    if pg_loc_ids:
        in_sql += f" AND cp.location_id::text IN ({pg_loc_where.replace(' AND p.location_id IN (', '').replace(')','')})"
        in_params.extend([str(x) for x in pg_loc_ids])
    in_sql += " GROUP BY cl.name, cp.date"
    
    in_rows = pg_qry(in_sql, in_params)
    in_map = {}
    for r in in_rows:
        d_val = r['op_date']
        d = d_val.strftime('%d.%m.%Y') if hasattr(d_val, 'strftime') else str(d_val)[:10]
        # try format if it's string
        if isinstance(d_val, str) and '-' in d_val:
            try: d = datetime.strptime(d_val[:10], '%Y-%m-%d').strftime('%d.%m.%Y')
            except: pass
        if d not in in_map: in_map[d] = {}
        in_map[d][r['location_name']] = float(r['total_in'] or 0)
    
    days_map = {}
    all_locs = set()
    for r in rows:
        d_val = r['op_date']
        # d_val could be datetime.date or string
        if hasattr(d_val, 'strftime'):
            d = d_val.strftime('%d.%m.%Y')
        else:
            try:
                # If it comes as '2026-07-01'
                d = datetime.strptime(str(d_val)[:10], '%Y-%m-%d').strftime('%d.%m.%Y')
            except:
                d = str(d_val)
        loc = r['location_name']
        amt = float(r['total_amount'] or 0)
        cnt = int(r['trx_count'] or 0)
        
        all_locs.add(loc)
        if d not in days_map:
            days_map[d] = {}
        if loc not in days_map[d]:
            days_map[d][loc] = {'amount': 0, 'count': 0, 'total_in': in_map.get(d, {}).get(loc, 0)}
            
        days_map[d][loc]['amount'] += amt
        days_map[d][loc]['count'] += cnt
        
    days_list = []
    def parse_d(ds):
        try:
            return datetime.strptime(ds, '%d.%m.%Y')
        except:
            return datetime.min
    
    sorted_days = sorted(list(days_map.keys()), key=parse_d)
    
    for d in sorted_days:
        days_list.append({
            'date': d,
            'locations': days_map[d]
        })
        
    return jsonify({
        'days': days_list,
        'locations': sorted(list(all_locs))
    })

def sync_recurring_expenses(target_month_str):
    import datetime, calendar, json
    
    synced = pg_qry("SELECT id FROM cp2_recurring_sync_log WHERE sync_month = %s", (target_month_str,))
    if synced: return
        
    try:
        y, m = map(int, target_month_str.split('-'))
        if m == 1:
            prev_y, prev_m = y - 1, 12
        else:
            prev_y, prev_m = y, m - 1
            
        last_day_prev = calendar.monthrange(prev_y, prev_m)[1]
        start_prev = f"{prev_y}-{prev_m:02d}-01"
        end_prev = f"{prev_y}-{prev_m:02d}-{last_day_prev}"
        
        recurrences = pg_qry("""
            SELECT location_ids, department_id, type_id, quantity, unit_value, currency, eur_rate, total_ron, is_recurring
            FROM cp2_monthly_fixed_expenses
            WHERE expense_date >= %s AND expense_date <= %s AND is_recurring = True
        """, (start_prev, end_prev))
        
        target_date = f"{y}-{m:02d}-01"
        
        for r in recurrences:
            locs_json = json.dumps(r['location_ids']) if r['location_ids'] else None
            pg_qry("""
                INSERT INTO cp2_monthly_fixed_expenses 
                (expense_date, location_ids, department_id, type_id, quantity, unit_value, currency, eur_rate, total_ron, is_recurring)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (target_date, locs_json, r['department_id'], r['type_id'], r['quantity'], r['unit_value'], r['currency'], r['eur_rate'], r['total_ron'], True))
            
        pg_qry("INSERT INTO cp2_recurring_sync_log (sync_month) VALUES (%s)", (target_month_str,))
    except Exception as e:
        print(f"Failed to sync recurring expenses for {target_month_str}: {e}")

@app.route('/api/expenses/fixed', methods=['GET', 'POST'])
def api_fixed_expenses():
    if request.method == 'GET':
        month = request.args.get('month', '') # Format: YYYY-MM
        if not month:
            return jsonify({'error': 'Month parameter required (YYYY-MM)'}), 400
            
        sync_recurring_expenses(month)
            
        import calendar
        year, m = map(int, month.split('-'))
        last_day = calendar.monthrange(year, m)[1]
        start_date = f"{year}-{m:02d}-01"
        end_date = f"{year}-{m:02d}-{last_day}"
            
        rows = pg_qry("""
            SELECT f.id, f.expense_date, f.location_ids, f.department_id, f.type_id,
                   f.quantity, f.unit_value, f.currency, f.eur_rate, f.total_ron, f.is_recurring, f.details,
                   d.name as department_name, t.name as type_name
            FROM cp2_monthly_fixed_expenses f
            LEFT JOIN casino_departments d ON f.department_id::text = d.id::text
            LEFT JOIN casino_expenditure_types t ON f.type_id::text = t.id::text
            WHERE f.expense_date >= %s AND f.expense_date <= %s
            ORDER BY f.expense_date DESC, f.created_at DESC
        """, (start_date, end_date))
        
        pg_locs = pg_qry("SELECT id, name FROM casino_locations")
        pg_loc_map = {str(l['id']): l['name'] for l in pg_locs}
        
        cfg = get_exp_config()
        local_deps = {str(d['id']): d['name'] for d in cfg.get('local_departments', [])}
        local_types = {str(t['id']): t['name'] for t in cfg.get('local_types', [])}
        
        for r in rows:
            r['id'] = str(r['id'])
            r['department_id'] = str(r['department_id'])
            r['type_id'] = str(r['type_id'])
            
            if not r['department_name']:
                r['department_name'] = local_deps.get(r['department_id'], '-')
            if not r['type_name']:
                r['type_name'] = local_types.get(r['type_id'], '-')
            
            loc_names = []
            if r['location_ids'] and isinstance(r['location_ids'], list):
                for lid in r['location_ids']:
                    if str(lid) in pg_loc_map:
                        loc_names.append(pg_loc_map[str(lid)])
            
            r['location_name'] = ', '.join(loc_names) if loc_names else 'Toate (Proporțional)'
            
            r['expense_date'] = r['expense_date'].strftime('%Y-%m-%d')
            r['unit_value'] = float(r['unit_value'])
            r['eur_rate'] = float(r['eur_rate']) if r['eur_rate'] else None
            r['total_ron'] = float(r['total_ron'])
            r['is_recurring'] = bool(r['is_recurring'])
            
        return jsonify(rows)
        
    elif request.method == 'POST':
        data = request.json
        if not data: return jsonify({'error': 'No data'}), 400
        
        expense_date = data.get('expense_date')
        department_id = data.get('department_id')
        type_id = data.get('type_id')
        location_ids = data.get('location_ids')
        quantity = int(data.get('quantity', 1))
        unit_value = float(data.get('unit_value', 0))
        currency = data.get('currency', 'RON')
        eur_rate = float(data.get('eur_rate')) if data.get('eur_rate') else None
        is_recurring = bool(data.get('is_recurring', True))
        details = data.get('details')
        
        if currency == 'EUR' and not eur_rate:
            return jsonify({'error': 'EUR rate required for EUR currency'}), 400
            
        rate = eur_rate if currency == 'EUR' else 1.0
        total_ron = quantity * unit_value * rate
        
        import json
        loc_json = json.dumps(location_ids) if location_ids else None
        
        pg_qry("""
            INSERT INTO cp2_monthly_fixed_expenses 
            (expense_date, location_ids, department_id, type_id, quantity, unit_value, currency, eur_rate, total_ron, is_recurring, details)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (expense_date, loc_json, department_id, type_id, quantity, unit_value, currency, eur_rate, total_ron, is_recurring, details))
        
        return jsonify({'status': 'ok'})

@app.route('/api/expenses/fixed/<expense_id>', methods=['DELETE', 'PUT'])
def api_fixed_expenses_single(expense_id):
    if request.method == 'DELETE':
        pg_qry("DELETE FROM cp2_monthly_fixed_expenses WHERE id = %s", (expense_id,))
        return jsonify({'status': 'ok'})
    elif request.method == 'PUT':
        data = request.json
        if not data: return jsonify({'error': 'No data'}), 400
        
        expense_date = data.get('expense_date')
        department_id = data.get('department_id')
        type_id = data.get('type_id')
        location_ids = data.get('location_ids')
        quantity = int(data.get('quantity', 1))
        unit_value = float(data.get('unit_value', 0))
        currency = data.get('currency', 'RON')
        eur_rate = float(data.get('eur_rate')) if data.get('eur_rate') else None
        is_recurring = bool(data.get('is_recurring', True))
        details = data.get('details')
        
        if currency == 'EUR' and not eur_rate:
            return jsonify({'error': 'EUR rate required for EUR currency'}), 400
            
        rate = eur_rate if currency == 'EUR' else 1.0
        total_ron = quantity * unit_value * rate
        
        import json
        loc_json = json.dumps(location_ids) if location_ids else None
        
        pg_qry("""
            UPDATE cp2_monthly_fixed_expenses 
            SET expense_date = %s, location_ids = %s, department_id = %s, type_id = %s, 
                quantity = %s, unit_value = %s, currency = %s, eur_rate = %s, total_ron = %s, is_recurring = %s,
                details = %s, updated_at = current_timestamp()
            WHERE id = %s
        """, (expense_date, loc_json, department_id, type_id, quantity, unit_value, currency, eur_rate, total_ron, is_recurring, details, expense_id))
        
        return jsonify({'status': 'ok'})

# ─── Machine Details ────────────────────────────────────────────────────────
@app.route('/api/machine/<serial>/details')
def api_machine_details(serial):
    try:
        conn = get_conn()
        c = conn.cursor()
        
        # Basic Info & Location History
        c.execute("""
            SELECT 
                l.display_code as location_name,
                m.created_at,
                m.deleted_at,
                SUM(mas.`in`) as total_in,
                SUM(mas.`out`) as total_out,
                SUM(mas.jackpot) as total_jp,
                SUM(mas.hh) as total_hh
            FROM machines m
            JOIN locations l ON m.location_id = l.id
            LEFT JOIN machine_audit_summaries mas ON mas.machine_id = m.id
            WHERE m.slot_machine_id = %s
            GROUP BY m.id, l.display_code, m.created_at, m.deleted_at
            ORDER BY m.created_at ASC
        """, [serial])
        loc_history = c.fetchall()
        
        # Resets History
        c.execute("""
            SELECT mr.datetime as date, mr.reset_type, l.display_code as location_name
            FROM machine_resets mr
            JOIN machines m ON mr.machine_id = m.id
            JOIN locations l ON m.location_id = l.id
            WHERE m.slot_machine_id = %s AND mr.reset_type = 0
            ORDER BY mr.datetime ASC
        """, [serial])
        resets_history = c.fetchall()
        
        # Large Payouts (> 1000)
        c.execute("""
            SELECT mas.date, mas.`out`, mas.jackpot, mas.hh, l.display_code as location_name
            FROM machine_audit_summaries mas
            JOIN machines m ON mas.machine_id = m.id
            JOIN locations l ON m.location_id = l.id
            WHERE m.slot_machine_id = %s 
              AND (mas.`out` >= 1000 OR mas.jackpot >= 1000 OR mas.hh >= 1000)
            ORDER BY mas.date ASC
        """, [serial])
        large_payouts = c.fetchall()
        
        # Extra stats: total lifetime GGR across all locations
        c.execute("""
            SELECT 
                SUM(mas.`in`) as total_in, 
                SUM(mas.`out`) as total_out, 
                SUM(mas.jackpot) as total_jp
            FROM machine_audit_summaries mas
            JOIN machines m ON mas.machine_id = m.id
            WHERE m.slot_machine_id = %s
        """, [serial])
        stats = c.fetchone() or {}
        
        conn.close()
        
        for r in loc_history:
            r['created_at'] = str(r['created_at']) if r.get('created_at') else '-'
            r['deleted_at'] = str(r['deleted_at']) if r.get('deleted_at') else 'Prezent'
            r['total_in'] = float(r['total_in']) if r.get('total_in') else 0
            r['total_out'] = float(r['total_out']) if r.get('total_out') else 0
            r['total_jp'] = float(r['total_jp']) if r.get('total_jp') else 0
            r['total_hh'] = float(r['total_hh']) if r.get('total_hh') else 0
        for r in resets_history:
            r['date'] = str(r['date']) if r.get('date') else '-'
        for r in large_payouts:
            r['date'] = str(r['date']) if r.get('date') else '-'
            
        return jsonify({
            'serial': serial,
            'stats': {
                'total_in': float(stats.get('total_in') or 0),
                'total_out': float(stats.get('total_out') or 0),
                'total_jp': float(stats.get('total_jp') or 0)
            },
            'location_history': loc_history,
            'resets_history': resets_history,
            'large_payouts': large_payouts
        })
    except Exception as e:
        print(f"Error in /api/machine/{serial}/details: {e}")
        return jsonify({"error": str(e)}), 500

# ================= ONJN MODULE =================
import onjn_server
onjn_server.register_routes(app, pg_qry)

# ================= CONTRACTS MODULE =================

@app.route('/api/contracts', methods=['GET'])
def get_contracts():
    contracts_raw = pg_qry("""
        SELECT 
            c.*,
            COALESCE(
                json_agg(DISTINCT jsonb_build_object('location_id', cl.location_id, 'amount', cl.amount)) 
                FILTER (WHERE cl.location_id IS NOT NULL), '[]'
            ) as locations,
            COALESCE(
                json_agg(DISTINCT jsonb_build_object('id', cf.id, 'is_annex', cf.is_annex, 'filename', cf.filename)) 
                FILTER (WHERE cf.id IS NOT NULL), '[]'
            ) as files
        FROM cp2_contracts c
        LEFT JOIN cp2_contract_locations cl ON c.id = cl.contract_id
        LEFT JOIN cp2_contract_files cf ON c.id = cf.contract_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
    """)
    
    # Fetch all locations from SQLite to map names
    all_locs = qry("SELECT id, display_code, code FROM locations")
    loc_map = {l['id']: l.get('display_code') or l.get('code') for l in all_locs}
    
    # Format dates to string
    res = []
    for r in contracts_raw:
        r_dict = dict(r)
        if 'locations' in r_dict and isinstance(r_dict['locations'], list):
            for loc in r_dict['locations']:
                loc['name'] = loc_map.get(loc['location_id'], 'Loc necunoscut')
        if r_dict.get('start_date'):
            r_dict['start_date'] = str(r_dict['start_date'])
        if r_dict.get('end_date'):
            r_dict['end_date'] = str(r_dict['end_date'])
        if r_dict.get('created_at'):
            r_dict['created_at'] = str(r_dict['created_at'])
        if r_dict.get('updated_at'):
            r_dict['updated_at'] = str(r_dict['updated_at'])
        res.append(r_dict)
        
    return jsonify(res)

try:
    from google import genai
    from google.genai import types
    gemini_client = genai.Client() if os.environ.get("GEMINI_API_KEY") else None
except Exception as e:
    gemini_client = None
    print("Google GenAI not initialized:", e)

@app.route('/api/ai/analyze-chart', methods=['POST'])
def analyze_chart():
    data = request.json
    if not gemini_client:
        return jsonify({"success": False, "error": "GEMINI_API_KEY lipseste. Seteaza variabila de mediu GEMINI_API_KEY (export GEMINI_API_KEY='...') si reporneste serverul."}), 500
        
    title = data.get('title', 'Grafic')
    chart_data = data.get('data', [])
    
    prompt = f"""
    Acționează ca un analist financiar expert în industria de gambling/cazinouri. 
    Analizează pe scurt datele financiare/de performanță pentru graficul intitulat '{title}'.
    Datele brute în format JSON:
    {__import__('json').dumps(chart_data)}
    
    Te rog să oferi o analiză concisă, la obiect, fără emoji-uri, structurată astfel:
    1. 3 Concluzii Cheie (ce spun cifrele)
    2. Riscuri sau alerte (dacă e cazul)
    3. Oportunități
    Fii profesional, evită platitudinile și raportează-te strict la datele furnizate.
    """
    
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return jsonify({"success": True, "analysis": response.text})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/contracts/smart-import', methods=['POST'])
def smart_import_contract():
    if not gemini_client:
        return jsonify({"success": False, "error": "GEMINI_API_KEY lipseste. Seteaza variabila de mediu GEMINI_API_KEY (export GEMINI_API_KEY='...') si reporneste serverul."}), 500

    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400

    file = request.files['file']
    location_id = request.form.get('location_id')
    
    if file.filename == '':
        return jsonify({"success": False, "error": "No selected file"}), 400

    import uuid
    import json
    temp_path = os.path.join('/tmp', f"smart_{uuid.uuid4()}_{file.filename}")
    file.save(temp_path)

    try:
        gemini_file = gemini_client.files.upload(file=temp_path)
        
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
        
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[gemini_file, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        
        extracted = json.loads(response.text)
        
        contract_id = str(uuid.uuid4())
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
        
        q = '''INSERT INTO cp2_contracts (id, type, currency, total_amount, start_date, end_date, contract_number, details, owner_name, address, m2, notice_period_months)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)'''
        pg_qry(q, (contract_id, c_type, curr, amount, s_date, e_date, c_num, c_det, owner, c_addr, c_m2, c_notice))
        
        if location_id:
            pg_qry('INSERT INTO cp2_contract_locations (contract_id, location_id, amount) VALUES (%s, %s, %s)', (contract_id, location_id, amount))
            
        os.makedirs('uploads/contracts', exist_ok=True)
        file_id = str(uuid.uuid4())
        filename = secure_filename(file.filename)
        save_name = f"{file_id}_{filename}"
        final_path = os.path.join('uploads', 'contracts', save_name)
        os.rename(temp_path, final_path)
        
        pg_qry('''INSERT INTO cp2_contract_files (id, contract_id, is_annex, filename, filepath)
                      VALUES (%s, %s, %s, %s, %s)''',
                   (file_id, contract_id, False, file.filename, final_path))
        
        return jsonify({"success": True, "contract_id": contract_id, "data": extracted})
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/contracts', methods=['POST'])
def create_contract():
    data = request.json
    import uuid
    cid = str(uuid.uuid4())
    
    pg_qry("""
        INSERT INTO cp2_contracts (id, type, currency, total_amount, start_date, end_date, details, m2, notice_period_months, sublease_agreement, auto_expense, owner_name, contract_number, address, manual_location)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        cid,
        data.get('type'),
        data.get('currency', 'LEI'),
        float(data.get('total_amount', 0)),
        data.get('start_date') or None,
        data.get('end_date') or None,
        data.get('details'),
        float(data.get('m2')) if data.get('m2') else None,
        int(data.get('notice_period_months')) if data.get('notice_period_months') else None,
        str(data.get('sublease_agreement')).lower() == 'true' if data.get('sublease_agreement') is not None and data.get('sublease_agreement') != '' else None,
        str(data.get('auto_expense')).lower() == 'true',
        data.get('owner_name') or None,
        data.get('contract_number') or None,
        data.get('address') or None,
        data.get('manual_location') or None
    ))
    
    locs = data.get('locations', [])
    for loc in locs:
        pg_qry("""
            INSERT INTO cp2_contract_locations (contract_id, location_id, amount)
            VALUES (%s, %s, %s)
        """, (cid, loc.get('location_id'), float(loc.get('amount', 0))))
        
    return jsonify({"success": True, "id": cid})

@app.route('/api/contracts/<contract_id>', methods=['PUT'])
def update_contract(contract_id):
    data = request.json
    pg_qry("""
        UPDATE cp2_contracts 
        SET type = %s, currency = %s, total_amount = %s, start_date = %s, end_date = %s, details = %s, m2 = %s, notice_period_months = %s, sublease_agreement = %s, auto_expense = %s, owner_name = %s, contract_number = %s, address = %s, manual_location = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (
        data.get('type'),
        data.get('currency', 'LEI'),
        float(data.get('total_amount', 0)),
        data.get('start_date') or None,
        data.get('end_date') or None,
        data.get('details'),
        float(data.get('m2')) if data.get('m2') else None,
        int(data.get('notice_period_months')) if data.get('notice_period_months') else None,
        str(data.get('sublease_agreement')).lower() == 'true' if data.get('sublease_agreement') is not None and data.get('sublease_agreement') != '' else None,
        str(data.get('auto_expense')).lower() == 'true',
        data.get('owner_name') or None,
        data.get('contract_number') or None,
        data.get('address') or None,
        data.get('manual_location') or None,
        contract_id
    ))
    
    pg_qry("DELETE FROM cp2_contract_locations WHERE contract_id = %s", (contract_id,))
    
    locs = data.get('locations', [])
    for loc in locs:
        pg_qry("""
            INSERT INTO cp2_contract_locations (contract_id, location_id, amount)
            VALUES (%s, %s, %s)
        """, (contract_id, loc.get('location_id'), float(loc.get('amount', 0))))
        
    return jsonify({"success": True})

@app.route('/api/contracts/<contract_id>', methods=['DELETE'])
def delete_contract(contract_id):
    pg_qry("DELETE FROM cp2_contracts WHERE id = %s", (contract_id,))
    return jsonify({"success": True})

@app.route('/api/contracts/<contract_id>/files', methods=['POST'])
def upload_contract_file(contract_id):
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "Empty filename"}), 400
    
    is_annex = str(request.form.get('is_annex', 'false')).lower() == 'true'
    
    os.makedirs('uploads/contracts', exist_ok=True)
    import uuid
    fid = str(uuid.uuid4())
    # prepend fid to avoid collisions
    filename = secure_filename(file.filename)
    save_name = f"{fid}_{filename}"
    filepath = os.path.join('uploads', 'contracts', save_name)
    file.save(filepath)
    
    pg_qry("""
        INSERT INTO cp2_contract_files (id, contract_id, is_annex, filename, filepath)
        VALUES (%s, %s, %s, %s, %s)
    """, (fid, contract_id, is_annex, filename, filepath))
    
    return jsonify({"success": True})

@app.route('/api/contracts/files/<file_id>', methods=['DELETE'])
def delete_contract_file(file_id):
    rows = pg_qry("SELECT filepath FROM cp2_contract_files WHERE id = %s", (file_id,))
    if rows:
        filepath = rows[0]['filepath']
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            pass
        pg_qry("DELETE FROM cp2_contract_files WHERE id = %s", (file_id,))
    return jsonify({"success": True})

@app.route('/api/contracts/files/<file_id>/download', methods=['GET'])
def download_contract_file(file_id):
    rows = pg_qry("SELECT filename, filepath FROM cp2_contract_files WHERE id = %s", (file_id,))
    if not rows: return "File not found", 404
    
    fpath = rows[0]['filepath']
    import os
    if not os.path.exists(fpath): return "File not found on disk", 404
    
    directory = os.path.dirname(os.path.abspath(fpath))
    fname = os.path.basename(fpath)
    return send_from_directory(directory, fname, as_attachment=False)



if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5050))
    print(f" CyberSlot Analytics Dashboard → listening on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
