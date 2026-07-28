import sys
from server import pg_qry

try:
    pg_qry("""
        CREATE TABLE IF NOT EXISTS cp2_recurring_sync_log (
            id SERIAL PRIMARY KEY,
            sync_month VARCHAR(7) UNIQUE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Table created via pg_qry.")
except Exception as e2:
    print(f"Failed via pg_qry: {e2}")
