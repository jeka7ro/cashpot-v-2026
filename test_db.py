from server import qry
res = qry("SELECT m.slot_machine_id as serial_nr, mt.manufacturer as producator, mt.name as mix FROM player_card_logs pcl JOIN machines m ON m.id = JSON_UNQUOTE(JSON_EXTRACT(pcl.params, '$.machine_id')) LEFT JOIN machine_types mt ON m.machine_type_id = mt.id WHERE pcl.player_id = 1070 AND pcl.log_type = 2 LIMIT 10")
print(res)
