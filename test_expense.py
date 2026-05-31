from server import app
import json

with app.test_client() as client:
    payload = {
        "date": "2026-05-22",
        "amount": 50000,
        "explanation": "test manual script",
        "department_id": "71ef28ba-b9b5-4a7b-b50a-e5223cde8572", # Taxe Sloturi
        "expenditure_type_id": "1e149d86-b485-455b-b9d9-cc16e2eb93e0", # Taxa Autorizatii Lunara
        "loc_ids": [
            "e78a6daf-7e8a-47a6-9856-90b78fb4a523", # Craiova
            "36d01a7c-f228-49d3-9cb4-275974a23ae5"  # Pitesti
        ],
        "split_mode": "slots"
    }
    res = client.post('/api/admin/expenses', json=payload)
    print("Status:", res.status_code)
    print("Response:", res.get_data(as_text=True))
