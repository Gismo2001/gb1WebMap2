import requests

BASE = "https://geodienste.hamburg.de/HH_WFS_Postleitzahlen"

cap = BASE + "?service=WFS&request=GetCapabilities"
print('cap', cap)
r = requests.get(cap, timeout=20)
print('status', r.status_code)
print(r.text[:1800])

url = BASE + "?service=WFS&version=1.1.0&request=GetFeature&typename=de.hh.up:postleitzahlen&outputFormat=application/json&srsName=EPSG:3857&bbox=849000,5930000,856000,5937000"
print('feature url', url)
r2 = requests.get(url, timeout=20)
print('status2', r2.status_code)
print(r2.text[:1800])
