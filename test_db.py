import unicodedata

def normalize(name):
    if not name: return ''
    n = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    n = n.lower().replace('(', '').replace(')', '').replace(' ', '')
    return n

mysql_names = ['Pitesti', 'Ploiesti', 'Depozit', 'Valcea', 'Craiova', 'Ploiesti (centru)', 'Ploiesti (nord)']
pg_names = ['Ploiesti (nord)', 'Ploiesti (centru)', 'Pitesti', 'Depozit', 'Valcea', 'Birou', 'Focsani', 'Craiova']

pg_map = {normalize(n): n for n in pg_names}
for m in mysql_names:
    norm = normalize(m)
    print(f"MySQL {m} -> norm: {norm} -> PG matched: {pg_map.get(norm)}")
