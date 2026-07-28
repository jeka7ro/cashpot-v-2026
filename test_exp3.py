from server import qry, pg_qry, normalize_loc_name, get_exp_config
mysql_locs = qry("SELECT id, code FROM locations")
print(mysql_locs)
