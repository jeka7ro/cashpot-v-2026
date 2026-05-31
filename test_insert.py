from server import app, pg_qry
import json

with app.test_client() as client:
    payload = {
        "date": "2026-05-22",
        "amount": 9999,
        "explanation": "TESTING COMMIT",
        "department_id": "71ef28ba-b9b5-4a7b-b50a-e5223cde8572",
        "expenditure_type_id": "1e149d86-b485-455b-b9d9-cc16e2eb93e0",
        "loc_ids": [
            "e78a6daf-7e8a-47a6-9856-90b78fb4a523",
            "36d01a7c-f228-49d3-9cb4-275974a23ae5"
        ],
        "split_mode": "slots"
    }
    res = client.post('/api/admin/expenses', json=payload)
    print("Status:", res.status_code)
    print("Response:", res.get_data(as_text=True))
    
    rows = pg_qry("SELECT id, explanation, amount FROM casino_payments WHERE explanation='TESTING COMMIT'")
    print("DB Rows found:", rows)
