"""
Trains the readmission-risk RandomForest model used by api/main.py's /api/predict endpoint.

Usage (from anywhere):
    python backend/ml/train_model.py

Reads Realistic_Hospital_Dataset.csv from the repo root, engineers Length of Stay /
Previous Admissions if missing, trains the model, and writes the model + label
encoders to backend/ml/*.pkl (loaded by the API on startup).
"""
import pandas as pd
import numpy as np
import joblib
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.preprocessing import LabelEncoder

ML_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(ML_DIR, "..", ".."))
DATASET_PATH = os.path.join(REPO_ROOT, "Realistic_Hospital_Dataset.csv")
API_TEST_CSV = os.path.join(REPO_ROOT, "api", "test.csv")


def train():
    print(f"Loading dataset from {DATASET_PATH} ...")
    df = pd.read_csv(DATASET_PATH)

    # Engineer features if this is an older version of the dataset that lacks them.
    if 'Length of Stay' not in df.columns:
        print("Adding Length of Stay and Previous Admissions...")
        np.random.seed(42)

        def assign_los(disease):
            if disease == 'Sepsis': return int(np.random.normal(12, 4))
            if disease == 'Heart Disease': return int(np.random.normal(8, 3))
            if disease == 'Pneumonia': return int(np.random.normal(6, 2))
            return int(np.random.normal(3, 1))

        df['Length of Stay'] = df['Disease'].apply(assign_los).clip(1, 30)

        def assign_prev(age):
            if age in ['61-70', '71-80', '80+']: return int(np.random.exponential(1.5))
            return int(np.random.exponential(0.5))

        df['Previous Admissions'] = df['Age Band'].apply(assign_prev).clip(0, 10)

        df.to_csv(DATASET_PATH, index=False)
        df.to_csv(API_TEST_CSV, index=False)
        print(f"Saved updated dataset to {DATASET_PATH} and {API_TEST_CSV}")

    print("Encoding features...")
    le_age = LabelEncoder()
    le_disease = LabelEncoder()
    le_gender = LabelEncoder()

    df['age_encoded'] = le_age.fit_transform(df['Age Band'].astype(str))
    df['disease_encoded'] = le_disease.fit_transform(df['Disease'].astype(str))
    df['gender_encoded'] = le_gender.fit_transform(df['Gender'].astype(str))
    df['target'] = (df['Readmitted'] == 'Yes').astype(int)

    feature_cols = ['age_encoded', 'disease_encoded', 'gender_encoded', 'Treatment Cost', 'Length of Stay', 'Previous Admissions']
    X = df[feature_cols].fillna(0)
    y = df['target']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print("Training RandomForestClassifier...")
    rf_model = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42, n_jobs=-1)
    rf_model.fit(X_train, y_train)

    train_acc = rf_model.score(X_train, y_train)
    test_acc = accuracy_score(y_test, rf_model.predict(X_test))
    test_auc = roc_auc_score(y_test, rf_model.predict_proba(X_test)[:, 1])
    print(f"Train accuracy: {train_acc:.3f}")
    print(f"Test accuracy:  {test_acc:.3f}")
    print(f"Test ROC-AUC:   {test_auc:.3f}")

    os.makedirs(ML_DIR, exist_ok=True)
    joblib.dump(rf_model, os.path.join(ML_DIR, 'rf_model.pkl'))
    joblib.dump(le_age, os.path.join(ML_DIR, 'le_age.pkl'))
    joblib.dump(le_disease, os.path.join(ML_DIR, 'le_disease.pkl'))
    joblib.dump(le_gender, os.path.join(ML_DIR, 'le_gender.pkl'))
    print(f"Model and encoders saved to {ML_DIR}")


if __name__ == "__main__":
    train()
