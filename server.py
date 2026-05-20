from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import pymysql, os, requests as req_lib, xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import cp2_db
import sqlite3
import hashlib
import secrets
import json
from werkzeug.utils import secure_filename

cp2_db.init_db()

def require_auth():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token: return None
    conn = cp2_db.get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE token=?", (token,))
    user = c.fetchone()
    conn.close()
    return user

def dict_from_row(row):
    return dict(zip(row.keys(), row))

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
    locs_raw = qry("SELECT id, COALESCE(display_code, code) AS name, city FROM locations WHERE deleted_at IS NULL ORDER BY city, id")
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
            SUM(bet) as bet
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

    return jsonify(
        data_start=str(row.get('data_start','') or ''),
        data_end  =str(row.get('data_end','') or ''),
        nr_zile=days, aparate=ap, locatii=int(row.get('locatii') or 0),
        total_in=tin, total_out=tout,
        ggr=ggr, ggr_eur=round(ggr/EUR_RATE,2),
        ngr=ngr, ngr_eur=round(ngr/EUR_RATE,2),
        jackpot=jp, hh=hh, cashback=cb,
        games=games, bet=bet,
        hold_pct=round(ggr/tin*100,2) if tin else 0,
        ngr_pct =round(ngr/tin*100,2) if tin else 0,
        avg_in_zi   =round(tin/days,2),
        avg_ggr_zi  =round(ggr/days,2),
        avg_ngr_zi  =round(ngr/days,2),
        avg_in_ap_zi=round(tin/(days*ap),2),
        avg_bet_game=round(bet/games,4) if games else 0,
        avg_games_zi=round(games/days,2),
    )

