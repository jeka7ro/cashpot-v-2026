import sys
sys.path.append('.')
from server import qry

try:
    print("SESSIONS:")
    print([r['Field'] for r in qry("DESCRIBE sessions")])
    print("TRACKING_LOGS:")
    print([r['Field'] for r in qry("DESCRIBE tracking_logs")])
    print("TRACKING_EVENTS:")
    print([r['Field'] for r in qry("DESCRIBE tracking_events")])
except Exception as e:
    print("ERROR:", e)
