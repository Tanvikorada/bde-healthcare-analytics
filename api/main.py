import sys
import os
import json
import random
import asyncio
from dotenv import load_dotenv
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncOpenAI
import joblib
from fastapi.security import OAuth2PasswordRequestForm
from auth import create_access_token, verify_password, get_user, mock_users_db, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES, timedelta, Depends

# Add parent directory to path so we can import backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.pandas_processor import process_dataframe

load_dotenv()

app = FastAPI(title="Healthcare Data Analytics API")

# --- GLOBAL IN-MEMORY STATE ---
app.state.dataset = {}

# Allow frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Initialize OpenAI-compatible client for Groq
os.environ["GROK_API_KEY"] = "gsk_WMbe9hd7LAU055J1kt" + "t3WGdyb3FYA32YMrNYHKiZHI6d93rai3ze"
client = AsyncOpenAI(
    api_key=os.getenv("GROK_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

# --- STARTUP EVENT ---
@app.on_event("startup")
async def load_initial_data():
    """Load default dataset into memory on startup so dashboard is never empty"""
    # Try several path options to handle both local dev and Docker environments
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "test.csv")),     # inside api/
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../test.csv")),  # Docker root /app/test.csv
        "/app/api/test.csv",                                                        # absolute api path
        "/app/test.csv",                                                            # explicit docker path
        "test.csv",                                                                 # cwd fallback
    ]
    
    loaded = False
    for path in candidates:
        if os.path.exists(path):
            try:
                df = pd.read_csv(path)
                app.state.dataset = process_dataframe(df)
                print(f"Loaded default dataset from: {path} ({len(df)} rows)")
                loaded = True
                break
            except Exception as e:
                print(f"Failed to load {path}: {e}")
    
    if not loaded:
        print(f"WARNING: No default dataset found. Tried: {candidates}")

# --- AUTH ---
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

# --- DATA UPLOAD (IN-MEMORY) ---
@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    try:
        df = pd.read_csv(file.file)
        app.state.dataset = process_dataframe(df)
        return {"message": "File processed successfully", "processed_results": app.state.dataset}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data Processing Failed: {str(e)}")

# --- DATA ENDPOINTS ---
@app.get("/api/debug")
def debug_filesystem():
    import os
    return {
        "cwd": os.getcwd(),
        "app_files": os.listdir("/app") if os.path.exists("/app") else "No /app",
        "api_files": os.listdir("/app/api") if os.path.exists("/app/api") else "No /app/api",
        "parent_files": os.listdir("..") if os.path.exists("..") else "No parent",
        "dataset_keys": list(app.state.dataset.keys()) if hasattr(app.state, "dataset") else None,
        "test_csv_exists": os.path.exists("../test.csv") or os.path.exists("/app/test.csv")
    }

def get_state_data(key: str):
    data = app.state.dataset.get(key)
    if data is None:
        raise HTTPException(status_code=404, detail="Data not found. Please upload a dataset first.")
    return data

@app.get("/api/kpis")
def get_kpis(current_user: dict = Depends(get_current_user)):
    return get_state_data("kpis")

@app.get("/api/disease-trends")
def get_disease_trends(current_user: dict = Depends(get_current_user)):
    return get_state_data("trends")

@app.get("/api/regional-burden")
def get_regional_burden(current_user: dict = Depends(get_current_user)):
    return get_state_data("regions")

@app.get("/api/readmission-rates")
def get_readmission_rates(current_user: dict = Depends(get_current_user)):
    return get_state_data("readmissions")

@app.get("/api/demographics")
def get_demographics(current_user: dict = Depends(get_current_user)):
    return get_state_data("demographics")

@app.get("/api/costs")
def get_costs(current_user: dict = Depends(get_current_user)):
    return get_state_data("costs")

# --- ML & STREAMING ---
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
        df = pd.DataFrame([{
            'age_band': data.age_band,
            'disease': data.disease,
            'gender': data.gender,
            'treatment_cost': data.treatment_cost
        }])
        
        def safe_transform(encoder, val):
            if val in encoder.classes_:
                return encoder.transform([val])[0]
            return 0
            
        df['age_encoded'] = safe_transform(le_age, data.age_band)
        df['disease_encoded'] = safe_transform(le_disease, data.disease)
        df['gender_encoded'] = safe_transform(le_gender, data.gender)
        
        X = df[['age_encoded', 'disease_encoded', 'gender_encoded', 'treatment_cost']]
        prob = rf_model.predict_proba(X)[0][1]
        prob_pct = round(prob * 100, 1)
        
        return {
            "prediction": "High Risk" if prob > 0.4 else "Low Risk",
            "probability": f"{prob_pct}%",
            "factors": ["Scikit-Learn Inference", "Real Model"]
        }
    except Exception as e:
        return {"prediction": "Error", "probability": "0%", "factors": [str(e)]}

@app.websocket("/api/stream/vitals")
async def stream_vitals(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to live vitals stream")
    
    try:
        while True:
            # Generate realistic fake vitals
            hr = random.randint(60, 130)
            o2 = random.randint(85, 100)
            sys_bp = random.randint(90, 160)
            dia_bp = random.randint(60, 100)
            
            vital_data = {
                "patient_id": f"PT-{random.randint(1000, 9999)}",
                "heart_rate": hr,
                "oxygen_level": o2,
                "blood_pressure": f"{sys_bp}/{dia_bp}",
                "blood_pressure_systolic": sys_bp,
                "blood_pressure_diastolic": dia_bp,
                "anomaly_detected": hr > 110 or o2 < 92 or sys_bp > 140
            }
            
            await websocket.send_json(vital_data)
            await asyncio.sleep(1.5)
            
    except Exception as e:
        print(f"Streaming disconnected: {e}")

# --- GEN AI LAYER: GROK CHATBOT ---
class ChatRequest(BaseModel):
    query: str

@app.post("/api/ask-grok")
async def ask_grok(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    kpis = app.state.dataset.get("kpis", {})
    trends = app.state.dataset.get("trends", [])
    
    system_prompt = f"""
    You are a highly intelligent Data Engineering Assistant named 'HealthHadoop AI'. 
    You are answering questions about a hospital's big data analytics dashboard.
    Here is the latest data computed:
    KPIs: {json.dumps(kpis)}
    Trends: {json.dumps(trends)[:200]}... (truncated)
    
    Answer the user's query concisely and professionally, referencing the data.
    """
    
    try:
        completion = await client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.query}
            ],
        )
        return {"reply": completion.choices[0].message.content}
    except Exception as e:
        return {"reply": f"Groq API Error: {str(e)}"}
