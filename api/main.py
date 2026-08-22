from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import subprocess
from pydantic import BaseModel
import os
import json
import random
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI
import joblib
import pandas as pd
import aiofiles
from aiokafka import AIOKafkaConsumer
from fastapi.security import OAuth2PasswordRequestForm
from auth import create_access_token, verify_password, get_user, mock_users_db, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES, timedelta, Depends
load_dotenv()

app = FastAPI(title="Healthcare Data Analytics API")

# Load ML Models if they exist
ML_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/ml"))
try:
    rf_model = joblib.load(os.path.join(ML_DIR, "rf_model.pkl"))
    le_age = joblib.load(os.path.join(ML_DIR, "le_age.pkl"))
    le_disease = joblib.load(os.path.join(ML_DIR, "le_disease.pkl"))
    le_gender = joblib.load(os.path.join(ML_DIR, "le_gender.pkl"))
    print("Real ML Models loaded successfully.")
except Exception as e:
    rf_model = None
    print(f"Warning: ML Models not found. Ensure train_model.py was run. Error: {e}")

# Initialize xAI (Grok) client
client = AsyncOpenAI(
    api_key=os.getenv("GROK_API_KEY", "dummy_key_if_missing"),
    base_url="https://api.x.ai/v1",
)

# Allow frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MOCK_DIR = "./mock_data"

# Helpers to load real Hadoop output if available, else mock
def load_json_or_mock(filename, mock_data):
    file_path = os.path.join(MOCK_DIR, filename)
    if os.path.exists(file_path):
        try:
            with open(file_path, "r") as f:
                return json.load(f)
        except Exception:
            return mock_data
    return mock_data

def load_delta_or_mock(table_name, mock_data):
    delta_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), f"../backend/data/delta/{table_name}"))
    try:
        from deltalake import DeltaTable
        dt = DeltaTable(delta_dir)
        df = dt.to_pandas()
        # If it's the KPIs table, return a single dict instead of a list
        if table_name == "gold_kpis":
            return df.to_dict(orient="records")[0]
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"Delta load failed for {table_name}: {e}")
        return mock_data

