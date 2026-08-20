import time
import json
import random
import os
from datetime import datetime

LOG_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/vitals.log"))

def run_producer():
    print(f"Starting Real-Time Vitals Producer. Writing logs to {LOG_FILE}")
    # Ensure directory exists
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    
    # Initialize with base values
    vitals = {
        "heart_rate": 75.0,
        "blood_pressure_systolic": 120.0,
        "oxygen_level": 98.0
    }

    with open(LOG_FILE, "a") as f:
        while True:
            # Random walk
            vitals["heart_rate"] += random.uniform(-2, 2)
            vitals["blood_pressure_systolic"] += random.uniform(-1, 1)
            vitals["oxygen_level"] += random.uniform(-0.5, 0.5)
            
            # Keep bounds
            vitals["oxygen_level"] = min(100.0, max(85.0, vitals["oxygen_level"]))
            
            # Formatting
            timestamp = datetime.now().strftime("%H:%M:%S")
            record = {
                "timestamp": timestamp,
                "heart_rate": round(vitals["heart_rate"], 1),
                "blood_pressure_systolic": round(vitals["blood_pressure_systolic"], 1),
                "oxygen_level": round(vitals["oxygen_level"], 1)
            }
            
            # Write to log file like a real telemetry system
            f.write(json.dumps(record) + "\n")
            f.flush()
            
            time.sleep(1) # Emit every second

if __name__ == "__main__":
    run_producer()
