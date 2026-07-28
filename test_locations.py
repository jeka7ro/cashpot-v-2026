from server import app
with app.test_client() as client:
    res = client.get('/api/locations?start=2026-07-01&end=2026-07-25')
    data = res.get_json()
    for d in data:
        print(f"{d['locatie']}: cheltuieli = {d.get('cheltuieli')}")
