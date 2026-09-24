import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

# Parameters
NUM_RECORDS = 5000
np.random.seed(42)

# Options
diseases = ["Heart Disease", "Diabetes", "Pneumonia", "Sepsis", "Asthma"]
regions = ["North Wing", "South Wing", "East Wing", "West Wing", "Central Hub"]
age_bands = ["21-30", "31-40", "41-50", "51-60", "61-70", "71-80", "81+"]
genders = ["Male", "Female"]

# Generate Dates
start_date = datetime(2022, 1, 1)
dates = [start_date + timedelta(days=random.randint(0, 730)) for _ in range(NUM_RECORDS)]

data = {
    "Patient ID": [f"PT-{i:05d}" for i in range(1, NUM_RECORDS + 1)],
    "Date of Admission": [d.strftime("%Y-%m-%d") for d in dates],
    "Disease": np.random.choice(diseases, NUM_RECORDS, p=[0.3, 0.25, 0.2, 0.1, 0.15]),
    "Hospital Region": np.random.choice(regions, NUM_RECORDS),
    "Age Band": np.random.choice(age_bands, NUM_RECORDS, p=[0.05, 0.1, 0.15, 0.2, 0.25, 0.15, 0.1]),
    "Gender": np.random.choice(genders, NUM_RECORDS),
    "Treatment Cost": np.round(np.random.normal(12000, 3000, NUM_RECORDS), 2)
}

df = pd.DataFrame(data)

# Add some logic for Readmission based on Age and Disease
def calculate_readmission(row):
    prob = 0.1  # base probability
    
    if row["Disease"] in ["Heart Disease", "Sepsis"]: prob += 0.15
    if row["Age Band"] in ["61-70", "71-80", "81+"]: prob += 0.1
    if row["Hospital Region"] == "South Wing": prob -= 0.05
    
    # Cost impact
    if row["Treatment Cost"] > 15000: prob += 0.05
    
    return "Yes" if random.random() < prob else "No"

df["Readmitted"] = df.apply(calculate_readmission, axis=1)

# Ensure costs don't go negative
df["Treatment Cost"] = df["Treatment Cost"].clip(lower=1000)

df.to_csv("Hospital_Readmissions_Dataset.csv", index=False)
print("Dataset generated as 'Hospital_Readmissions_Dataset.csv' (5000 rows)")
