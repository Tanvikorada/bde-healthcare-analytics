"""
Live smoke test against a deployed HealthHadoop backend.
Usage:
    BASE_URL=https://your-backend.example.com ADMIN_PASSWORD=... python scripts/smoke-test/smoke_test.py
Defaults to the project's Render deployment and the default demo admin password.
"""
import os
import requests
import asyncio
import websockets
import json
import time

BASE_URL = os.getenv("BASE_URL", "https://bde-healthcare-analytics.onrender.com")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/stream/vitals"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

results = []

def log(section, test, status, detail=""):
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    msg = f"{icon} [{section}] {test}: {detail}"
    print(msg)
    results.append({"section": section, "test": test, "status": status, "detail": detail})

def test_login():
    # Wrong password
    r = requests.post(BASE_URL + "/api/token", data={"username": "admin", "password": "wrongpassword"})
    log("AUTH", "Wrong password rejected", "PASS" if r.status_code == 401 else "FAIL", f"Status {r.status_code}")
    
    # Right password
    r = requests.post(BASE_URL + "/api/token", data={"username": "admin", "password": ADMIN_PASSWORD})
    if r.status_code == 200:
        log("AUTH", "Login with admin credentials", "PASS", "Token received")
        return r.json()["access_token"]
    else:
        log("AUTH", "Login with admin credentials", "FAIL", r.text)
        return None

