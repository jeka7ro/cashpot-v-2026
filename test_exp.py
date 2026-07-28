from server import qry, pg_qry, normalize_loc_name, get_exp_config
pg_locs = pg_qry("SELECT id, name FROM casino_locations")
pg_name_to_id = {normalize_loc_name(l['name']): str(l['id']) for l in pg_locs}
mysql_locs = qry("SELECT id, code FROM locations")
mysql_to_pg_map = {}
for ml in mysql_locs:
    norm = normalize_loc_name(ml['code'])
    if norm in pg_name_to_id:
        mysql_to_pg_map[str(ml['id'])] = pg_name_to_id[norm]

print("MYSQL to PG MAP:", mysql_to_pg_map)
