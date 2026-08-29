import pandas as pd
import numpy as np

def process_dataframe(df: pd.DataFrame) -> dict:
    """
    Processes a Pandas DataFrame and returns a dictionary of all dashboard data in-memory.
    No disk writes, no PySpark overhead.
    """
    # 1. Standardize columns
    columns = [c.lower() for c in df.columns]
    df.columns = columns
    
    # 2. Adaptive Mapping
    target_candidates = ["test results", "admission type", "readmitted", "discharged", "status", "outcome"]
    target_col = next((c for c in columns if any(cand in c for cand in target_candidates)), None)
    
    disease_candidates = ["medical condition", "disease", "diagnosis", "condition", "illness"]
    disease_col = next((c for c in columns if any(cand in c for cand in disease_candidates)), None)
    if not disease_col:
        string_cols = df.select_dtypes(include=['object']).columns
        disease_col = string_cols[0] if len(string_cols) > 0 else columns[0]

    region_candidates = ["hospital", "region", "state", "city", "location", "ward"]
    region_col = next((c for c in columns if any(cand in c for cand in region_candidates)), None)
    if not region_col:
        region_col = disease_col

    time_candidates = ["date of ad", "date", "year", "month", "timestamp", "admission"]
    time_col = next((c for c in columns if any(cand in c for cand in time_candidates)), None)
    if not time_col:
        time_col = columns[0]
        
    age_col = next((c for c in columns if "age" in c), None)
    gender_col = next((c for c in columns if "gender" in c or "sex" in c), None)
    
    cost_candidates = ["cost", "charge", "price", "revenue", "bill"]
    cost_col = next((c for c in columns if any(cand in c for cand in cost_candidates)), None)

    # Copy to standard names
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

    results = {}

    # --- 1. KPIs ---
    total_records = len(df)
    regions_count = df["region"].nunique() if region_col else 0
    top_disease = df["disease"].value_counts().idxmax() if disease_col and not df["disease"].empty else "Unknown"
    
    avg_target_pct = "0%"
    if target_col and "is_target" in df.columns:
        avg_target = df["is_target"].mean()
        if pd.notna(avg_target):
            avg_target_pct = f"{(avg_target * 100):.1f}%"

    results["kpis"] = {
        "total_records_processed": f"{total_records:,}",
        "regions_analyzed": int(regions_count),
        "top_disease": str(top_disease),
        "avg_readmission_rate": avg_target_pct
    }

    # --- 2. Trends ---
    if time_col and disease_col:
        df["year"] = df["time_var"].astype(str).str[:4]
        trends_df = pd.crosstab(df["year"], df["disease"]).reset_index()
        results["trends"] = trends_df.fillna(0).to_dict(orient="records")
    else:
        results["trends"] = []

    # --- 3. Regional ---
    if region_col:
        region_df = df["region"].value_counts().reset_index()
        region_df.columns = ["region", "cases"]
        results["regions"] = region_df.to_dict(orient="records")
    else:
        results["regions"] = []

    # --- 4. Readmissions ---
    if target_col and region_col and disease_col:
        readmission_df = pd.pivot_table(df, values="is_target", index="region", columns="disease", aggfunc="mean", fill_value=0)
        results["readmissions"] = readmission_df.round(2).reset_index().to_dict(orient="records")
    else:
        results["readmissions"] = []

    # --- 5. Demographics ---
    if target_col and age_col and gender_col:
        demo_df = pd.pivot_table(df, values="is_target", index="age", columns="gender", aggfunc="mean", fill_value=0)
        results["demographics"] = demo_df.round(2).reset_index().to_dict(orient="records")
    else:
        results["demographics"] = []
        
    # --- 6. Costs ---
    if cost_col:
        df["cost"] = pd.to_numeric(df["cost"], errors='coerce').fillna(0)
        total_cost = df["cost"].sum()
        avg_cost = df["cost"].mean()
        
        cost_by_disease_list = []
        if disease_col:
            cost_by_disease = df.groupby("disease")["cost"].mean().round(2).reset_index()
            cost_by_disease_list = cost_by_disease.to_dict(orient="records")
            
        results["costs"] = {
            "total_revenue": float(total_cost),
            "average_treatment_cost": float(avg_cost),
            "cost_by_disease": cost_by_disease_list
        }
    else:
        results["costs"] = None

    return results
