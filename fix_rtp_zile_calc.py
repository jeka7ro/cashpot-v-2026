# Look at backend to see what 'zile' is actually named.
import json
import urllib.request

req = urllib.request.urlopen("http://localhost:5050/api/analiza/rtp?start=2026-08-01&end=2026-08-31")
res = json.loads(req.read())
print(res[0].keys())
