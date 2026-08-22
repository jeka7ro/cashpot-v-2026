from server import qry
def print_schema(table_name):
    res = qry(f"SHOW COLUMNS FROM {table_name}")
    print(f"--- {table_name} ---")
    for row in res:
        print(f"{row['Field']}: {row['Type']}")
    print("")

print_schema('machines')
print_schema('locations')
