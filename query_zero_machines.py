import server
import json
with server.app.test_request_context('/api/rapoarte/lunare?start=2025-08-01&end=2025-08-31'):
    res = server.rep_lunare()
    data = json.loads(res.get_data(as_text=True))
    
    # Calculate totals per machine
    machs = {}
    for r in data:
        ser = r['serial_nr']
        if ser not in machs:
            machs[ser] = {'in':0, 'out':0, 'ggr':0, 'mkt':0, 'ngr':0}
        machs[ser]['in'] += r.get('in_val', 0)
        machs[ser]['out'] += r.get('out_val', 0)
        machs[ser]['ggr'] += r.get('ggr', 0)
        machs[ser]['mkt'] += r.get('marketing', 0)
        machs[ser]['ngr'] += r.get('ngr', 0)
    
    zeros = []
    for ser, totals in machs.items():
        if totals['in'] == 0 and totals['out'] == 0 and totals['ggr'] == 0:
            zeros.append(ser)
    
    print(f"Machines with zero activity in August: {len(zeros)}")
    if zeros:
        print(zeros)
