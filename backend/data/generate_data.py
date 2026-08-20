import csv
import random
from datetime import datetime, timedelta
import os

NUM_RECORDS = 50_000 # Enough to show some scale, fast enough to generate quickly
OUTPUT_DIR = "dataset"

REGIONS = ["North", "South", "East", "West", "Midwest"]
AGE_BANDS = ["0-10", "11-20", "21-30", "31-40", "41-50", "51-60", "61-70", "71-80", "81-90", "90+"]
GENDERS = ["M", "F"]
DISEASES = ["Diabetes", "Heart Disease", "Pneumonia", "Asthma", "COPD", "Stroke", "Hypertension", "Cancer", "Sepsis", "Kidney Disease"]
HOSPITAL_IDS = [f"HOSP_{str(i).zfill(3)}" for i in range(1, 51)]

def random_date(start_year=2020, end_year=2023):
    start_date = datetime(start_year, 1, 1)
    end_date = datetime(end_year, 12, 31)
    return start_date + timedelta(days=random.randint(0, (end_date - start_date).days))

def generate_record(patient_id):
    region = random.choice(REGIONS)
    hospital_id = random.choice(HOSPITAL_IDS)
    age_band = random.choice(AGE_BANDS)
    gender = random.choice(GENDERS)
    disease = random.choice(DISEASES)
    
    # Weekend admission bias for insight
    adm_date = random_date()
    is_weekend = adm_date.weekday() >= 5
    
    # Base probability of readmission
    readmit_prob = 0.15
    if age_band in ["71-80", "81-90", "90+"]:
        readmit_prob += 0.10
    if disease in ["Heart Disease", "Sepsis", "COPD"]:
        readmit_prob += 0.05
    if is_weekend:
        readmit_prob += 0.08  # The surprising insight!
        
    readmitted = "Yes" if random.random() < readmit_prob else "No"
    
    cost_base = 5000
    cost_multiplier = 2.5 if disease in ["Cancer", "Sepsis", "Heart Disease"] else 1.0
    treatment_cost = round((cost_base * cost_multiplier) + random.uniform(100, 5000), 2)
    
    admission_date_str = adm_date.strftime("%Y-%m-%d")
    year = adm_date.year
    
    return [patient_id, age_band, gender, region, hospital_id, disease, admission_date_str, year, readmitted, treatment_cost]

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    print(f"Generating {NUM_RECORDS} synthetic healthcare records...")
    
    filepath = os.path.join(OUTPUT_DIR, "healthcare_data.csv")
    with open(filepath, mode="w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["patient_id", "age_band", "gender", "region", "hospital_id", "disease", "admission_date", "year", "readmitted", "treatment_cost"])
        
        for i in range(1, NUM_RECORDS + 1):
            writer.writerow(generate_record(i))
            if i % 10000 == 0:
                print(f"Generated {i} records...")
                
    print(f"Data generation complete. Saved to {filepath}")

if __name__ == "__main__":
    main()
