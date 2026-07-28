import sys
from server import pg_qry

rows = pg_qry("""
    SELECT f.id, f.expense_date, f.location_ids, f.department_id, f.type_id,
           f.quantity, f.unit_value, f.currency, f.eur_rate, f.total_ron, f.is_recurring,
           d.name as department_name, t.name as type_name
    FROM cp2_monthly_fixed_expenses f
    LEFT JOIN casino_departments d ON f.department_id::text = d.id::text
    LEFT JOIN casino_expenditure_types t ON f.type_id::text = t.id::text
    WHERE f.expense_date >= '2026-07-01' AND f.expense_date <= '2026-07-31'
""")
print(f"Total rows: {len(rows)}")
for r in rows:
    print(r)
