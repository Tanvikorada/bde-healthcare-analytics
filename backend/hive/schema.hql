-- Hive Schema Definition
-- Run this in Hive CLI or Beeline to set up the tables over HDFS data.

CREATE DATABASE IF NOT EXISTS healthcare_db;
USE healthcare_db;

-- 1. Create external partitioned table mapped to our HDFS ingest path
CREATE EXTERNAL TABLE IF NOT EXISTS patient_records (
    patient_id STRING,
    age_band STRING,
    gender STRING,
    region STRING, -- In CSV, but also partitioning key, so Hive will expect it in the path
    hospital_id STRING,
    disease STRING,
    admission_date STRING,
    year STRING,
    readmitted STRING,
    treatment_cost DOUBLE
)
PARTITIONED BY (part_year STRING, part_region STRING)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION '/user/hadoop/healthcare_data';

-- Load partitions automatically if HDFS paths match Hive partition structure
MSCK REPAIR TABLE patient_records;

-- 2. Create a dimension table for Hospitals
CREATE TABLE IF NOT EXISTS hospitals_dim (
    hospital_id STRING,
    hospital_name STRING,
    bed_count INT,
    hospital_type STRING
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE;

-- Note: You would load this from a static CSV
-- LOAD DATA LOCAL INPATH '/path/to/hospitals.csv' INTO TABLE hospitals_dim;
