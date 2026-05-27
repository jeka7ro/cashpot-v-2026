import psycopg2
conn = psycopg2.connect(dbname="cashpot", user="cashpot", password="129hj8oahwd7yaw3e21321", host="82.76.35.50", port="26257")
cur = conn.cursor()

# Get the ID for 'POS' department
cur.execute("SELECT id, name FROM casino_departments WHERE name ILIKE '%pos%';")
deps = cur.fetchall()
print("POS Departments:", deps)

cur.execute("SELECT id, name FROM casino_payment_types WHERE name ILIKE '%pos%';")
types = cur.fetchall()
print("POS Payment Types:", types)

if deps:
    dep_id = deps[0][0]
    cur.execute(f"SELECT id, department_id, type_id, amount FROM casino_payments WHERE department_id = '{dep_id}' LIMIT 5;")
    print("Payments with POS department:", cur.fetchall())

if types:
    t_id = types[0][0]
    cur.execute(f"SELECT id, department_id, type_id, amount FROM casino_payments WHERE type_id = '{t_id}' LIMIT 5;")
    print("Payments with POS payment type:", cur.fetchall())

