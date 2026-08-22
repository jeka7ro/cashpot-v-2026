from server import api_machine_details
from flask import Flask
app = Flask(__name__)
with app.app_context():
    try:
        api_machine_details('130695')
    except Exception as e:
        import traceback
        traceback.print_exc()
