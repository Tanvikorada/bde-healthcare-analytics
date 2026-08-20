# Viva Preparation: Architecture Decisions

Here are one-line defenses for every major architecture decision in this project. Use these to confidently answer questions from your professor or during a portfolio interview.

### 1. Why did you use Java for MapReduce instead of Python Streaming?
"While Python is faster to write, Java is the native language of Hadoop and provides better type safety, debugging, and performance at petabyte scale, which is the academic standard I wanted to demonstrate."

### 2. Why did you partition the HDFS data by `Year` and `Region`?
"Healthcare analytical queries almost always filter by time (e.g., year-over-year trends) and geography (regional disease burden). Partitioning by these keys drastically reduces disk I/O (partition pruning) compared to full table scans."

### 3. Why include both MapReduce and Spark?
"To practically demonstrate the evolution of Big Data processing. MapReduce writes intermediate results to HDFS (disk I/O bound), whereas Spark uses Resilient Distributed Datasets (RDDs) for in-memory caching, making iterative machine learning or repeated queries significantly faster."

### 4. Why use an intermediate API layer instead of querying Hive directly from React?
"Directly exposing a Hive database to a web frontend is a major security and latency anti-pattern. The API acts as a caching layer, reducing load on the Hadoop cluster and allowing the UI to remain responsive even if the backend batch jobs take hours to run."

### 5. Why build a synthetic data generator instead of using a raw Kaggle CSV?
"Real hospital data contains massive PII compliance issues and formatting inconsistencies. Building a generator allowed me to simulate 50,000+ perfectly formatted records tailored for our specific KPIs, demonstrating data engineering pipeline control rather than just data cleaning."

### 6. What is the 'Surprising Insight' and why is it important?
"I analyzed readmission rates based on the *day of the week* the patient was admitted. I found weekend admissions had an 8% higher readmission rate, highlighting a potential systemic issue with weekend triage or staffing levels—demonstrating that Big Data can drive real operational business value."
