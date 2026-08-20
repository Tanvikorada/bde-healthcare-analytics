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

load_dotenv()

app = FastAPI(title="Healthcare Data Analytics API")

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
def get_kpis():
    mock = {
        "total_records_processed": "50,000",
        "regions_analyzed": 5,
        "top_disease": "Heart Disease",
        "avg_readmission_rate": "15.4%"
    }
    return load_json_or_mock("kpis.json", mock)

@app.get("/api/disease-trends")
def get_disease_trends():
    mock = [
        {"year": 2020, "Diabetes": 1200, "Heart Disease": 1350, "Pneumonia": 800},
        {"year": 2021, "Diabetes": 1250, "Heart Disease": 1400, "Pneumonia": 750},
        {"year": 2022, "Diabetes": 1300, "Heart Disease": 1500, "Pneumonia": 900},
        {"year": 2023, "Diabetes": 1400, "Heart Disease": 1600, "Pneumonia": 850},
    ]
    return load_json_or_mock("disease_trends.json", mock)

@app.get("/api/regional-burden")
def get_regional_burden():
    mock = [
        {"region": "North", "cases": 12500},
        {"region": "South", "cases": 14200},
        {"region": "East", "cases": 9800},
        {"region": "West", "cases": 11500},
        {"region": "Midwest", "cases": 10500},
    ]
    return load_json_or_mock("regional_burden.json", mock)

@app.get("/api/readmission-rates")
def get_readmission_rates():
    mock = [
        {"region": "North", "Diabetes": 0.12, "Heart Disease": 0.18},
        {"region": "South", "Diabetes": 0.14, "Heart Disease": 0.20},
        {"region": "East", "Diabetes": 0.11, "Heart Disease": 0.17},
        {"region": "West", "Diabetes": 0.13, "Heart Disease": 0.19},
        {"region": "Midwest", "Diabetes": 0.12, "Heart Disease": 0.16},
    ]
    return load_json_or_mock("readmission_rates.json", mock)

@app.get("/api/mapreduce-vs-spark")
def get_performance_comparison():
    mock = [
        {"framework": "MapReduce (Disk I/O)", "time": 52.3},
        {"framework": "PySpark (In-Memory)", "time": 12.5}
    ]
    return load_json_or_mock("performance.json", mock)

@app.get("/api/surprising-insight")
def get_surprising_insight():
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
def predict_readmission(data: PatientData):
    # This is a mock Spark MLlib inference endpoint
    # In a production environment, this would load the random_forest_model.model
    # and call model.transform(data)
    
    # We will simulate the Random Forest logic
    risk_score = 0
    if data.age_band in ['61-70', '71-80', '81+']:
        risk_score += 40
    if data.disease in ['Heart Disease', 'Diabetes']:
        risk_score += 30
    if data.treatment_cost > 10000:
        risk_score += 20
        
    base_prob = risk_score + random.randint(-10, 10)
    final_prob = min(max(base_prob, 5), 95) # Clamp between 5 and 95
    
    return {
        "prediction": "High Risk" if final_prob > 50 else "Low Risk",
        "probability": f"{final_prob}%",
        "factors": ["Age bracket", "Historical disease complexity"] if final_prob > 50 else ["Standard profile"]
    }

# --- LAMBDA ARCHITECTURE: SPEED LAYER (STREAMING) ---
@app.websocket("/api/stream/vitals")
async def stream_vitals(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to live ICU stream")
    try:
        while True:
            # Simulate real-time streaming data from Kafka/Spark Streaming
            vital_data = {
                "timestamp": __import__('datetime').datetime.now().strftime("%H:%M:%S"),
                "heart_rate": random.randint(60, 140),
                "blood_pressure_systolic": random.randint(90, 180),
                "oxygen_level": random.randint(85, 100),
                "anomaly_detected": False
            }
            # Simple anomaly logic
            if vital_data["heart_rate"] > 120 or vital_data["oxygen_level"] < 90:
                vital_data["anomaly_detected"] = True
                
            await websocket.send_json(vital_data)
            await asyncio.sleep(1.0) # Stream every second
    except Exception as e:
        print(f"Streaming disconnected: {e}")

# --- GEN AI LAYER: GROK CHATBOT ---
class ChatRequest(BaseModel):
    query: str

@app.post("/api/chat")
async def chat_with_data(req: ChatRequest):
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
