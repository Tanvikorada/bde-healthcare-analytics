import requests, json, asyncio, websockets, time

BASE = 'https://bde-healthcare-analytics.onrender.com'
WS   = 'wss://bde-healthcare-analytics.onrender.com/api/stream/vitals'

PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"

def section(title):
    print(f"\n{'='*55}\n  {title}\n{'='*55}")

# ----- LOGIN -----
section("AUTH")
r = requests.post(BASE + '/api/token', data={'username': 'admin', 'password': 'admin123'}, timeout=30)
print(f"Login admin123:  {PASS if r.status_code==200 else FAIL} — status {r.status_code}")
token = r.json().get('access_token') if r.status_code == 200 else None

r2 = requests.post(BASE + '/api/token', data={'username': 'admin', 'password': 'wrongpassword'}, timeout=30)
print(f"Wrong password:  {PASS if r2.status_code==401 else FAIL} — status {r2.status_code}")

if not token:
    print("FATAL — cannot get token, aborting")
    exit(1)

h = {'Authorization': f'Bearer {token}'}

# ----- DATA ENDPOINTS -----
section("DATA ENDPOINTS")
endpoints = ['kpis','disease-trends','regional-burden','readmission-rates','demographics','costs']
for ep in endpoints:
    r = requests.get(BASE + f'/api/{ep}', headers=h, timeout=30)
    data = r.json() if r.status_code == 200 else None
    is_empty = (not data) or (isinstance(data, (list, dict)) and len(data) == 0)
    status = PASS if r.status_code == 200 and not is_empty else FAIL
    print(f"{ep:<22} {status}  HTTP {r.status_code}  empty={is_empty}  sample={str(data)[:60]}")

# ----- FILE UPLOAD -----
section("FILE UPLOAD")
with open('Hospital_Readmissions_Dataset.csv', 'rb') as f:
    r = requests.post(BASE + '/api/upload', files={'file': ('test.csv', f, 'text/csv')}, headers=h, timeout=60)
    print(f"Valid CSV upload:  {PASS if r.status_code==200 else FAIL}  HTTP {r.status_code}  {r.text[:100]}")

dummy = b"col1,col2\nhello,world"
r = requests.post(BASE + '/api/upload', files={'file': ('test.txt', dummy, 'text/plain')}, headers=h, timeout=15)
print(f"Invalid type reject: {PASS if r.status_code==400 else FAIL}  HTTP {r.status_code}")

# ----- ML PREDICTOR all 5 diseases -----
section("ML PREDICTOR")
for disease in ['Heart Disease', 'Diabetes', 'Pneumonia', 'Sepsis', 'Asthma']:
    payload = {'disease': disease, 'age_band': '61-70', 'treatment_cost': 14000, 'gender': 'Male'}
    r = requests.post(BASE + '/api/predict', json=payload, headers=h, timeout=15)
    if r.status_code == 200:
        d = r.json()
        print(f"{disease:<18}  {PASS}  {d.get('prediction')} ({d.get('probability')})")
    else:
        print(f"{disease:<18}  {FAIL}  HTTP {r.status_code}  {r.text[:80]}")

# Missing field test
r = requests.post(BASE + '/api/predict', json={'disease': 'Diabetes'}, headers=h, timeout=15)
print(f"Missing field validation: {PASS if r.status_code==422 else FAIL}  HTTP {r.status_code}")

# ----- AI CHAT -----
section("AI CHAT (Groq LLaMA)")
for q in ['What is the top disease?', 'Which region has the most cases?']:
    r = requests.post(BASE + '/api/ask-grok', json={'query': q}, headers=h, timeout=30)
    if r.status_code == 200:
        reply = r.json().get('reply','')
        is_error = 'Error' in reply or 'Please set' in reply or 'dummy' in reply.lower()
        print(f"Q: {q[:40]}")
        print(f"  {FAIL if is_error else PASS}  Reply: {reply[:130]}")
    else:
        print(f"  {FAIL}  HTTP {r.status_code}")

# ----- WEBSOCKET + BP fields -----
section("WEBSOCKET STREAMING")
async def test_ws():
    try:
        async with websockets.connect(WS, open_timeout=15) as ws:
            msgs = []
            for _ in range(5):
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                msgs.append(json.loads(raw))
            
            # Check all required fields
            required = ['heart_rate', 'oxygen_level', 'blood_pressure', 'blood_pressure_systolic', 'blood_pressure_diastolic', 'anomaly_detected', 'patient_id']
            for field in required:
                present = all(field in m for m in msgs)
                print(f"Field '{field}': {PASS if present else FAIL}")
            
            # Check systolic is a NUMBER not a string
            systolic = msgs[0].get('blood_pressure_systolic')
            print(f"Systolic is numeric: {PASS if isinstance(systolic, (int,float)) else FAIL}  value={systolic}")
            
            # Check anomaly field is bool
            anom = msgs[0].get('anomaly_detected')
            print(f"Anomaly is bool: {PASS if isinstance(anom, bool) else FAIL}  value={anom}")
            
            # Check data varies
            hr_vals = [m['heart_rate'] for m in msgs]
            print(f"Data is dynamic (not static): {PASS if len(set(hr_vals))>1 else WARN}  HR values={hr_vals}")
            
    except Exception as e:
        print(f"WebSocket {FAIL}: {e}")

asyncio.run(test_ws())

# ----- SECURITY -----
section("SECURITY")
for ep in ['/api/kpis', '/api/disease-trends']:
    r = requests.get(BASE + ep, timeout=15)
    print(f"GET {ep} no auth: {PASS if r.status_code==401 else FAIL}  HTTP {r.status_code}")
r = requests.post(BASE + '/api/predict', json={'disease':'Diabetes','age_band':'51-60','treatment_cost':5000,'gender':'Male'}, timeout=15)
print(f"POST /predict no auth: {PASS if r.status_code==401 else FAIL}  HTTP {r.status_code}")

print(f"\n{'='*55}\n  DONE\n{'='*55}")
