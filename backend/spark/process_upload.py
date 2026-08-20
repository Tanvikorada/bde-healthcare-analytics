import sys
import os
import json
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, avg, round as spark_round, sum as spark_sum, desc, when

def main():
    if len(sys.argv) != 2:
        print("Usage: python process_upload.py <path_to_csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    
    spark = SparkSession.builder \
        .appName("Healthcare_Upload_Processor") \
        .getOrCreate()
        
    spark.sparkContext.setLogLevel("ERROR")

    print(f"Loading data from {csv_path}...")
    df = spark.read.csv(csv_path, header=True, inferSchema=True)

    # --- ADAPTIVE DATA PROCESSING (Real-world upgrade) ---
    columns = [c.lower() for c in df.columns]
    
    # 1. Identify Target Variable (Boolean/Categorical outcome)
    target_candidates = ["readmitted", "discharged", "deceased", "status", "outcome"]
    target_col = next((c for c in columns if any(cand in c for cand in target_candidates)), None)
    
    # 2. Identify Disease/Category Variable
    disease_candidates = ["disease", "diagnosis", "condition", "illness"]
    disease_col = next((c for c in columns if any(cand in c for cand in disease_candidates)), None)
    if not disease_col:
        # Fallback to the first string column
        disease_col = next((f.name for f in df.schema.fields if isinstance(f.dataType, __import__('pyspark.sql.types').sql.types.StringType)), df.columns[0])

    # 3. Identify Region/Geography
    region_candidates = ["region", "state", "city", "location", "ward"]
    region_col = next((c for c in columns if any(cand in c for cand in region_candidates)), None)
    if not region_col:
        region_col = disease_col # Fallback

    # 4. Identify Time Variable
    time_candidates = ["year", "date", "month", "timestamp"]
    time_col = next((c for c in columns if any(cand in c for cand in time_candidates)), None)
    if not time_col:
        time_col = df.columns[0] # Fallback
        
    print(f"Adaptive Mapping: Target={target_col}, Category={disease_col}, Region={region_col}, Time={time_col}")

    # Standardize column names for downstream processing
    if target_col:
        df = df.withColumnRenamed(target_col, "target")
    if disease_col:
        df = df.withColumnRenamed(disease_col, "disease")
    if region_col:
        df = df.withColumnRenamed(region_col, "region")
    if time_col:
        df = df.withColumnRenamed(time_col, "time_var")

    # Output directory
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../api/mock_data"))
    os.makedirs(out_dir, exist_ok=True)

    # 1. KPIs
    total_records = df.count()
    regions_count = df.select("region").distinct().count()
    
    top_disease_row = df.groupBy("disease").count().orderBy(desc("count")).first()
    top_disease = top_disease_row["disease"] if top_disease_row else "Unknown"
    
    avg_target_pct = "N/A"
    if target_col:
        # Check if it's string (Yes/No) or numeric
        first_val = df.select("target").first()[0]
        if isinstance(first_val, str):
             df = df.withColumn("is_target", when(col("target").isin(["Yes", "True", "1"]), 1.0).otherwise(0.0))
        else:
             df = df.withColumn("is_target", col("target").cast("double"))
             
        avg_target = df.select(avg("is_target")).first()[0]
        avg_target_pct = f"{(avg_target * 100):.1f}%" if avg_target is not None else "0%"

    kpis = {
        "total_records_processed": f"{total_records:,}",
        "regions_analyzed": regions_count,
        "top_disease": top_disease,
        "avg_readmission_rate": avg_target_pct
    }
    with open(os.path.join(out_dir, "kpis.json"), "w") as f:
        json.dump(kpis, f)

    # 2. Disease Trends
    trends_df = df.groupBy("time_var").pivot("disease").count().fillna(0).orderBy("time_var")
    trends_df = trends_df.withColumnRenamed("time_var", "year")
    # Convert to list of dicts
    trends_rows = trends_df.collect()
    trends_data = [row.asDict() for row in trends_rows]
    with open(os.path.join(out_dir, "disease_trends.json"), "w") as f:
        json.dump(trends_data, f)

    # 3. Regional Burden
    region_df = df.groupBy("region").count().withColumnRenamed("count", "cases")
    region_data = [row.asDict() for row in region_df.collect()]
    with open(os.path.join(out_dir, "regional_burden.json"), "w") as f:
        json.dump(region_data, f)

    # 4. Target Rates by Region
    if target_col:
        readmission_df = df.groupBy("region").pivot("disease").agg(spark_round(avg("is_target"), 2)).fillna(0)
        readmission_data = [row.asDict() for row in readmission_df.collect()]
        with open(os.path.join(out_dir, "readmission_rates.json"), "w") as f:
            json.dump(readmission_data, f)

    print("Spark Processing Complete! JSON cache updated.")
    spark.stop()

if __name__ == "__main__":
    main()
