import time
import json
import random
import os
from datetime import datetime
from kafka import KafkaProducer

def get_producer():
    # Wait for Kafka to be ready
    while True:
        try:
            producer = KafkaProducer(
                bootstrap_servers=['kafka:29092'],
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            print("Successfully connected to Kafka!")
            return producer
        except Exception as e:
            print(f"Waiting for Kafka to start... ({e})")
            time.sleep(5)

def run_producer():
    print("Starting Real-Time Kafka Vitals Producer...")
    producer = get_producer()
    
    # Initialize with base values
    vitals = {
        "heart_rate": 75.0,
        "blood_pressure_systolic": 120.0,
        "oxygen_level": 98.0
    }

    topic = "icu_vitals"

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
        
        # Write to Kafka topic
        try:
            producer.send(topic, value=record)
            producer.flush()
            print(f"Produced to Kafka: {record}")
        except Exception as e:
            print(f"Failed to produce message: {e}")
        
        time.sleep(1) # Emit every second

if __name__ == "__main__":
    run_producer()
