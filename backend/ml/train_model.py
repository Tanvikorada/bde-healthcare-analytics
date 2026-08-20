import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib
import os

def train():
    data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/dataset/healthcare_data.csv"))
    if not os.path.exists(data_path):
        print(f"Dataset not found at {data_path}. Please generate it first.")
        return

    print("Loading data...")
    df = pd.read_csv(data_path)

    # We need to predict 'readmitted' (Yes=1, No=0)
    df['target'] = df['readmitted'].apply(lambda x: 1 if x == 'Yes' else 0)

    # Features: age_band, gender, disease, treatment_cost
    # For a real pipeline, you'd use OneHotEncoder, but LabelEncoder is fine for this demo
    le_age = LabelEncoder()
    le_disease = LabelEncoder()
    le_gender = LabelEncoder()

    df['age_encoded'] = le_age.fit_transform(df['age_band'])
    df['disease_encoded'] = le_disease.fit_transform(df['disease'])
    df['gender_encoded'] = le_gender.fit_transform(df['gender'])

    X = df[['age_encoded', 'disease_encoded', 'gender_encoded', 'treatment_cost']]
    y = df['target']

    print("Training RandomForestClassifier...")
    model = RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42)
    model.fit(X, y)

    # Save model and encoders
    out_dir = os.path.dirname(__file__)
    joblib.dump(model, os.path.join(out_dir, "rf_model.pkl"))
    joblib.dump(le_age, os.path.join(out_dir, "le_age.pkl"))
    joblib.dump(le_disease, os.path.join(out_dir, "le_disease.pkl"))
    joblib.dump(le_gender, os.path.join(out_dir, "le_gender.pkl"))

    print("Model and encoders saved successfully to backend/ml/")

if __name__ == "__main__":
    train()