def test_data_endpoints(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    endpoints = [
        ("kpis", "/api/kpis"),
        ("disease-trends", "/api/disease-trends"),
        ("regional-burden", "/api/regional-burden"),
        ("readmission-rates", "/api/readmission-rates"),
        ("demographics", "/api/demographics"),
        ("costs", "/api/costs"),
    ]
    
    for name, ep in endpoints:
        r = requests.get(BASE_URL + ep, headers=headers)
        if r.status_code == 200:
            data = r.json()
            is_empty = not data
            log("DATA ENDPOINTS", name, "PASS" if not is_empty else "WARN", 
                f"200 OK. Empty: {is_empty}. Sample: {str(data)[:80]}")
        else:
            log("DATA ENDPOINTS", name, "FAIL", f"Status {r.status_code}: {r.text[:80]}")

def test_upload(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    # Upload valid CSV
    csv_content = b"Patient ID,Disease,Hospital Region,Age Band,Gender,Treatment Cost,Readmitted\nPT-00001,Heart Disease,North Wing,61-70,Male,15000,Yes\nPT-00002,Diabetes,South Wing,51-60,Female,9000,No\n"
    r = requests.post(BASE_URL + "/api/upload", files={"file": ("test.csv", csv_content, "text/csv")}, headers=headers)
    log("UPLOAD", "Valid CSV upload", "PASS" if r.status_code == 200 else "FAIL", f"Status {r.status_code}: {r.text[:100]}")
    
    # Upload invalid file type
    r = requests.post(BASE_URL + "/api/upload", files={"file": ("test.txt", b"hello", "text/plain")}, headers=headers)
    log("UPLOAD", "Invalid file type rejected", "PASS" if r.status_code == 400 else "FAIL", f"Status {r.status_code}")

def test_ml_predictor(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    # All combinations
    for disease in ["Heart Disease", "Diabetes", "Pneumonia"]:
        for age in ["41-50", "71-80"]:
            payload = {"disease": disease, "age_band": age, "treatment_cost": 14000, "gender": "Male"}
            r = requests.post(BASE_URL + "/api/predict", json=payload, headers=headers)
            if r.status_code == 200:
                data = r.json()
                log("ML PREDICTOR", f"{disease} / {age}", "PASS", f"Prediction: {data.get('prediction')} ({data.get('probability')})")
            else:
                log("ML PREDICTOR", f"{disease} / {age}", "FAIL", r.text[:100])
    
    # Missing field
    r = requests.post(BASE_URL + "/api/predict", json={"disease": "Diabetes"}, headers=headers)
    log("ML PREDICTOR", "Missing fields validation", "PASS" if r.status_code == 422 else "FAIL", f"Status {r.status_code}")

def test_ai_chat(token):
    headers = {"Authorization": f"Bearer {token}"}
    questions = [
        "What is the top disease?",
        "Which region has the most cases?",
        "Give me a summary of the dashboard.",
    ]
    for q in questions:
        r = requests.post(BASE_URL + "/api/ask-grok", json={"query": q}, headers=headers)
        if r.status_code == 200:
            reply = r.json().get("reply", "")
            if "Error" in reply or "Please set" in reply:
                log("AI CHAT", q[:40], "FAIL", reply[:120])
            else:
                log("AI CHAT", q[:40], "PASS", reply[:120])
        else:
            log("AI CHAT", q[:40], "FAIL", f"Status {r.status_code}")

async def test_websocket():
    try:
        start = time.time()
        async with websockets.connect(WS_URL, open_timeout=10) as ws:
            messages = []
            for _ in range(5):
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                messages.append(json.loads(msg))
            
            # Check fields
            for m in messages:
                if "heart_rate" not in m or "oxygen_level" not in m:
                    log("STREAMING", "WebSocket data fields", "FAIL", f"Missing fields in: {m}")
                    return
            
            hr_values = [m["heart_rate"] for m in messages]
            o2_values = [m["oxygen_level"] for m in messages]
            log("STREAMING", "WebSocket connection", "PASS", f"Got 5 messages. HR range: {min(hr_values)}-{max(hr_values)}")
            log("STREAMING", "Anomaly detection field", "PASS" if "anomaly_detected" in messages[0] else "FAIL", str(messages[0]))
            log("STREAMING", "Data is dynamic (not static)", "PASS" if len(set(hr_values)) > 1 else "FAIL", f"HR values: {hr_values}")
            elapsed = time.time() - start
            log("STREAMING", "Approx message interval", "PASS", f"{elapsed/5:.1f}s per message (expect ~1.5s)")
    except Exception as e:
        log("STREAMING", "WebSocket connection", "FAIL", str(e))

def test_unauthenticated_access():
    # All endpoints should return 401 without a token
    for ep in ["/api/kpis", "/api/disease-trends", "/api/predict"]:
        r = requests.get(BASE_URL + ep)
        log("SECURITY", f"Unauthenticated {ep}", "PASS" if r.status_code == 401 else "FAIL", f"Got {r.status_code}")
    
    r = requests.post(BASE_URL + "/api/predict", json={"disease": "Diabetes", "age_band": "51-60", "treatment_cost": 5000, "gender": "Male"})
    log("SECURITY", "Predict without token", "PASS" if r.status_code == 401 else "FAIL", f"Got {r.status_code}")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  HEALTHHADOOP AI - FULL APP TEST REPORT")
    print("="*60 + "\n")
    
    print("--- AUTHENTICATION ---")
    token = test_login()
    if not token:
        print("FATAL: Cannot get token. Aborting.")
        exit(1)
    
    print("\n--- DATA ENDPOINTS ---")
    test_data_endpoints(token)
    
    print("\n--- FILE UPLOAD ---")
    test_upload(token)
    
    print("\n--- ML PREDICTOR ---")
    test_ml_predictor(token)
    
    print("\n--- AI CHAT ---")
    test_ai_chat(token)
    
    print("\n--- REAL-TIME STREAMING ---")
    asyncio.run(test_websocket())
    
    print("\n--- SECURITY ---")
    test_unauthenticated_access()
    
    # Final Summary
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    warned = sum(1 for r in results if r["status"] == "WARN")
    
    print("\n" + "="*60)
    print(f"  SUMMARY: {passed} PASS  |  {warned} WARN  |  {failed} FAIL")
    print("="*60)
    if failed > 0:
        print("\nFAILED TESTS:")
        for r in results:
            if r["status"] == "FAIL":
                print(f"  ❌ [{r['section']}] {r['test']}: {r['detail']}")
