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

    # --- DATA QUALITY / SCHEMA VALIDATION (Real-world upgrade) ---
    required_columns = {"patient_id", "age_band", "gender", "region", "disease", "readmitted", "year", "treatment_cost"}
    actual_columns = set(df.columns)
    
    missing = required_columns - actual_columns
    if missing:
        print(f"ERROR: Data Quality Check Failed. Missing columns: {missing}")
        sys.exit(2) # Specific exit code for DQ failure

    print("Data Quality Checks Passed. Processing...")

    # Output directory
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../api/mock_data"))
    os.makedirs(out_dir, exist_ok=True)

    # 1. KPIs
    total_records = df.count()
    regions_count = df.select("region").distinct().count()
    
    top_disease_row = df.groupBy("disease").count().orderBy(desc("count")).first()
    top_disease = top_disease_row["disease"] if top_disease_row else "Unknown"
    
    # Readmission logic: 'Yes' -> 1.0, 'No' -> 0.0
    df = df.withColumn("is_readmitted", when(col("readmitted") == "Yes", 1.0).otherwise(0.0))
    avg_readmission = df.select(avg("is_readmitted")).first()[0]
    avg_readmission_pct = f"{(avg_readmission * 100):.1f}%" if avg_readmission is not None else "0%"

    kpis = {
        "total_records_processed": f"{total_records:,}",
        "regions_analyzed": regions_count,
        "top_disease": top_disease,
        "avg_readmission_rate": avg_readmission_pct
    }
    with open(os.path.join(out_dir, "kpis.json"), "w") as f:
        json.dump(kpis, f)

    # 2. Disease Trends
    trends_df = df.groupBy("year").pivot("disease").count().fillna(0).orderBy("year")
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

    # 4. Readmission Rates
    readmission_df = df.groupBy("region").pivot("disease").agg(spark_round(avg("is_readmitted"), 2)).fillna(0)
    readmission_data = [row.asDict() for row in readmission_df.collect()]
    with open(os.path.join(out_dir, "readmission_rates.json"), "w") as f:
        json.dump(readmission_data, f)

    print("Spark Processing Complete! JSON cache updated.")
    spark.stop()

if __name__ == "__main__":
    main()
