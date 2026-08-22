from server import app
import json

with app.test_client() as c:
    rv = c.get('/api/machine/130695/details')
    print(rv.status_code)
    print(rv.data)