# ─── Trend lunar ────────────────────────────────────────────────────────────
@app.route('/api/trend')
def trend():
    start, end = period_params(request)
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
            COUNT(DISTINCT date) as zile
        FROM {table} mas
        WHERE {where_date}
    """ + lf + f"""
        GROUP BY DATE_FORMAT(mas.date,'{date_format}')
        ORDER BY luna ASC
    """, [start_dt, end_dt] + lp)
    return jsonify(rows)

# ─── Per Locație ─────────────────────────────────────────────────────────────
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

    # Get distinct card players per location
    card_players = qry("""
        SELECT location_id, COUNT(DISTINCT player_id) as card_players
        FROM player_card_logs
        WHERE created_at >= %s AND created_at <= %s + INTERVAL 1 DAY
        GROUP BY location_id
    """, [start, end])
    cp_map = {r['location_id']: r['card_players'] for r in card_players}

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
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cb_real,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)+COALESCE(mas.cb_fortune_wheel,0)+COALESCE(mas.cb_raffle,0)) AS marketing
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
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cb_real,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)+COALESCE(mas.cb_fortune_wheel,0)+COALESCE(mas.cb_raffle,0)) AS marketing
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
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cb_real,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)) AS marketing
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
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cb_real,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)) AS marketing
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

    filters = ["mas.date >= %s AND mas.date <= %s AND mas.`in` > 0"]
    params  = [start, end]
    if loc_id and loc_id != 'all':
        try:
            lid = int(loc_id)
            all_ids = LOC_CHILDREN.get(lid, [lid])
            ph = ','.join(['%s'] * len(all_ids))
            filters.append(f"mas.location_id IN ({ph})")
            params.extend(all_ids)
        except:
            filters.append("mas.location_id = %s"); params.append(loc_id)
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
            SUM(COALESCE(mas.cb_real,0))   AS cb_real,
            SUM(COALESCE(mas.cb_birthday,0)) AS cb_birthday,
            SUM(COALESCE(mas.cashback,0))  AS cashback,
            SUM(COALESCE(mas.jackpot,0)+COALESCE(mas.cb_real,0)+COALESCE(mas.hh,0)+COALESCE(mas.cb_birthday,0)) AS marketing,
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
            r = req_lib.get('https://www.bnr.ro/nbrfxrates.xml', timeout=5)
            tree = ET.fromstring(r.content)
            ns = {'ns': 'http://www.bnr.ro/xsd'}
            for rate in tree.findall('.//ns:Rate', ns):
                if rate.get('currency') == 'EUR':
                    _bnr_cache['rate'] = float(rate.text)
                    _bnr_cache['date'] = today
                    break
        except:
            pass
    return jsonify(rate=_bnr_cache['rate'], date=_bnr_cache['date'])

# ─── Serve frontend ──────────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/style.css')
def serve_css():
    return send_from_directory(BASE_DIR, 'style.css')

@app.route('/app.js')
def serve_app_js():
    return send_from_directory(BASE_DIR, 'app.js')

@app.route('/game_uuids.js')
def serve_game_uuids_js():
    return send_from_directory(BASE_DIR, 'game_uuids.js')

@app.route('/slot_icon.png')
def serve_img():
    return send_from_directory(BASE_DIR, 'slot_icon.png')

@app.route('/logo_cashpot.png')
def serve_logo():
    return send_from_directory(BASE_DIR, 'logo_cashpot.png')

# ─── Raport pe Ore ────────────────────────────────────────────────────────────
@app.route('/api/reports/hourly')
def reports_hourly():
    start, end = period_params(request)
    lf, lp = loc_filter(request)
    
    prov_id = request.args.get('prov_id', '')
    if prov_id:
        lf += " AND mas.machine_type_id = %s "
        lp.append(prov_id)
        
    end_dt = end + ' 23:59:59'
    
    rows = qry("""
        SELECT
            mas.date as dt,
            mas.location_id,
            REPLACE(REPLACE(COALESCE(l.display_code, l.code), ' E.S', ''), 'E.S', '') as locatie,
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
        WHERE mas.date >= %s AND mas.date <= %s AND mas.`in` > 0
    """ + lf + """
        ORDER BY mas.date DESC, mas.`in` DESC
    """, [start, end_dt] + lp)
    
    # Apply canonical location names
    for r in rows:
        if r.get('dt'):
            r['dt'] = str(r['dt'])
        r['locatie'] = LOC_NAMES.get(r.get('location_id'), r.get('locatie', '—'))
        
    return jsonify(rows)

@app.route('/api/reports/hourly_machine_games')
def hourly_machine_games():
    serial = request.args.get('serial')
    dt = request.args.get('dt') # YYYY-MM-DD HH:MM
    if not serial or not dt: return jsonify([])
    
    dt_start = dt + ':00'
    from datetime import datetime, timedelta
    try:
        dt_end = (datetime.strptime(dt_start, '%Y-%m-%d %H:%M:%S') + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
    except: return jsonify([])

    rows = qry("""
        SELECT
            mg.id as game_id,
            COALESCE(NULLIF(mg.name, ''), NULLIF(mgs.sas_game_name, ''), 'Necunoscut') as game_name,
            ROUND(SUM(mgs.c_52_bet)   / 100, 0) as bet,
            ROUND(SUM(mgs.c_52_win)   / 100, 0) as win,
            ROUND(SUM(mgs.c_52_jackpot)/100, 0) as jp,
            SUM(mgs.c_52_games)                  as games,
            ROUND((SUM(mgs.c_52_bet) - SUM(mgs.c_52_win)) / 100, 0) as ggr
        FROM machine_audit_games_g_s mgs
        JOIN machines m ON mgs.machine_id = m.id
        LEFT JOIN machine_games mg ON mgs.machine_game_id = mg.id
        WHERE m.slot_machine_id = %s
          AND mgs.created_at >= %s AND mgs.created_at < %s
          AND mgs.c_52_bet > 0
        GROUP BY mg.id, COALESCE(mg.name, mgs.sas_game_name)
        ORDER BY bet DESC
    """, [serial, dt_start, dt_end])
    return jsonify(rows)

# ─── Live Monitor ────────────────────────────────────────────────────────────

@app.route('/api/reports/day_smart')
def day_smart():
    start, end = period_params(request)
    lf, lp = loc_filter(request, alias='pcl')
    
    # 1. Card players
    p_count = qry(f"SELECT COUNT(DISTINCT player_id) as c FROM player_card_logs pcl WHERE pcl.created_at >= %s AND pcl.created_at <= %s {lf}", [start, end] + lp)[0]['c']
    
    # 2. Jackpots (alias pjh)
    lf_pjh, lp_pjh = loc_filter(request, alias='pjh')
    jp_val = qry(f"SELECT SUM(hit_value) as s FROM player_jackpot_histories pjh WHERE pjh.hit_date >= %s AND pjh.hit_date <= %s {lf_pjh}", [start, end] + lp_pjh)[0]['s'] or 0
    
    # 3. Wheel (no location)
    wh_val = qry(f"SELECT SUM(amount) as s FROM player_fortune_wheel_transactions WHERE created_at >= %s AND created_at <= %s", [start, end])[0]['s'] or 0
    
    # 4. Cashback (no location)
    cb_val = qry(f"SELECT SUM(amount) as s FROM player_cashback_in_outs WHERE created_at >= %s AND created_at <= %s", [start, end])[0]['s'] or 0
    
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
            WHERE pcl.location_id = %s AND pcl.created_at >= DATE_SUB(%s, INTERVAL 7 DAY) AND pcl.created_at < %s AND pcl.log_type = 2
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
            return f"{fn} {ln[0]}." if ln else fn

        loc_insights.append({
            'locatie': l_name,
            'fidel': [fmt_name(c) for c in fidel[:3]], 'fidel_count': len(fidel),
            'nou': [fmt_name(c) for c in nou[:3]], 'nou_count': len(nou),
            'lipsa': [fmt_name(c) for c in lipsa[:3]], 'lipsa_count': len(lipsa)
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
                mg.id as game_id,
                COALESCE(NULLIF(mg.name, ''), NULLIF(mgs.sas_game_name, ''), 'Necunoscut') as game_name,
                COUNT(DISTINCT mgs.machine_id)       as aparate,
                ROUND(SUM(mgs.c_52_bet)   / 100, 0) as total_bet,
                ROUND(SUM(mgs.c_52_win)   / 100, 0) as total_win,
                ROUND(SUM(mgs.c_52_jackpot)/100, 0) as total_jp,
                SUM(mgs.c_52_games)                  as total_games,
                ROUND((SUM(mgs.c_52_bet) - SUM(mgs.c_52_win)) / 100, 0) as ggr,
                ROUND(
                    CASE WHEN SUM(mgs.c_52_bet) > 0
                    THEN (1 - SUM(mgs.c_52_win)/SUM(mgs.c_52_bet))*100
                    ELSE NULL END, 2
                ) as house_edge_pct,
                ROUND(
                    CASE WHEN SUM(mgs.c_52_games) > 0
                    THEN SUM(mgs.c_52_bet) / SUM(mgs.c_52_games) / 100
                    ELSE NULL END, 3
                ) as avg_bet_per_game
            FROM machine_audit_games_g_s mgs
            LEFT JOIN machine_games mg ON mgs.machine_game_id = mg.id
            WHERE mgs.created_at >= %s AND mgs.created_at < %s
        """ + loc_where + """
            GROUP BY mg.id, COALESCE(mg.name, mgs.sas_game_name)
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
                MAX(mgs.machine_game_id) as game_id,
                COUNT(DISTINCT mgs.machine_id) as aparate,
                ROUND(SUM(mgs.c_52_bet) / 100, 0) as total_bet,
                ROUND(SUM(mgs.c_52_win) / 100, 0) as total_win,
                SUM(mgs.c_52_games) as total_games,
                ROUND((SUM(mgs.c_52_bet) - SUM(mgs.c_52_win)) / 100, 0) as ggr,
                ROUND(
                    CASE WHEN SUM(mgs.c_52_bet) > 0
                    THEN (1 - SUM(mgs.c_52_win)/SUM(mgs.c_52_bet))*100
                    ELSE NULL END, 2
                ) as house_edge_pct
            FROM machine_audit_games_g_s mgs
            WHERE ({gids_sql} OR mgs.sas_game_name = %s)
              AND mgs.created_at >= %s AND mgs.created_at < %s
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


@app.route('/api/players/<int:pid>')
def api_player_details(pid):
    # Base info
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
    rows = qry('''
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
    ''' + lf + '''
        GROUP BY p.id, p.first_name, p.last_name, p.phone, p.points, p.total_bets, p.avg_bet, l.display_code, l.code
        ORDER BY total_interactiuni DESC
        LIMIT 500
    ''', [start, end_dt, start, end, start, start, start, end_dt] + lp)
    
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
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE email=? AND password_hash=?", (email, pwd_hash))
    user = c.fetchone()
    if user:
        token = secrets.token_hex(32)
        c.execute("UPDATE users SET token=? WHERE id=?", (token, user['id']))
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
        c = conn.cursor()
        c.execute("UPDATE users SET token=NULL WHERE token=?", (token,))
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
    c = conn.cursor()
    c.execute('SELECT permissions FROM users WHERE id = ?', (user['id'],))
    row = c.fetchone()
    if row:
        import json
        try: perms = json.loads(row['permissions'] or '{}')
        except: perms = {}
        perms['theme'] = new_theme
        c.execute('UPDATE users SET permissions = ? WHERE id = ?', (json.dumps(perms), user['id']))
        conn.commit()
    conn.close()
    return jsonify({'success': True})

# ─── Users CRUD ─────────────────────────────────────────────────────────────
@app.route('/api/users', methods=['GET'])
def get_users():
    user = require_auth()
    if not user or user['role'] != 'Super Admin': return jsonify({"error": "Unauthorized"}), 401
    conn = cp2_db.get_db()
    c = conn.cursor()
    c.execute("SELECT id, name, email, role, phone, permissions FROM users")
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
    c = conn.cursor()
    try:
        c.execute('''INSERT INTO users (name, email, password_hash, role, phone, permissions)
                     VALUES (?, ?, ?, ?, ?, ?)''',
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
        permissions = data.get('permissions')
        
        try:
            conn = cp2_db.get_db()
            c = conn.cursor()
            c.execute("UPDATE users SET name=?, email=?, phone=?, permissions=? WHERE id=?", (name, email, phone, permissions, uid))
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
        c = conn.cursor()
        c.execute("DELETE FROM users WHERE id=?", (uid,))
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
            c.execute('''SELECT machine_id, MAX(datetime) as last_ram_clear 
                         FROM machine_resets WHERE reset_type = 0 GROUP BY machine_id''')
            resets = {r['machine_id']: r['last_ram_clear'].strftime('%Y-%m-%d') for r in c.fetchall() if r['last_ram_clear']}
            
            # Get machines data
            c.execute('''
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
            ''')
            machines = c.fetchall()
            
            # Calculate hold pct (all time)
            c.execute('''
                SELECT machine_id, SUM(`in`) as tot_in, SUM(`in` - `out`) as ggr 
                FROM machine_audit_summaries GROUP BY machine_id
            ''')
            hold_pcts = {}
            for r in c.fetchall():
                if r['tot_in'] and r['tot_in'] > 0:
                    hold_pcts[r['machine_id']] = round(r['ggr'] / r['tot_in'] * 100, 2)
                    
        # Get notes and files from local DB
        c2 = cp_conn.cursor()
        c2.execute("SELECT machine_id, note, created_at FROM slot_notes ORDER BY created_at DESC")
        notes_map = {}
        for row in c2.fetchall():
            mid = row['machine_id']
            if mid not in notes_map: notes_map[mid] = []
            notes_map[mid].append(dict_from_row(row))
            
        c2.execute("SELECT machine_id, filename, filepath, created_at FROM slot_files ORDER BY created_at DESC")
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
    c = conn.cursor()
    c.execute("INSERT INTO slot_notes (machine_id, note) VALUES (?, ?)", (mid, note))
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
    c = conn.cursor()
    c.execute("INSERT INTO slot_files (machine_id, filename, filepath) VALUES (?, ?, ?)", 
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
    c = conn.cursor()
    # Ensure invitations table has permissions column
    try:
        c.execute('ALTER TABLE invitations ADD COLUMN permissions TEXT')
    except:
        pass
    c.execute("INSERT INTO invitations (code, email, role, permissions) VALUES (?, ?, ?, ?)", (code, email, role, permissions))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "code": code})

@app.route('/api/invitations', methods=['GET'])
def list_invitations():
    user = require_auth()
    if not user or user['role'] != 'Super Admin': return jsonify({"error": "Unauthorized"}), 401
    conn = cp2_db.get_db()
    c = conn.cursor()
    c.execute("SELECT code, email, role, permissions, created_at FROM invitations")
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
    c = conn.cursor()
    
    if request.method == 'DELETE':
        c.execute("DELETE FROM invitations WHERE code = ?", (code,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
        
    c.execute("SELECT * FROM invitations WHERE code=? AND used=0", (code,))
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
    c = conn.cursor()
    c.execute("SELECT * FROM invitations WHERE code=? AND used=0", (code,))
    inv = c.fetchone()
    if not inv:
        conn.close()
        return jsonify({"error": "Cod invalid sau expirat"}), 400
    
    pwd_hash = hashlib.sha256(password.encode()).hexdigest()
    try:
        perms = inv['permissions'] if 'permissions' in inv.keys() and inv['permissions'] else '{}'
        c.execute("INSERT INTO users (name, email, phone, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?)",
                  (name, inv['email'], phone, pwd_hash, inv['role'], perms))
        c.execute("UPDATE invitations SET used=1 WHERE id=?", (inv['id'],))
        conn.commit()
        success = True
    except sqlite3.IntegrityError:
        success = False
    conn.close()
    
    if not success: return jsonify({"error": "Email-ul exista deja"}), 400
    return jsonify({"success": True})

if __name__ == '__main__':
    print(" CyberSlot Analytics Dashboard → http://localhost:5050")
    app.run(host='0.0.0.0', port=5050, debug=False)
