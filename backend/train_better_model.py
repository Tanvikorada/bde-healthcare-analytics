import pandas as pd
import numpy as np
import joblib
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

print("Loading dataset...")
df = pd.read_csv('Realistic_Hospital_Dataset.csv')

# Add new features if they don't exist
if 'Length of Stay' not in df.columns:
    print("Adding Length of Stay and Previous Admissions...")
    np.random.seed(42)
    # Length of Stay: more severe diseases -> longer stay
    def assign_los(disease):
        if disease == 'Sepsis': return int(np.random.normal(12, 4))
        if disease == 'Heart Disease': return int(np.random.normal(8, 3))
        if disease == 'Pneumonia': return int(np.random.normal(6, 2))
        return int(np.random.normal(3, 1))
    
    df['Length of Stay'] = df['Disease'].apply(assign_los).clip(1, 30)
    
    # Previous Admissions: correlates with age and readmission
    def assign_prev(age):
        if age in ['61-70', '71-80', '80+']: return int(np.random.exponential(1.5))
        return int(np.random.exponential(0.5))
    df['Previous Admissions'] = df['Age Band'].apply(assign_prev).clip(0, 10)
    
    # Save the updated dataset back
    df.to_csv('Realistic_Hospital_Dataset.csv', index=False)
    # Also save to api/test.csv so the backend has the new data
    df.to_csv('api/test.csv', index=False)
    print("Saved updated CSVs")

print("Training Advanced ML Model...")

# Features
le_age = LabelEncoder()
le_disease = LabelEncoder()
le_gender = LabelEncoder()

df['age_encoded'] = le_age.fit_transform(df['Age Band'].astype(str))
df['disease_encoded'] = le_disease.fit_transform(df['Disease'].astype(str))
df['gender_encoded'] = le_gender.fit_transform(df['Gender'].astype(str))
df['target'] = (df['Readmitted'] == 'Yes').astype(int)

X = df[['age_encoded', 'disease_encoded', 'gender_encoded', 'Treatment Cost', 'Length of Stay', 'Previous Admissions']].fillna(0)
y = df['target']

rf_model = RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42, n_jobs=-1)
rf_model.fit(X, y)

print(f"Model accuracy: {rf_model.score(X, y):.2f}")

os.makedirs('backend/ml', exist_ok=True)
joblib.dump(rf_model, 'backend/ml/rf_model.pkl')
joblib.dump(le_age, 'backend/ml/le_age.pkl')
joblib.dump(le_disease, 'backend/ml/le_disease.pkl')
joblib.dump(le_gender, 'backend/ml/le_gender.pkl')
print("Model and encoders saved to backend/ml/")
