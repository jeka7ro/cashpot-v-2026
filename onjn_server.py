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
        pg_qry("INSERT INTO cp2_onjn_commissions (id, date, type) VALUES (%s, %s, %s)", (cid, data['date'], data.get('type')))
        return jsonify({"success": True, "id": cid})

    @app.route('/api/onjn/commissions/<cid>', methods=['DELETE'])
    def delete_commission(cid):
        pg_qry("DELETE FROM cp2_onjn_commissions WHERE id = %s", (cid,))
        return jsonify({"success": True})

    # ------------------ DECISIONS ------------------
    @app.route('/api/onjn/decisions', methods=['GET'])
    def get_decisions():
        rows = pg_qry("""
            SELECT d.*, c.date as commission_date, c.type as commission_type,
                   COALESCE((
                       SELECT json_agg(
                           jsonb_build_object(
                               'slot_machine_id', s.slot_machine_id,
                               'producator', s.producator,
                               'tip_joc', s.tip_joc,
                               'an_fab', s.an_fab,
                               'locatia', s.locatia,
                               'nr_post', s.nr_post
                           )
                       )
                       FROM cp2_onjn_decision_slots s
                       WHERE s.decision_id = d.id
                   ), '[]'::json) as slots_details,
                   COALESCE((
                       SELECT json_agg(s.slot_machine_id)
                       FROM cp2_onjn_decision_slots s
                       WHERE s.decision_id = d.id
                   ), '[]'::json) as slots,
                   COALESCE((
                       SELECT json_agg(l.location_id)
                       FROM cp2_onjn_decision_locations l
                       WHERE l.decision_id = d.id
                   ), '[]'::json) as location_ids
            FROM cp2_onjn_decisions d
            LEFT JOIN cp2_onjn_commissions c ON d.commission_id = c.id
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
        def parse_int(v):
            try: return int(v)
            except: return None

        excel_data = data.get('excel_data', [])
        slots = data.get('slots', [])
        calc_total = parse_int(data.get('total_slots')) or (len(excel_data) if excel_data else len(slots)) or 0

        commission_date = data.get('commission_date')
        commission_id = data.get('commission_id')
        if commission_date and not commission_id:
            c = pg_qry("SELECT id FROM cp2_onjn_commissions WHERE date = %s LIMIT 1", (commission_date,))
            if c:
                commission_id = c[0]['id']
            else:
                commission_id = str(uuid.uuid4())
                pg_qry("INSERT INTO cp2_onjn_commissions (id, date) VALUES (%s, %s)", (commission_id, commission_date))

        pg_qry("""
            INSERT INTO cp2_onjn_decisions 
            (id, commission_id, decision_number, decision_date, type, total_slots, location_id, location_id_dest, status) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            did, commission_id, data.get('decision_number'), data.get('decision_date') or None, 
            data.get('type'), calc_total, parse_int(data.get('location_id')), 
            parse_int(data.get('location_id_dest')), data.get('status')
        ))
        
        if excel_data:
            for row in excel_data:
                serie = str(row.get('serie') or row.get('slot_machine_id') or row.get('Serie ap.') or row.get('Serie') or '').strip()
                producator = str(row.get('producator') or row.get('Producator') or row.get('Producător') or '').strip()
                tip_joc = str(row.get('tip_joc') or row.get('Tip Joc') or '').strip()
                an_fab = str(row.get('an_fab') or row.get('An Fab') or row.get('An Fab.') or '').strip()
                locatia = str(row.get('locatia') or row.get('Locatia') or row.get('Locația') or '').strip()
                nr_post = str(row.get('nr_post') or row.get('Nr. Post') or row.get('Nr Post') or '1').strip()
                if serie:
                    pg_qry("""
                        INSERT INTO cp2_onjn_decision_slots 
                        (decision_id, slot_machine_id, producator, tip_joc, an_fab, locatia, nr_post) 
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (did, serie, producator, tip_joc, an_fab, locatia, nr_post))
        else:
            for s in slots:
                pg_qry("INSERT INTO cp2_onjn_decision_slots (decision_id, slot_machine_id) VALUES (%s, %s)", (did, str(s)))
            
        location_ids = data.get('location_ids', [])
        for loc in location_ids:
            if parse_int(loc) is not None:
                pg_qry("INSERT INTO cp2_onjn_decision_locations (decision_id, location_id) VALUES (%s, %s)", (did, parse_int(loc)))
            
        return jsonify({"success": True, "id": did})

    @app.route('/api/onjn/decisions/<did>', methods=['PUT'])
    def update_decision(did):
        data = request.json
        def parse_int(v):
            try: return int(v)
            except: return None

        excel_data = data.get('excel_data', [])
        slots = data.get('slots', [])
        calc_total = parse_int(data.get('total_slots')) or (len(excel_data) if excel_data else len(slots)) or 0

        commission_date = data.get('commission_date')
        commission_id = data.get('commission_id')
        if commission_date and not commission_id:
            c = pg_qry("SELECT id FROM cp2_onjn_commissions WHERE date = %s LIMIT 1", (commission_date,))
            if c:
                commission_id = c[0]['id']
            else:
                commission_id = str(uuid.uuid4())
                pg_qry("INSERT INTO cp2_onjn_commissions (id, date) VALUES (%s, %s)", (commission_id, commission_date))

        pg_qry("""
            UPDATE cp2_onjn_decisions 
            SET commission_id = %s, decision_number = %s, decision_date = %s, type = %s, 
                total_slots = %s, location_id = %s, location_id_dest = %s, status = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (
            commission_id, data.get('decision_number'), data.get('decision_date') or None, 
            data.get('type'), calc_total, parse_int(data.get('location_id')), 
            parse_int(data.get('location_id_dest')), data.get('status'), did
        ))
        
        pg_qry("DELETE FROM cp2_onjn_decision_slots WHERE decision_id = %s", (did,))
        if excel_data:
            for row in excel_data:
                serie = str(row.get('serie') or row.get('slot_machine_id') or row.get('Serie ap.') or row.get('Serie') or '').strip()
                producator = str(row.get('producator') or row.get('Producator') or row.get('Producător') or '').strip()
                tip_joc = str(row.get('tip_joc') or row.get('Tip Joc') or '').strip()
                an_fab = str(row.get('an_fab') or row.get('An Fab') or row.get('An Fab.') or '').strip()
                locatia = str(row.get('locatia') or row.get('Locatia') or row.get('Locația') or '').strip()
                nr_post = str(row.get('nr_post') or row.get('Nr. Post') or row.get('Nr Post') or '1').strip()
                if serie:
                    pg_qry("""
                        INSERT INTO cp2_onjn_decision_slots 
                        (decision_id, slot_machine_id, producator, tip_joc, an_fab, locatia, nr_post) 
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (did, serie, producator, tip_joc, an_fab, locatia, nr_post))
        else:
            for s in slots:
                pg_qry("INSERT INTO cp2_onjn_decision_slots (decision_id, slot_machine_id) VALUES (%s, %s)", (did, str(s)))
            
        pg_qry("DELETE FROM cp2_onjn_decision_locations WHERE decision_id = %s", (did,))
        location_ids = data.get('location_ids', [])
        for loc in location_ids:
            if parse_int(loc) is not None:
                pg_qry("INSERT INTO cp2_onjn_decision_locations (decision_id, location_id) VALUES (%s, %s)", (did, parse_int(loc)))
            
        return jsonify({"success": True})

    @app.route('/api/onjn/decisions/<did>', methods=['DELETE'])
    def delete_decision(did):
        pg_qry("DELETE FROM cp2_onjn_decisions WHERE id = %s", (did,))
        return jsonify({"success": True})

    # ------------------ NOTIFICATIONS ------------------
    @app.route('/api/onjn/notifications', methods=['GET'])
    def get_notifications():
        rows = pg_qry("""
            SELECT n.*, c.date as commission_date, c.type as commission_type 
            FROM cp2_onjn_notifications n
            LEFT JOIN cp2_onjn_commissions c ON n.commission_id = c.id
            ORDER BY n.date DESC NULLS LAST
        """)
        for r in rows:
            r['date'] = str(r['date']) if r['date'] else None
            r['transmission_date'] = str(r['transmission_date']) if r['transmission_date'] else None
            r['commission_date'] = str(r['commission_date']) if r['commission_date'] else None
            r['created_at'] = str(r['created_at']) if r['created_at'] else None
        return jsonify(rows)

    @app.route('/api/onjn/notifications', methods=['POST'])
    def create_notification():
        data = request.json
        nid = str(uuid.uuid4())
        pg_qry("""
            INSERT INTO cp2_onjn_notifications 
            (id, level, type, notification_number, date, commission_id, transmission_date, status, observations) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            nid, data.get('level'), data.get('type'), data.get('notification_number'), 
            data.get('date') or None, data.get('commission_id') or None, data.get('transmission_date') or None, 
            data.get('status'), data.get('observations')
        ))
        
        for s in data.get('slots', []):
            pg_qry("INSERT INTO cp2_onjn_notification_relations (notification_id, related_type, related_id) VALUES (%s, %s, %s)", (nid, 'slot', str(s)))
        for l in data.get('locations', []):
            pg_qry("INSERT INTO cp2_onjn_notification_relations (notification_id, related_type, related_id) VALUES (%s, %s, %s)", (nid, 'location', str(l)))
            
        return jsonify({"success": True, "id": nid})

    @app.route('/api/onjn/notifications/<nid>', methods=['PUT'])
    def update_notification(nid):
        data = request.json
        pg_qry("""
            UPDATE cp2_onjn_notifications 
            SET level = %s, type = %s, notification_number = %s, date = %s, commission_id = %s,
                transmission_date = %s, status = %s, observations = %s
            WHERE id = %s
        """, (
            data.get('level'), data.get('type'), data.get('notification_number'), 
            data.get('date') or None, data.get('commission_id') or None, data.get('transmission_date') or None, 
            data.get('status'), data.get('observations'), nid
        ))
        
        pg_qry("DELETE FROM cp2_onjn_notification_relations WHERE notification_id = %s", (nid,))
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
            SELECT ctl.*, c.date as commission_date, c.type as commission_type 
            FROM cp2_onjn_controls ctl
            LEFT JOIN cp2_onjn_commissions c ON ctl.commission_id = c.id
            LEFT JOIN cp2_onjn_control_measures m ON ctl.id = m.control_id
            GROUP BY ctl.id, c.date, c.type
            ORDER BY ctl.pv_date DESC NULLS LAST
        """)
        for r in rows:
            r['pv_date'] = str(r['pv_date']) if r['pv_date'] else None
            r['close_date'] = str(r['close_date']) if r['close_date'] else None
            r['commission_date'] = str(r['commission_date']) if r['commission_date'] else None
        return jsonify(rows)

    @app.route('/api/onjn/controls', methods=['POST'])
    def create_control():
        data = request.json
        cid = str(uuid.uuid4())
        pg_qry("""
            INSERT INTO cp2_onjn_controls (id, pv_number, pv_date, status, close_date, commission_id) 
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (cid, data.get('pv_number'), data.get('pv_date') or None, data.get('status', 'Deschis'), data.get('close_date') or None, data.get('commission_id')))
        
        for m in data.get('measures', []):
            pg_qry("""
                INSERT INTO cp2_onjn_control_measures (id, control_id, description, deadline, responsible, status)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (str(uuid.uuid4()), cid, m.get('description'), m.get('deadline') or None, m.get('responsible'), m.get('status')))
            
        return jsonify({"success": True, "id": cid})

    @app.route('/api/onjn/controls/<cid>', methods=['PUT'])
    def update_control(cid):
        data = request.json
        pg_qry("""
            UPDATE cp2_onjn_controls 
            SET pv_number = %s, pv_date = %s, status = %s, close_date = %s, commission_id = %s
            WHERE id = %s
        """, (data.get('pv_number'), data.get('pv_date') or None, data.get('status', 'Deschis'), data.get('close_date') or None, data.get('commission_id'), cid))
        
        pg_qry("DELETE FROM cp2_onjn_control_measures WHERE control_id = %s", (cid,))
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
        rows = pg_qry("""
            SELECT co.*, c.date as commission_date 
            FROM cp2_onjn_correspondence co 
            LEFT JOIN cp2_onjn_commissions c ON co.commission_id = c.id 
            ORDER BY co.date DESC NULLS LAST
        """)
        for r in rows:
            r['date'] = str(r['date']) if r['date'] else None
            r['commission_date'] = str(r['commission_date']) if r['commission_date'] else None
        return jsonify(rows)

    @app.route('/api/onjn/correspondence', methods=['POST'])
    def create_correspondence():
        data = request.json
        cid = str(uuid.uuid4())
        pg_qry("""
            INSERT INTO cp2_onjn_correspondence (id, type, date, subject, related_entity_type, related_entity_id, commission_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (cid, data.get('type'), data.get('date') or None, data.get('subject'), data.get('related_entity_type'), data.get('related_entity_id'), data.get('commission_id')))
        return jsonify({"success": True, "id": cid})

    @app.route('/api/onjn/correspondence/<cid>', methods=['PUT'])
    def update_correspondence(cid):
        data = request.json
        pg_qry("""
            UPDATE cp2_onjn_correspondence 
            SET type = %s, date = %s, subject = %s, related_entity_type = %s, related_entity_id = %s, commission_id = %s
            WHERE id = %s
        """, (data.get('type'), data.get('date') or None, data.get('subject'), data.get('related_entity_type'), data.get('related_entity_id'), data.get('commission_id'), cid))
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

    @app.route('/api/onjn/documents/<did>/download', methods=['GET'])
    def download_document(did):
        from flask import send_file
        doc = pg_qry("SELECT filename, filepath FROM cp2_onjn_documents WHERE id = %s", (did,))
        if not doc:
            return "Document not found", 404
        filepath = doc[0]['filepath']
        if not os.path.exists(filepath):
            return "File missing from disk", 404
        return send_file(filepath, as_attachment=False, download_name=doc[0]['filename'])

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

