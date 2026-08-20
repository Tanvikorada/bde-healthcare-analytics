from pyspark.sql import SparkSession
from pyspark.ml.feature import StringIndexer, VectorAssembler, OneHotEncoder
from pyspark.ml.classification import RandomForestClassifier
from pyspark.ml.evaluation import BinaryClassificationEvaluator
from pyspark.ml import Pipeline
import json
import os
import time

def main():
    spark = SparkSession.builder \
        .appName("Healthcare_Readmission_Predictor") \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .getOrCreate()

    print("Starting Spark MLlib Training Pipeline...")
    
    # In a cloud setup, this would be "s3a://your-bucket-name/healthcare_data.csv"
    # Demonstrating Cloud Readiness while keeping local fallback
    input_path = "../data/dataset/healthcare_data.csv"
    
    df = spark.read.csv(input_path, header=True, inferSchema=True)
    
    # Data Preparation
    # Convert 'Yes'/'No' to 1.0/0.0
    from pyspark.sql.functions import col, when
    df = df.withColumn("label", when(col("readmitted") == "Yes", 1.0).otherwise(0.0))
    
    # Feature Engineering
    categorical_cols = ["age_band", "gender", "disease"]
    indexers = [StringIndexer(inputCol=c, outputCol=f"{c}_indexed", handleInvalid="keep") for c in categorical_cols]
    encoders = [OneHotEncoder(inputCol=f"{c}_indexed", outputCol=f"{c}_vec") for c in categorical_cols]
    
    # Assemble all features into a single vector
    assembler = VectorAssembler(
        inputCols=[f"{c}_vec" for c in categorical_cols] + ["treatment_cost"],
        outputCol="features"
    )
    
    # Define the Model
    rf = RandomForestClassifier(labelCol="label", featuresCol="features", numTrees=20)
    
    # Build the Pipeline
    pipeline = Pipeline(stages=indexers + encoders + [assembler, rf])
    
    # Split Data
    train_data, test_data = df.randomSplit([0.8, 0.2], seed=42)
    
    start_time = time.time()
    # Train the Model
    print("Training Random Forest Model...")
    model = pipeline.fit(train_data)
    
    # Evaluate
    predictions = model.transform(test_data)
    evaluator = BinaryClassificationEvaluator(labelCol="label")
    auc = evaluator.evaluate(predictions)
    
    training_time = time.time() - start_time
    
    print(f"Model trained in {training_time:.2f} seconds.")
    print(f"Area Under ROC (AUC): {auc:.4f}")
    
    # Save model metadata for the API to use (simulating a saved model deployment)
    model_meta = {
        "model_type": "RandomForestClassifier",
        "auc_score": auc,
        "training_time_seconds": training_time,
        "features_used": categorical_cols + ["treatment_cost"],
        "status": "Ready for Production"
    }
    
    os.makedirs("../../api/mock_data", exist_ok=True)
    with open("../../api/mock_data/ml_model_meta.json", "w") as f:
        json.dump(model_meta, f)
        
    # model.save("s3a://your-bucket/models/readmission_rf_model") # Cloud save example
    
    print("Model metadata saved for API consumption.")
    spark.stop()

if __name__ == "__main__":
    main()