@app.post("/api/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(mock_users_db, form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "full_name": current_user["full_name"]}

@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    # Save the file temporarily
    upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/data/dataset"))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, "custom_upload.csv")
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        
    # Trigger the PySpark processing script
    spark_script = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/spark/process_upload.py"))
    
    try:
        result = subprocess.run(
            ["python", spark_script, file_path], 
            capture_output=True, text=True, check=True
        )
    except subprocess.CalledProcessError as e:
        if e.returncode == 2:
            raise HTTPException(status_code=400, detail="Data Quality Check Failed. Missing required columns.")
        else:
            raise HTTPException(status_code=500, detail=f"Spark Processing Failed: {e.stderr}")
            
    return {"message": "File processed successfully", "logs": result.stdout}

@app.get("/api/kpis")
def get_kpis(current_user: dict = Depends(get_current_user)):
    mock = {
        "total_records_processed": "50,000",
        "regions_analyzed": 5,
        "top_disease": "Heart Disease",
        "avg_readmission_rate": "15.4%"
    }
    return load_delta_or_mock("gold_kpis", mock)

@app.get("/api/disease-trends")
def get_disease_trends(current_user: dict = Depends(get_current_user)):
    mock = [
        {"year": 2020, "Diabetes": 1200, "Heart Disease": 1350, "Pneumonia": 800},
        {"year": 2021, "Diabetes": 1250, "Heart Disease": 1400, "Pneumonia": 750},
        {"year": 2022, "Diabetes": 1300, "Heart Disease": 1500, "Pneumonia": 900},
        {"year": 2023, "Diabetes": 1400, "Heart Disease": 1600, "Pneumonia": 850},
    ]
    return load_delta_or_mock("gold_trends", mock)

@app.get("/api/regional-burden")
def get_regional_burden(current_user: dict = Depends(get_current_user)):
    mock = [
        {"region": "North", "cases": 12500},
        {"region": "South", "cases": 14200},
        {"region": "East", "cases": 9800},
        {"region": "West", "cases": 11500},
        {"region": "Midwest", "cases": 10500},
    ]
    return load_delta_or_mock("gold_regional", mock)

@app.get("/api/readmission-rates")
def get_readmission_rates(current_user: dict = Depends(get_current_user)):
    mock = [
        {"region": "North", "Diabetes": 0.12, "Heart Disease": 0.18},
        {"region": "South", "Diabetes": 0.14, "Heart Disease": 0.20},
        {"region": "East", "Diabetes": 0.11, "Heart Disease": 0.17},
        {"region": "West", "Diabetes": 0.13, "Heart Disease": 0.19},
        {"region": "Midwest", "Diabetes": 0.12, "Heart Disease": 0.16},
    ]
    return load_delta_or_mock("gold_readmission", mock)

@app.get("/api/mapreduce-vs-spark")
def get_performance_comparison(current_user: dict = Depends(get_current_user)):
    mock = [
        {"framework": "MapReduce (Disk I/O)", "time": 52.3},
        {"framework": "PySpark (In-Memory)", "time": 12.5}
    ]
    return load_json_or_mock("performance.json", mock)

@app.get("/api/surprising-insight")
def get_surprising_insight(current_user: dict = Depends(get_current_user)):
    mock = {
        "insight_title": "Weekend Admissions Spike Readmissions",
        "description": "Patients admitted on weekends for Heart Disease have an 8% higher readmission rate than weekday admissions. This highlights potential staffing or triage discrepancies on weekends.",
        "data": [
            {"disease": "Heart Disease", "weekday_rate": 0.17, "weekend_rate": 0.25},
            {"disease": "Diabetes", "weekday_rate": 0.12, "weekend_rate": 0.13},
            {"disease": "Sepsis", "weekday_rate": 0.20, "weekend_rate": 0.24}
        ]
    }
    return load_json_or_mock("surprising_insight.json", mock)

class PatientData(BaseModel):
    age_band: str
    disease: str
    treatment_cost: float
    gender: str

@app.post("/api/predict")
def predict_readmission(data: PatientData, current_user: dict = Depends(get_current_user)):
    if not rf_model:
        return {"prediction": "Error", "probability": "0%", "factors": ["Model not trained"]}
    
    try:
        # Create DataFrame for single inference
        df = pd.DataFrame([{
            'age_band': data.age_band,
            'disease': data.disease,
            'gender': data.gender,
            'treatment_cost': data.treatment_cost
        }])
        
        # Handle unseen labels by falling back to 0 (or a known class) to prevent crash
        def safe_transform(encoder, val):
            if val in encoder.classes_:
                return encoder.transform([val])[0]
            return 0
            
        df['age_encoded'] = safe_transform(le_age, data.age_band)
        df['disease_encoded'] = safe_transform(le_disease, data.disease)
        df['gender_encoded'] = safe_transform(le_gender, data.gender)
        
        X = df[['age_encoded', 'disease_encoded', 'gender_encoded', 'treatment_cost']]
        
        # Predict probability of class 1 (Readmitted = Yes)
        prob = rf_model.predict_proba(X)[0][1]
        prob_pct = round(prob * 100, 1)
        
        return {
            "prediction": "High Risk" if prob > 0.4 else "Low Risk",
            "probability": f"{prob_pct}%",
            "factors": ["Scikit-Learn Inference", "Real Model"]
        }
    except Exception as e:
        return {"prediction": "Error", "probability": "0%", "factors": [str(e)]}

# --- LAMBDA ARCHITECTURE: SPEED LAYER (STREAMING) ---
@app.websocket("/api/stream/vitals")
async def stream_vitals(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to real Kafka stream")
    
    consumer = AIOKafkaConsumer(
        'icu_vitals',
        bootstrap_servers='kafka:29092',
        value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        auto_offset_reset='latest'
    )

    try:
        await consumer.start()
        async for msg in consumer:
            vital_data = msg.value
            
            # Simple anomaly logic
            vital_data["anomaly_detected"] = False
            if vital_data.get("heart_rate", 0) > 120 or vital_data.get("oxygen_level", 100) < 90:
                vital_data["anomaly_detected"] = True
                
            await websocket.send_json(vital_data)
            
    except Exception as e:
        print(f"Streaming disconnected: {e}")
    finally:
        await consumer.stop()

# --- GEN AI LAYER: GROK CHATBOT ---
class ChatRequest(BaseModel):
    query: str

@app.post("/api/ask-grok")
async def ask_grok(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    api_key = os.getenv("GROK_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        return {"reply": "Please set your GROK_API_KEY in the backend .env file to talk to me!"}

    # Gather context from the Hadoop/Spark output
    kpis = load_json_or_mock("kpis.json", {})
    trends = load_json_or_mock("disease_trends.json", {})
    
    system_prompt = f"""
    You are a highly intelligent Data Engineering Assistant named 'HealthHadoop AI'. 
    You are answering questions about a hospital's big data analytics dashboard.
    Here is the latest data computed by Apache Spark:
    KPIs: {json.dumps(kpis)}
    Trends: {json.dumps(trends)[:200]}... (truncated)
    
    Answer the user's query concisely and professionally, referencing the data.
    """
    
    try:
        completion = await client.chat.completions.create(
            model="grok-beta",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.query}
            ],
        )
        return {"reply": completion.choices[0].message.content}
    except Exception as e:
        return {"reply": f"Grok API Error: {str(e)}"}
