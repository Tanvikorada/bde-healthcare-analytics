import requests
import asyncio
import websockets
import json

BASE_URL = "https://bde-healthcare-analytics.onrender.com"
WS_URL = "wss://bde-healthcare-analytics.onrender.com/api/stream/vitals"

def test_endpoints():
    print("Testing basic endpoints...")
    endpoints = ["/api/kpis", "/api/disease-trends", "/api/demographics", "/api/costs"]
    for ep in endpoints:
        r = requests.get(BASE_URL + ep)
        print(f"{ep}: {r.status_code}")
        if r.status_code != 200:
            print(f"  Error: {r.text}")

def test_upload():
    print("\nTesting file upload...")
    try:
        with open("Hospital_Readmissions_Dataset.csv", "rb") as f:
            files = {"file": ("Hospital_Readmissions_Dataset.csv", f, "text/csv")}
            r = requests.post(BASE_URL + "/api/upload", files=files)
            print(f"/api/upload: {r.status_code}")
            if r.status_code == 200:
                print("  Success! Upload endpoint works.")
            else:
                print(f"  Error: {r.text}")
    except Exception as e:
        print(f"Upload test failed: {e}")

async def test_websocket():
    print("\nTesting websocket...")
    try:
        async with websockets.connect(WS_URL) as ws:
            print("Connected to WebSocket.")
            for _ in range(3):
                msg = await ws.recv()
                data = json.loads(msg)
                print(f"Received WS data: HR={data.get('heart_rate')} O2={data.get('oxygen_level')}")
            print("WebSocket is functioning properly.")
    except Exception as e:
        print(f"WebSocket test failed: {e}")

if __name__ == "__main__":
    test_endpoints()
    test_upload()
    asyncio.run(test_websocket())
