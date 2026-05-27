import psycopg2
conn = psycopg2.connect(dbname="cashpot", user="cashpot", password="129hj8oahwd7yaw3e21321", host="82.76.35.50", port="26257")
cur = conn.cursor()

def fetch_cols(table):
    cur.execute(f"SELECT * FROM {table} LIMIT 1;")
    return [desc[0] for desc in cur.description]

print("Departments:", fetch_cols("casino_departments"))
print("Payment Types:", fetch_cols("casino_payment_types"))
print("Expenditure Types:", fetch_cols("casino_expenditure_types"))
