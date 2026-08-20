-- Hive Analytics Queries
USE healthcare_db;

-- Query 1: JOIN with dimension table to find average treatment cost by hospital type and disease
-- (Demonstrates understanding of JOINs in Hive)
SELECT 
    h.hospital_type,
    p.disease,
    AVG(p.treatment_cost) as avg_cost
FROM 
    patient_records p
JOIN 
    hospitals_dim h ON p.hospital_id = h.hospital_id
GROUP BY 
    h.hospital_type, 
    p.disease
ORDER BY 
    avg_cost DESC;

-- Query 2: Window Function to calculate the YoY growth of disease occurrences per region
-- (Demonstrates advanced SQL-on-Hadoop capabilities)
WITH DiseaseCounts AS (
    SELECT 
        part_region AS region,
        part_year AS year,
        disease,
        COUNT(patient_id) as total_cases
    FROM 
        patient_records
    GROUP BY 
        part_region, part_year, disease
)
SELECT 
    region,
    year,
    disease,
    total_cases,
    LAG(total_cases, 1) OVER (PARTITION BY region, disease ORDER BY year) as prev_year_cases,
    (total_cases - LAG(total_cases, 1) OVER (PARTITION BY region, disease ORDER BY year)) as yoy_difference
FROM 
    DiseaseCounts
ORDER BY 
    region, disease, year;
