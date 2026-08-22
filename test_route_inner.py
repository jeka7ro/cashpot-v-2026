from server import app, cp2_db
import psycopg2.extras
import json

with app.app_context():
    conn = cp2_db.get_db()
    c = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    serial = "130695"
    
    # Basic Info & Location History
    c.execute("""
        SELECT m.id, m.location_id, l.display_code as location_name, m.created_at, m.deleted_at
        FROM machines m
        JOIN locations l ON m.location_id = l.id
        WHERE m.slot_machine_id = %s
        ORDER BY m.created_at DESC
    """, [serial])
    loc_history = c.fetchall()
    print("loc_history ok")
    
    # Resets History
    c.execute("""
        SELECT mr.datetime as date, mr.reset_type, l.display_code as location_name
        FROM machine_resets mr
        JOIN machines m ON mr.machine_id = m.id
        JOIN locations l ON m.location_id = l.id
        WHERE m.slot_machine_id = %s AND mr.reset_type = 0
        ORDER BY mr.datetime DESC
    """, [serial])
    resets_history = c.fetchall()
    print("resets_history ok")
    
    # Large Payouts (> 1000)
    c.execute("""
        SELECT mas.date, mas."out", mas.jackpot, mas.hh, l.display_code as location_name
        FROM machine_audit_summaries mas
        JOIN machines m ON mas.machine_id = m.id
        JOIN locations l ON m.location_id = l.id
        WHERE m.slot_machine_id = %s 
          AND (mas."out" >= 1000 OR mas.jackpot >= 1000 OR mas.hh >= 1000)
        ORDER BY mas.date DESC
    """, [serial])
    large_payouts = c.fetchall()
    print("large_payouts ok")
    
    # Extra stats: total lifetime GGR across all locations
    c.execute("""
        SELECT 
            SUM(mas."in") as total_in, 
            SUM(mas."out") as total_out, 
            SUM(mas.jackpot) as total_jp
        FROM machine_audit_summaries mas
        JOIN machines m ON mas.machine_id = m.id
        WHERE m.slot_machine_id = %s
    """, [serial])
    stats = c.fetchone() or {}
    print(stats)
