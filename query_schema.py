from server import pg_qry
def print_schema(table_name):
    res = pg_qry(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")
    print(f"--- {table_name} ---")
    for row in res:
        print(f"{row['column_name']}: {row['data_type']}")
    print("")

print_schema('machines')
print_schema('casino_locations')
