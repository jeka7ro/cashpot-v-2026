from flask import jsonify, request
import os
import uuid
from werkzeug.utils import secure_filename

def register_routes(app, pg_qry):
    
    # ------------------ COMMISSIONS ------------------
    @app.route('/api/onjn/commissions', methods=['GET'])
    def get_commissions():
        rows = pg_qry("""
            SELECT c.*, 
                   (SELECT COUNT(*) FROM cp2_onjn_decisions d WHERE d.commission_id = c.id) as decisions_count
            FROM cp2_onjn_commissions c 
            ORDER BY c.date DESC
        """)
        for r in rows:
            r['date'] = str(r['date']) if r['date'] else None
            r['created_at'] = str(r['created_at']) if r['created_at'] else None
        return jsonify(rows)

    @app.route('/api/onjn/commissions', methods=['POST'])
    def create_commission():
        data = request.json
        if not data or not data.get('date'):
            return jsonify({"error": "Data comisiei este obligatorie"}), 400
        
        cid = str(uuid.uuid4())
        pg_qry("INSERT INTO cp2_onjn_commissions (id, date) VALUES (%s, %s)", (cid, data['date']))
        return jsonify({"success": True, "id": cid})

    @app.route('/api/onjn/commissions/<cid>', methods=['DELETE'])
    def delete_commission(cid):
        pg_qry("DELETE FROM cp2_onjn_commissions WHERE id = %s", (cid,))
        return jsonify({"success": True})

    # ------------------ DECISIONS ------------------
    @app.route('/api/onjn/decisions', methods=['GET'])
    def get_decisions():
        rows = pg_qry("""
            SELECT d.*, c.date as commission_date,
                   COALESCE(
                       json_agg(DISTINCT ds.slot_machine_id) FILTER (WHERE ds.slot_machine_id IS NOT NULL), '[]'
                   ) as slots
            FROM cp2_onjn_decisions d
            LEFT JOIN cp2_onjn_commissions c ON d.commission_id = c.id
            LEFT JOIN cp2_onjn_decision_slots ds ON d.id = ds.decision_id
            GROUP BY d.id, c.date
            ORDER BY d.decision_date DESC NULLS LAST
        """)
        for r in rows:
            r['decision_date'] = str(r['decision_date']) if r['decision_date'] else None
            r['commission_date'] = str(r['commission_date']) if r['commission_date'] else None
            r['created_at'] = str(r['created_at']) if r['created_at'] else None
        return jsonify(rows)

    @app.route('/api/onjn/decisions', methods=['POST'])
    def create_decision():
        data = request.json
        did = str(uuid.uuid4())
        pg_qry("""
            INSERT INTO cp2_onjn_decisions 
            (id, commission_id, decision_number, decision_date, type, total_slots, location_id, location_id_dest, status) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            did, data.get('commission_id'), data.get('decision_number'), data.get('decision_date') or None, 
            data.get('type'), data.get('total_slots', 0), data.get('location_id'), 
            data.get('location_id_dest'), data.get('status')
        ))
        
        slots = data.get('slots', [])
        for s in slots:
            pg_qry("INSERT INTO cp2_onjn_decision_slots (decision_id, slot_machine_id) VALUES (%s, %s)", (did, str(s)))
            
        return jsonify({"success": True, "id": did})

    @app.route('/api/onjn/decisions/<did>', methods=['PUT'])
    def update_decision(did):
        data = request.json
        pg_qry("""
            UPDATE cp2_onjn_decisions SET 
                commission_id = %s, decision_number = %s, decision_date = %s, 
                type = %s, total_slots = %s, location_id = %s, location_id_dest = %s, status = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (
            data.get('commission_id'), data.get('decision_number'), data.get('decision_date') or None, 
            data.get('type'), data.get('total_slots', 0), data.get('location_id'), 
            data.get('location_id_dest'), data.get('status'), did
        ))
        
        pg_qry("DELETE FROM cp2_onjn_decision_slots WHERE decision_id = %s", (did,))
        slots = data.get('slots', [])
        for s in slots:
            pg_qry("INSERT INTO cp2_onjn_decision_slots (decision_id, slot_machine_id) VALUES (%s, %s)", (did, str(s)))
            
        return jsonify({"success": True})

    @app.route('/api/onjn/decisions/<did>', methods=['DELETE'])
    def delete_decision(did):
        pg_qry("DELETE FROM cp2_onjn_decisions WHERE id = %s", (did,))
        return jsonify({"success": True})

    # ------------------ NOTIFICATIONS ------------------
    @app.route('/api/onjn/notifications', methods=['GET'])
    def get_notifications():
        rows = pg_qry("""
            SELECT n.*,
                   COALESCE(json_agg(DISTINCT nr.related_id) FILTER (WHERE nr.related_type = 'slot'), '[]') as slots,
                   COALESCE(json_agg(DISTINCT nr.related_id) FILTER (WHERE nr.related_type = 'location'), '[]') as locations
            FROM cp2_onjn_notifications n
            LEFT JOIN cp2_onjn_notification_relations nr ON n.id = nr.notification_id
            GROUP BY n.id
            ORDER BY n.date DESC NULLS LAST
        """)
        for r in rows:
            r['date'] = str(r['date']) if r['date'] else None
            r['transmission_date'] = str(r['transmission_date']) if r['transmission_date'] else None
        return jsonify(rows)

    @app.route('/api/onjn/notifications', methods=['POST'])
    def create_notification():
        data = request.json
        nid = str(uuid.uuid4())
        pg_qry("""
            INSERT INTO cp2_onjn_notifications 
            (id, level, type, notification_number, date, transmission_date, status, observations) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            nid, data.get('level'), data.get('type'), data.get('notification_number'), 
            data.get('date') or None, data.get('transmission_date') or None, 
            data.get('status'), data.get('observations')
        ))
        
        for s in data.get('slots', []):
            pg_qry("INSERT INTO cp2_onjn_notification_relations (notification_id, related_type, related_id) VALUES (%s, %s, %s)", (nid, 'slot', str(s)))
        for l in data.get('locations', []):
            pg_qry("INSERT INTO cp2_onjn_notification_relations (notification_id, related_type, related_id) VALUES (%s, %s, %s)", (nid, 'location', str(l)))
            
        return jsonify({"success": True, "id": nid})

    @app.route('/api/onjn/notifications/<nid>', methods=['DELETE'])
    def delete_notification(nid):
        pg_qry("DELETE FROM cp2_onjn_notifications WHERE id = %s", (nid,))
        return jsonify({"success": True})

    # ------------------ CONTROLS & MEASURES ------------------
    @app.route('/api/onjn/controls', methods=['GET'])
    def get_controls():
        rows = pg_qry("""
            SELECT c.*,
                   COALESCE(
                       json_agg(jsonb_build_object('id', m.id, 'description', m.description, 'deadline', m.deadline, 'responsible', m.responsible, 'status', m.status)) 
                       FILTER (WHERE m.id IS NOT NULL), '[]'
                   ) as measures
            FROM cp2_onjn_controls c
            LEFT JOIN cp2_onjn_control_measures m ON c.id = m.control_id
            GROUP BY c.id
            ORDER BY c.pv_date DESC NULLS LAST
        """)
        for r in rows:
            r['pv_date'] = str(r['pv_date']) if r['pv_date'] else None
            r['close_date'] = str(r['close_date']) if r['close_date'] else None
            for m in r['measures']:
                m['deadline'] = str(m['deadline']) if m['deadline'] else None
        return jsonify(rows)

    @app.route('/api/onjn/controls', methods=['POST'])
    def create_control():
        data = request.json
        cid = str(uuid.uuid4())
        pg_qry("""
            INSERT INTO cp2_onjn_controls (id, pv_number, pv_date, status, close_date) 
            VALUES (%s, %s, %s, %s, %s)
        """, (cid, data.get('pv_number'), data.get('pv_date') or None, data.get('status', 'Deschis'), data.get('close_date') or None))
        
        for m in data.get('measures', []):
            pg_qry("""
                INSERT INTO cp2_onjn_control_measures (id, control_id, description, deadline, responsible, status)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (str(uuid.uuid4()), cid, m.get('description'), m.get('deadline') or None, m.get('responsible'), m.get('status')))
            
        return jsonify({"success": True, "id": cid})

    @app.route('/api/onjn/controls/<cid>', methods=['DELETE'])
    def delete_control(cid):
        pg_qry("DELETE FROM cp2_onjn_controls WHERE id = %s", (cid,))
        return jsonify({"success": True})

    # ------------------ CORRESPONDENCE ------------------
    @app.route('/api/onjn/correspondence', methods=['GET'])
    def get_correspondence():
        rows = pg_qry("SELECT * FROM cp2_onjn_correspondence ORDER BY date DESC NULLS LAST")
        for r in rows:
            r['date'] = str(r['date']) if r['date'] else None
        return jsonify(rows)

    @app.route('/api/onjn/correspondence', methods=['POST'])
    def create_correspondence():
        data = request.json
        cid = str(uuid.uuid4())
        pg_qry("""
            INSERT INTO cp2_onjn_correspondence (id, type, date, subject, related_entity_type, related_entity_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (cid, data.get('type'), data.get('date') or None, data.get('subject'), data.get('related_entity_type'), data.get('related_entity_id')))
        return jsonify({"success": True, "id": cid})
        
    @app.route('/api/onjn/correspondence/<cid>', methods=['DELETE'])
    def delete_correspondence(cid):
        pg_qry("DELETE FROM cp2_onjn_correspondence WHERE id = %s", (cid,))
        return jsonify({"success": True})

    # ------------------ DOCUMENTS (Global) ------------------
    @app.route('/api/onjn/documents/<entity_type>/<entity_id>', methods=['GET'])
    def get_documents(entity_type, entity_id):
        rows = pg_qry("SELECT id, document_type, filename FROM cp2_onjn_documents WHERE entity_type = %s AND entity_id = %s ORDER BY created_at ASC", (entity_type, entity_id))
        return jsonify(rows)

    @app.route('/api/onjn/documents/<entity_type>/<entity_id>', methods=['POST'])
    def upload_document(entity_type, entity_id):
        if 'file' not in request.files: return jsonify({"error": "No file"}), 400
        file = request.files['file']
        if file.filename == '': return jsonify({"error": "Empty filename"}), 400
        
        doc_type = request.form.get('document_type', 'PDF')
        
        os.makedirs('uploads/onjn', exist_ok=True)
        did = str(uuid.uuid4())
        filename = secure_filename(file.filename)
        save_name = f"{did}_{filename}"
        filepath = os.path.join('uploads', 'onjn', save_name)
        file.save(filepath)
        
        pg_qry("""
            INSERT INTO cp2_onjn_documents (id, entity_type, entity_id, document_type, filename, filepath)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (did, entity_type, entity_id, doc_type, filename, filepath))
        
        return jsonify({"success": True, "id": did})

    @app.route('/api/onjn/documents/<did>', methods=['DELETE'])
    def delete_document(did):
        doc = pg_qry("SELECT filepath FROM cp2_onjn_documents WHERE id = %s", (did,))
        if doc:
            try:
                os.remove(doc[0]['filepath'])
            except: pass
        pg_qry("DELETE FROM cp2_onjn_documents WHERE id = %s", (did,))
        return jsonify({"success": True})

    # ------------------ SLOT HISTORY ------------------
    @app.route('/api/onjn/slots/<slot_id>/history', methods=['GET'])
    def get_slot_history(slot_id):
        # 1. Decisions
        decisions = pg_qry("""
            SELECT d.*, c.date as commission_date 
            FROM cp2_onjn_decision_slots ds 
            JOIN cp2_onjn_decisions d ON ds.decision_id = d.id 
            LEFT JOIN cp2_onjn_commissions c ON d.commission_id = c.id
            WHERE ds.slot_machine_id = %s
        """, (slot_id,))
        for d in decisions:
            d['history_event_type'] = 'decision'
            d['sort_date'] = str(d['decision_date'] or d['created_at'])
            d['decision_date'] = str(d['decision_date']) if d['decision_date'] else None
            d['commission_date'] = str(d['commission_date']) if d['commission_date'] else None
            
        # 2. Notifications
        notifications = pg_qry("""
            SELECT n.* 
            FROM cp2_onjn_notification_relations nr 
            JOIN cp2_onjn_notifications n ON nr.notification_id = n.id 
            WHERE nr.related_type = 'slot' AND nr.related_id = %s
        """, (slot_id,))
        for n in notifications:
            n['history_event_type'] = 'notification'
            n['sort_date'] = str(n['date'] or n['created_at'])
            n['date'] = str(n['date']) if n['date'] else None
            n['transmission_date'] = str(n['transmission_date']) if n['transmission_date'] else None
            
        history = decisions + notifications
        history.sort(key=lambda x: x['sort_date'], reverse=True)
        return jsonify(history)

