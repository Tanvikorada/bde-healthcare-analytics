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
    
    # Aggressively constrain memory for the free tier (512MB total environment limit)
    builder = SparkSession.builder \
        .appName("Healthcare_Batch_Processor") \
        .config("spark.driver.memory", "480m") \
        .config("spark.executor.memory", "480m") \
        .config("spark.sql.shuffle.partitions", "2") \
        .config("spark.driver.maxResultSize", "128m") \
        .config("spark.ui.enabled", "false")
        
    spark = builder.getOrCreate()
    spark.sparkContext.setLogLevel("ERROR")

    print(f"Loading data from {csv_path}...")
    df = spark.read.csv(csv_path, header=True, inferSchema=True)

    # --- ADAPTIVE DATA PROCESSING ---
    columns = [c.lower() for c in df.columns]
    
    # 1. Identify Target Variable (Boolean/Categorical outcome)
    target_candidates = ["test results", "admission type", "readmitted", "discharged", "status", "outcome"]
    target_col = next((c for c in columns if any(cand in c for cand in target_candidates)), None)
    
    # 2. Identify Disease/Category Variable
    disease_candidates = ["medical condition", "disease", "diagnosis", "condition", "illness"]
    disease_col = next((c for c in columns if any(cand in c for cand in disease_candidates)), None)
    if not disease_col:
        disease_col = next((f.name for f in df.schema.fields if isinstance(f.dataType, __import__('pyspark.sql.types').sql.types.StringType)), df.columns[0])

    # 3. Identify Region/Geography
    region_candidates = ["hospital", "region", "state", "city", "location", "ward"]
    region_col = next((c for c in columns if any(cand in c for cand in region_candidates)), None)
    if not region_col:
        region_col = disease_col

    # 4. Identify Time Variable
    time_candidates = ["date of ad", "date", "year", "month", "timestamp", "admission"]
    time_col = next((c for c in columns if any(cand in c for cand in time_candidates)), None)
    if not time_col:
        time_col = df.columns[0]
        
    print(f"Adaptive Mapping: Target={target_col}, Category={disease_col}, Region={region_col}, Time={time_col}")

    if target_col:
        df = df.withColumnRenamed(target_col, "target")
    if disease_col:
        df = df.withColumnRenamed(disease_col, "disease")
    if region_col:
        df = df.withColumnRenamed(region_col, "region")
    if time_col:
        df = df.withColumnRenamed(time_col, "time_var")

    if target_col:
        first_val = df.select("target").first()[0]
        if isinstance(first_val, str):
             df = df.withColumn("is_target", when(col("target").isin(["Yes", "True", "1", "Abnormal", "Emergency", "Urgent"]), 1.0).otherwise(0.0))
        else:
             df = df.withColumn("is_target", col("target").cast("double"))

    base_json_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/data/dataset"))
    os.makedirs(base_json_dir, exist_ok=True)
    
    def save_json(filename, data):
        with open(os.path.join(base_json_dir, filename), "w") as f:
            json.dump(data, f)

    # 1. Gold Layer: KPIs
    total_records = df.count()
    regions_count = df.select("region").distinct().count() if region_col else 0
    top_disease_row = df.groupBy("disease").count().orderBy(desc("count")).first() if disease_col else None
    top_disease = top_disease_row["disease"] if top_disease_row else "Unknown"
    
    avg_target_pct = "0%"
    if target_col:
        avg_target = df.select(avg("is_target")).first()[0]
        if avg_target is not None:
            avg_target_pct = f"{(avg_target * 100):.1f}%"

    save_json("gold_kpis.json", [{
        "total_records_processed": f"{total_records:,}",
        "regions_analyzed": regions_count,
        "top_disease": top_disease,
        "avg_readmission_rate": avg_target_pct
    }])

    # 2. Gold Layer: Disease Trends
    if time_col and disease_col:
        # Just grab the Year safely by casting to string and taking first 4 chars
        df = df.withColumn("year", col("time_var").cast("string").substr(1, 4))
        trends_df = df.groupBy("year").pivot("disease").count().fillna(0).orderBy("year")
        # To JSON
        trends_list = [row.asDict() for row in trends_df.collect()]
        save_json("gold_trends.json", trends_list)

    # 3. Gold Layer: Regional Burden
    if region_col:
        region_df = df.groupBy("region").count().withColumnRenamed("count", "cases")
        save_json("gold_regional.json", [row.asDict() for row in region_df.collect()])

    # 4. Gold Layer: Target Rates by Region
    if target_col and region_col and disease_col:
        readmission_df = df.groupBy("region").pivot("disease").agg(spark_round(avg("is_target"), 2)).fillna(0)
        save_json("gold_readmissions.json", [row.asDict() for row in readmission_df.collect()])

    print("PySpark Processing Complete! JSON Tables updated.")
    spark.stop()

if __name__ == "__main__":
    main()
