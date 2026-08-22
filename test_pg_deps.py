import sys
sys.path.append('.')
from server import pg_qry

rows = pg_qry("""
    SELECT cd.name as dep, et.name as typ, COUNT(*), SUM(p.amount)
    FROM casino_payments p
    LEFT JOIN casino_departments cd ON p.department_id = cd.id
    LEFT JOIN casino_expenditure_types et ON p.expenditure_type_id = et.id
    WHERE p.direction = 1
    GROUP BY cd.name, et.name
    ORDER BY SUM(p.amount) DESC
    LIMIT 20
""")
for r in rows:
    print(r)
