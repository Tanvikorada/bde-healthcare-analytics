import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

np.random.seed(42)
random.seed(42)

NUM_RECORDS = 25000

# Base parameters
diseases = ['Heart Disease', 'Diabetes', 'Pneumonia', 'Sepsis', 'Asthma']
regions = ['North Wing', 'South Wing', 'East Wing', 'West Wing', 'Central Hub']
genders = ['Male', 'Female', 'Other']
age_bands = ['18-30', '31-40', '41-50', '51-60', '61-70', '71-80', '80+']

print("Generating realistic hospital data...")

# Generate dates over 4 years with some seasonal weighting
start_date = datetime(2020, 1, 1)
dates = [start_date + timedelta(days=random.randint(0, 1460)) for _ in range(NUM_RECORDS)]

data = {
    'Patient ID': [f"PT-{str(i).zfill(6)}" for i in range(1, NUM_RECORDS + 1)],
    'Date of Admission': [d.strftime('%Y-%m-%d') for d in dates],
    'Gender': np.random.choice(genders, NUM_RECORDS, p=[0.48, 0.50, 0.02]),
    'Hospital Region': np.random.choice(regions, NUM_RECORDS, p=[0.25, 0.20, 0.15, 0.10, 0.30])
}

df = pd.DataFrame(data)

# Extract month to add seasonality
df['Month'] = pd.to_datetime(df['Date of Admission']).dt.month

# Generate diseases with seasonality (Pneumonia peaks in winter)
def assign_disease(month):
    if month in [11, 12, 1, 2]:
        return np.random.choice(diseases, p=[0.20, 0.20, 0.35, 0.10, 0.15]) # High pneumonia
    elif month in [3, 4, 5]:
        return np.random.choice(diseases, p=[0.20, 0.20, 0.10, 0.10, 0.40]) # High asthma in spring
    else:
        return np.random.choice(diseases, p=[0.30, 0.30, 0.15, 0.15, 0.10])

df['Disease'] = df['Month'].apply(assign_disease)

# Age correlations: Heart disease skews older, Asthma skews younger
def assign_age(disease):
    if disease in ['Heart Disease', 'Sepsis']:
        return np.random.choice(age_bands, p=[0.05, 0.05, 0.10, 0.20, 0.30, 0.20, 0.10])
    elif disease == 'Asthma':
        return np.random.choice(age_bands, p=[0.35, 0.25, 0.20, 0.10, 0.05, 0.03, 0.02])
    else:
        return np.random.choice(age_bands, p=[0.10, 0.15, 0.20, 0.20, 0.15, 0.15, 0.05])

df['Age Band'] = df['Disease'].apply(assign_age)

# Cost and Readmission correlations
# Sepsis/Heart Disease cost more and have higher readmission
def calculate_metrics(row):
    disease = row['Disease']
    age_idx = age_bands.index(row['Age Band'])
    
    # Base costs
    base_costs = {
        'Sepsis': 25000,
        'Heart Disease': 18000,
        'Pneumonia': 9000,
        'Diabetes': 6000,
        'Asthma': 4500
    }
    
    # Age multiplier (older = more expensive)
    age_multiplier = 1.0 + (age_idx * 0.15)
    
    # Random variance + log-normal skew (some very expensive edge cases)
    cost = base_costs[disease] * age_multiplier * np.random.lognormal(mean=0, sigma=0.4)
    
    # Readmission probability
    base_readmit_prob = {
        'Sepsis': 0.35,
        'Heart Disease': 0.28,
        'Pneumonia': 0.20,
        'Diabetes': 0.18,
        'Asthma': 0.12
    }
    
    prob = base_readmit_prob[disease] + (age_idx * 0.02)
    readmitted = 'Yes' if random.random() < prob else 'No'
    
    return round(cost, 2), readmitted

metrics = df.apply(calculate_metrics, axis=1)
df['Treatment Cost'] = [m[0] for m in metrics]
df['Readmitted'] = [m[1] for m in metrics]

# Introduce some missing/messy data to make it realistic (1% missing costs)
df.loc[df.sample(frac=0.01).index, 'Treatment Cost'] = np.nan
df.loc[df.sample(frac=0.005).index, 'Gender'] = np.nan

# Drop internal columns and reorder
df = df.drop(columns=['Month'])
df = df[['Patient ID', 'Date of Admission', 'Disease', 'Hospital Region', 'Age Band', 'Gender', 'Treatment Cost', 'Readmitted']]

# Save to file
out_path = 'Realistic_Hospital_Dataset.csv'
df.to_csv(out_path, index=False)
print(f"Generated {out_path} with {len(df)} rows.")
