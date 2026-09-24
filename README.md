# Healthcare Data Analytics — BDE Capstone

A full-stack Lambda Architecture project: a FastAPI backend (JWT auth, SQLite user
store, pandas-based analytics, a scikit-learn readmission-risk model, a Groq-backed
AI assistant, and a live vitals WebSocket) behind a React + Vite + Tailwind dashboard.
The `/backend` folder also carries the Hadoop/Hive/MapReduce assets from the original
big-data coursework; the live app itself runs on the pandas pipeline in `api/`.

**Live demo:** frontend on Vercel, backend on Render (auto-deploys from `master`).
Demo login: `admin` / `admin123`, or register your own account from the login screen.

## Folder Structure

- `/api`: FastAPI server — auth, analytics endpoints, ML prediction, AI chat, live vitals stream.
- `/frontend`: React + Vite + Tailwind dashboard.
- `/backend/ml`: `train_model.py` trains the RandomForest readmission model consumed by the API.
- `/backend/data`, `/backend/ingestion`, `/backend/mapreduce`, `/backend/hive`: Hadoop-ecosystem
  coursework (dataset generator, HDFS ingestion script, Java MapReduce jobs, Hive schema/queries) —
  not wired into the live API, kept for the big-data portion of the assignment.
- `/backend/streaming`: fake vitals producer used by the WebSocket demo and the Kafka speed-layer
  service in `docker-compose.yml`.
- `/scripts`: one-off tooling — dataset generators, presentation builders, a live smoke-test script.

## Quick Start (Docker Compose — recommended)

```bash
cp api/.env.example api/.env   # then fill in GROK_API_KEY if you want the AI assistant
docker compose up --build
```
- Frontend: http://localhost
- API: http://localhost:8000 (docs at `/docs`, health at `/health`)
- Kafka/Zookeeper and a vitals producer also start, backing the "Live Streaming" tab.

## Local Development (without Docker)

### 1. Backend
```bash
cd api
pip install -r requirements.txt
cp .env.example .env   # fill in GROK_API_KEY, or leave blank to disable the AI tab
uvicorn main:app --reload
```
Runs on http://localhost:8000. A default dataset (`api/test.csv`) loads automatically so the
dashboard isn't empty on first run. An `admin`/`admin123` account is seeded automatically
(override with `ADMIN_PASSWORD` in `.env`).

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173. Set `VITE_API_URL` in `frontend/.env` if the backend isn't on
`localhost:8000`.

### 3. (Optional) Retrain the ML model
```bash
python backend/ml/train_model.py
```
Reads `Realistic_Hospital_Dataset.csv` from the repo root, trains a RandomForestClassifier on a
held-out split, and writes the model + label encoders to `backend/ml/*.pkl`.

### 4. Run tests
```bash
cd api && pytest tests -v          # backend (isolated sqlite DB, no external services needed)
cd frontend && npm run lint && npm run build   # frontend
python scripts/smoke-test/smoke_test.py        # optional: end-to-end check against a live deployment
```

## Environment Variables (`api/.env`, see `api/.env.example`)

| Variable | Purpose | Default |
|---|---|---|
| `GROK_API_KEY` | Groq API key for the AI chat assistant | unset (assistant replies with a "not configured" message) |
| `JWT_SECRET_KEY` | Signs auth tokens | dev-only fallback — set a real value outside local dev |
| `ADMIN_PASSWORD` | Password for the auto-seeded `admin` account | `admin123` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | `*` |

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `master`/`main`:
1. Backend tests (`pytest`, isolated DB).
2. Frontend lint + build.
3. Both Docker images build, and the backend container is booted and checked against `/health`.

Deployment itself is handled by the hosting platforms (Vercel for the frontend, Render for the
API), which redeploy automatically on push to `master`.

## Big Data / Hadoop Coursework (offline)

These were part of the original assignment and demonstrate the Hadoop ecosystem directly; they
are not called by the live API, which processes uploaded CSVs with pandas instead.

```bash
# Generate a larger synthetic dataset
python scripts/dataset/generate_dataset_large.py

# Ingest into HDFS (needs a running single-node Hadoop cluster)
cd backend/ingestion && ./ingest_to_hdfs.sh

# Run a MapReduce job
cd backend/mapreduce && mvn clean package
hadoop jar target/healthcare-analytics-1.0-SNAPSHOT-jar-with-dependencies.jar \
  com.healthcare.DiseaseFrequency /user/hadoop/healthcare_data /user/hadoop/output_freq
# (repeat for ReadmissionRates, YoYTrend, SurprisingInsight)

# Hive schema/queries
cd backend/hive   # see schema.hql and analytics.hql
```
