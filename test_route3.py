from server import api_machine_details
from flask import Flask
app = Flask(__name__)
app.config['TESTING'] = True

@app.route('/test')
def t():
    return api_machine_details('130695')

with app.test_client() as c:
    try:
        import server
        # force raising instead of catching inside the func
        old = server.api_machine_details
        
        c.get('/test')
    except Exception as e:
        import traceback
        traceback.print_exc()
