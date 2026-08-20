# Healthcare Data Analytics using Hadoop Ecosystem

A full-stack Big Data portfolio project demonstrating ingestion, MapReduce analytics, Hive warehousing, Spark performance comparisons, and a premium React dashboard.

## Folder Structure

- `/backend/data`: Python script to generate the healthcare dataset.
- `/backend/ingestion`: Bash script to partition and upload data to HDFS.
- `/backend/mapreduce`: Java MapReduce jobs (Maven project).
- `/backend/hive`: Hive schema and query scripts.
- `/backend/spark`: PySpark script for runtime comparison.
- `/api`: FastAPI server to expose Hadoop output to the frontend.
- `/frontend`: React + Vite + Tailwind dashboard.

## Setup Instructions

### 1. Data Generation (Local)
Generate the synthetic dataset (approx 50k rows for fast demo):
```bash
cd backend/data
python generate_data.py
```

### 2. Hadoop / HDFS (Single-Node Cluster)
Ensure Hadoop is running (`start-dfs.sh` and `start-yarn.sh`).
```bash
cd backend/ingestion
./ingest_to_hdfs.sh
```
*Fallback for Low-RAM laptops*: If HDFS keeps crashing, skip HDFS and run the PySpark/API layer directly off the local CSV. The API has a fallback mock mode so the frontend always works.

### 3. Running MapReduce (Java)
```bash
cd backend/mapreduce
mvn clean package
hadoop jar target/healthcare-analytics-1.0-SNAPSHOT-jar-with-dependencies.jar com.healthcare.DiseaseFrequency /user/hadoop/healthcare_data /user/hadoop/output_freq
```
*(Repeat for other classes: ReadmissionRates, YoYTrend, SurprisingInsight)*

### 4. Running PySpark
```bash
cd backend/spark
spark-submit spark_analytics.py
```

### 5. API Layer
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload
```
*(Runs on http://localhost:8000. It reads mock data if Hadoop isn't running, preventing UI blockage).*

### 6. Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
*(Runs on http://localhost:5173)*
