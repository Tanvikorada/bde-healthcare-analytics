from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from datetime import datetime, timedelta

# Default settings for the DAG
default_args = {
    'owner': 'data_engineering_team',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# Define the DAG
with DAG(
    'healthcare_analytics_pipeline',
    default_args=default_args,
    description='Automated pipeline for Healthcare Big Data Analytics',
    schedule_interval=timedelta(days=1), # Run daily
    catchup=False,
    tags=['healthcare', 'bde', 'spark', 'hadoop'],
) as dag:

    # Task 1: Generate Data (Simulating a daily dump from Hospital OLTP systems)
    generate_data = BashOperator(
        task_id='generate_daily_data',
        bash_command='python /opt/airflow/dags/scripts/generate_data.py',
    )

    # Task 2: Ingest to Data Lake (HDFS or Cloud S3)
    ingest_to_lake = BashOperator(
        task_id='ingest_to_data_lake',
        bash_command='bash /opt/airflow/dags/scripts/ingest_to_hdfs.sh',
    )

    # Task 3: Run Java MapReduce Job (Batch Analytics)
    run_mapreduce = BashOperator(
        task_id='run_mapreduce_analytics',
        bash_command='hadoop jar /opt/airflow/dags/jars/healthcare-analytics.jar com.healthcare.DiseaseFrequency /user/hadoop/healthcare_data /user/hadoop/output_freq',
    )

    # Task 4: Train Spark MLlib Predictive Model
    train_spark_ml = SparkSubmitOperator(
        task_id='train_readmission_model',
        application='/opt/airflow/dags/scripts/spark_ml_predict.py',
        conn_id='spark_default',
        conf={'spark.hadoop.fs.s3a.impl': 'org.apache.hadoop.fs.s3a.S3AFileSystem'},
    )

    # Define the Pipeline Dependencies (The Directed Acyclic Graph)
    generate_data >> ingest_to_lake >> [run_mapreduce, train_spark_ml]
