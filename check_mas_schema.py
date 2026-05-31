
from server import qry
import json

try:
    cols = qry("SHOW COLUMNS FROM machine_audit_summaries")
    print(json.dumps(cols, indent=2))
except Exception as e:
    print(str(e))
