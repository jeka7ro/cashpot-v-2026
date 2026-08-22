from server import get_pg_conn

def setup():
    conn = get_pg_conn()
    c = conn.cursor()

    # 1. Commissions
    c.execute('''
        CREATE TABLE IF NOT EXISTS cp2_onjn_commissions (
            id UUID PRIMARY KEY,
            date DATE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by UUID
        )
    ''')

    # 2. Decisions
    c.execute('''
        CREATE TABLE IF NOT EXISTS cp2_onjn_decisions (
            id UUID PRIMARY KEY,
            commission_id UUID REFERENCES cp2_onjn_commissions(id) ON DELETE CASCADE,
            decision_number VARCHAR(255),
            decision_date DATE,
            type VARCHAR(100),
            total_slots INT DEFAULT 0,
            location_id BIGINT,
            location_id_dest BIGINT,
            status VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by UUID
        )
    ''')

    # 3. Decision Slots
    c.execute('''
        CREATE TABLE IF NOT EXISTS cp2_onjn_decision_slots (
            decision_id UUID REFERENCES cp2_onjn_decisions(id) ON DELETE CASCADE,
            slot_machine_id VARCHAR(255) NOT NULL,
            PRIMARY KEY(decision_id, slot_machine_id)
        )
    ''')

    # 4. Notifications
    c.execute('''
        CREATE TABLE IF NOT EXISTS cp2_onjn_notifications (
            id UUID PRIMARY KEY,
            level VARCHAR(50) NOT NULL, -- CENTRAL or LOCAL
            type VARCHAR(100) NOT NULL,
            notification_number VARCHAR(255),
            date DATE,
            transmission_date DATE,
            status VARCHAR(100),
            observations TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by UUID
        )
    ''')

    # 5. Notification Relations (Slots / Locations)
    c.execute('''
        CREATE TABLE IF NOT EXISTS cp2_onjn_notification_relations (
            notification_id UUID REFERENCES cp2_onjn_notifications(id) ON DELETE CASCADE,
            related_type VARCHAR(50), -- 'slot' or 'location'
            related_id VARCHAR(255),  -- slot_machine_id or location_id (stringified)
            PRIMARY KEY(notification_id, related_type, related_id)
        )
    ''')

    # 6. Controls
    c.execute('''
        CREATE TABLE IF NOT EXISTS cp2_onjn_controls (
            id UUID PRIMARY KEY,
            pv_number VARCHAR(255),
            pv_date DATE,
            status VARCHAR(50),
            close_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by UUID
        )
    ''')

    # 7. Control Measures
    c.execute('''
        CREATE TABLE IF NOT EXISTS cp2_onjn_control_measures (
            id UUID PRIMARY KEY,
            control_id UUID REFERENCES cp2_onjn_controls(id) ON DELETE CASCADE,
            description TEXT,
            deadline DATE,
            responsible VARCHAR(255),
            status VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by UUID
        )
    ''')

    # 8. Correspondence
    c.execute('''
        CREATE TABLE IF NOT EXISTS cp2_onjn_correspondence (
            id UUID PRIMARY KEY,
            type VARCHAR(100),
            date DATE,
            subject VARCHAR(255),
            related_entity_type VARCHAR(50),
            related_entity_id VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by UUID
        )
    ''')

    # 9. Documents
    c.execute('''
        CREATE TABLE IF NOT EXISTS cp2_onjn_documents (
            id UUID PRIMARY KEY,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(255) NOT NULL,
            document_type VARCHAR(100),
            filename VARCHAR(500),
            filepath VARCHAR(1000),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by UUID
        )
    ''')

    conn.commit()
    print("Tabelele ONJN au fost create cu succes in PostgreSQL.")

if __name__ == '__main__':
    setup()
