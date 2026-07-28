from server import qry, pg_qry, normalize_loc_name, get_exp_config
start = '2026-07-01'
end = '2026-07-25'
pg_excl_where = ""
exp_res = pg_qry(f"""
    SELECT location_id, SUM(amount) as s 
    FROM casino_payments 
    WHERE direction = 1
      AND (is_deleted = false OR is_deleted IS NULL)
      AND date >= %s AND date <= %s {pg_excl_where}
    GROUP BY location_id
""", [start + ' 00:00:00', end + ' 23:59:59'])
print(exp_res)
