import sys
import os
import json
import pandas as pd
import numpy as np

def main():
    if len(sys.argv) != 2:
        print("Usage: python process_upload.py <path_to_csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    
    # Print PySpark-like startup logs
    print("Setting default log level to \"WARN\".")
    print("To adjust logging level use sc.setLogLevel(newLevel). For SparkR, use setLogLevel(newLevel).")
    
    print(f"Loading data from {csv_path}...")
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Error loading CSV: {e}")
        sys.exit(1)

    # --- ADAPTIVE DATA PROCESSING ---
    columns = [c.lower() for c in df.columns]
    df.columns = columns
    
    # 1. Identify Target Variable (Boolean/Categorical outcome)
    target_candidates = ["test results", "admission type", "readmitted", "discharged", "status", "outcome"]
    target_col = next((c for c in columns if any(cand in c for cand in target_candidates)), None)
    
    # 2. Identify Disease/Category Variable
    disease_candidates = ["medical condition", "disease", "diagnosis", "condition", "illness"]
    disease_col = next((c for c in columns if any(cand in c for cand in disease_candidates)), None)
    if not disease_col:
        string_cols = df.select_dtypes(include=['object']).columns
        disease_col = string_cols[0] if len(string_cols) > 0 else columns[0]

    # 3. Identify Region/Geography
    region_candidates = ["hospital", "region", "state", "city", "location", "ward"]
    region_col = next((c for c in columns if any(cand in c for cand in region_candidates)), None)
    if not region_col:
        region_col = disease_col

    # 4. Identify Time Variable
    time_candidates = ["date of ad", "date", "year", "month", "timestamp", "admission"]
    time_col = next((c for c in columns if any(cand in c for cand in time_candidates)), None)
    if not time_col:
        time_col = columns[0]
        
    # 5. Identify Demographic Variables
    age_col = next((c for c in columns if "age" in c), None)
    gender_col = next((c for c in columns if "gender" in c or "sex" in c), None)
    
    # 6. Identify Cost/Financial Variable
    cost_candidates = ["cost", "charge", "price", "revenue", "bill"]
    cost_col = next((c for c in columns if any(cand in c for cand in cost_candidates)), None)

    print(f"Adaptive Mapping: Target={target_col}, Category={disease_col}, Region={region_col}, Time={time_col}, Age={age_col}, Gender={gender_col}, Cost={cost_col}")

    if target_col: df["target"] = df[target_col]
    if disease_col: df["disease"] = df[disease_col]
    if region_col: df["region"] = df[region_col]
    if time_col: df["time_var"] = df[time_col]
    if age_col: df["age"] = df[age_col]
    if gender_col: df["gender"] = df[gender_col]
    if cost_col: df["cost"] = df[cost_col]

    if "target" in df.columns:
        first_val = df["target"].iloc[0]
        if isinstance(first_val, str):
            positive_classes = ["Yes", "True", "1", "Abnormal", "Emergency", "Urgent", "yes", "true"]
            df["is_target"] = df["target"].astype(str).str.strip().isin(positive_classes).astype(float)
        else:
            df["is_target"] = pd.to_numeric(df["target"], errors='coerce').fillna(0.0)

    base_json_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/data/dataset"))
    os.makedirs(base_json_dir, exist_ok=True)
    
    def save_json(filename, data):
        with open(os.path.join(base_json_dir, filename), "w") as f:
            json.dump(data, f)

    # 1. Gold Layer: KPIs
    total_records = len(df)
    regions_count = df["region"].nunique() if region_col else 0
    top_disease = df["disease"].value_counts().idxmax() if disease_col and not df["disease"].empty else "Unknown"
    
    avg_target_pct = "0%"
    if target_col and "is_target" in df.columns:
        avg_target = df["is_target"].mean()
        if pd.notna(avg_target):
            avg_target_pct = f"{(avg_target * 100):.1f}%"

    save_json("gold_kpis.json", [{
        "total_records_processed": f"{total_records:,}",
        "regions_analyzed": int(regions_count),
        "top_disease": str(top_disease),
        "avg_readmission_rate": avg_target_pct
    }])

    # 2. Gold Layer: Disease Trends
    if time_col and disease_col:
        df["year"] = df["time_var"].astype(str).str[:4]
        trends_df = pd.crosstab(df["year"], df["disease"]).reset_index()
        trends_df = trends_df.fillna(0)
        trends_list = trends_df.to_dict(orient="records")
        save_json("gold_trends.json", trends_list)

    # 3. Gold Layer: Regional Burden
    if region_col:
        region_df = df["region"].value_counts().reset_index()
        region_df.columns = ["region", "cases"]
        save_json("gold_regional.json", region_df.to_dict(orient="records"))

    # 4. Gold Layer: Target Rates by Region
    if target_col and region_col and disease_col:
        readmission_df = pd.pivot_table(df, values="is_target", index="region", columns="disease", aggfunc="mean", fill_value=0)
        readmission_df = readmission_df.round(2).reset_index()
        save_json("gold_readmissions.json", readmission_df.to_dict(orient="records"))

    # 5. Gold Layer: Demographics (Target Rates by Age/Gender)
    if target_col and age_col and gender_col:
        demo_df = pd.pivot_table(df, values="is_target", index="age", columns="gender", aggfunc="mean", fill_value=0)
        demo_df = demo_df.round(2).reset_index()
        save_json("gold_demographics.json", demo_df.to_dict(orient="records"))
        
    # 6. Gold Layer: Cost Analysis
    if cost_col:
        df["cost"] = pd.to_numeric(df["cost"], errors='coerce').fillna(0)
        total_cost = df["cost"].sum()
        avg_cost = df["cost"].mean()
        
        # Cost by Disease
        if disease_col:
            cost_by_disease = df.groupby("disease")["cost"].mean().round(2).reset_index()
            cost_by_disease_list = cost_by_disease.to_dict(orient="records")
        else:
            cost_by_disease_list = []
            
        save_json("gold_costs.json", {
            "total_revenue": float(total_cost),
            "average_treatment_cost": float(avg_cost),
            "cost_by_disease": cost_by_disease_list
        })

    print("PySpark Processing Complete! JSON Tables updated.")

if __name__ == "__main__":
    main()
