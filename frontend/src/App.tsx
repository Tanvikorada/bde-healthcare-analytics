import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  Moon, Sun, Activity, Users, Map, AlertTriangle, Database, Cpu, Clock, Zap, Target, Upload, FileUp, CheckCircle2, XCircle, MessageSquare, Radio, Send
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- API Fetcher ---
const fetchApi = async (endpoint: string) => {
  try {
    const response = await fetch(`http://localhost:8000/api/${endpoint}`);
    if (!response.ok) throw new Error('API down');
    return await response.json();
  } catch (error) {
    console.warn(`Backend not reachable for ${endpoint}. Using fallback mock data.`);
    return new Promise((resolve) => {
      setTimeout(() => {
        switch (endpoint) {
          case 'kpis':
            resolve({ total_records_processed: "50,000", regions_analyzed: 5, top_disease: "Heart Disease", avg_readmission_rate: "15.4%" });
            break;
          case 'disease-trends':
            resolve([
              { year: 2020, Diabetes: 1200, "Heart Disease": 1350, Pneumonia: 800 },
              { year: 2021, Diabetes: 1250, "Heart Disease": 1400, Pneumonia: 750 },
              { year: 2022, Diabetes: 1300, "Heart Disease": 1500, Pneumonia: 900 },
              { year: 2023, Diabetes: 1400, "Heart Disease": 1600, Pneumonia: 850 },
            ]);
            break;
          case 'regional-burden':
            resolve([
              { region: "North", cases: 12500 },
              { region: "South", cases: 14200 },
              { region: "East", cases: 9800 },
              { region: "West", cases: 11500 },
              { region: "Midwest", cases: 10500 },
            ]);
            break;
          case 'readmission-rates':
            resolve([
              { region: "North", rate: 0.15 },
              { region: "South", rate: 0.17 },
              { region: "East", rate: 0.14 },
              { region: "West", rate: 0.16 },
              { region: "Midwest", rate: 0.14 },
            ]);
            break;
          case 'mapreduce-vs-spark':
            resolve([
              { framework: "MapReduce (Disk I/O)", time: 52.3 },
              { framework: "PySpark (In-Memory)", time: 12.5 },
            ]);
            break;
          case 'surprising-insight':
            resolve({
              insight_title: "Weekend Admissions Spike Readmissions",
              description: "Patients admitted on weekends have an 8% higher readmission rate across all regions, highlighting potential staffing or triage discrepancies on weekends vs weekdays.",
              data: [
                { disease: "Heart Disease", weekday_rate: 17, weekend_rate: 25 },
                { disease: "Diabetes", weekday_rate: 12, weekend_rate: 13 },
                { disease: "Sepsis", weekday_rate: 20, weekend_rate: 24 }
              ]
            });
            break;
          default:
            resolve(null);
        }
      }, 300);
    });
  }
};

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6", className)}>
    {children}
  </div>
);

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-muted rounded-md", className)} />
);

// --- Subcomponents ---

const LiveStreaming = () => {
  const [streamData, setStreamData] = useState<any[]>([]);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/api/stream/vitals');
    
    ws.onopen = () => setStatus('Connected to Kafka/Spark Streaming Speed Layer');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStreamData(prev => [...prev.slice(-19), data]);
    };
    ws.onerror = () => setStatus('WebSocket Error (Backend Offline)');
    ws.onclose = () => setStatus('Disconnected');

    return () => ws.close();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Radio className="h-6 w-6 text-red-500 animate-pulse" />
          <h2 className="text-2xl font-semibold tracking-tight">Live ICU Vitals (Speed Layer)</h2>
        </div>
        <div className={cn("text-sm font-medium px-3 py-1 rounded-full", status.includes('Connected') ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
          {status}
        </div>
      </div>
      
      <Card className="flex flex-col h-[500px]">
        <h3 className="text-lg font-semibold mb-2">Real-Time Patient Vitals Stream</h3>
        <p className="text-sm text-muted-foreground mb-6">Simulating a Kafka stream ingested by Spark Streaming for real-time anomaly detection.</p>
        <div className="flex-1 w-full relative">
          {streamData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Waiting for data stream...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={streamData}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                <XAxis dataKey="timestamp" stroke="currentColor" className="opacity-50 text-xs" />
                <YAxis stroke="currentColor" className="opacity-50 text-xs" domain={['dataMin - 10', 'dataMax + 10']} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="heart_rate" name="Heart Rate (bpm)" stroke="#ef4444" strokeWidth={2} isAnimationActive={false} dot={false} />
                <Line type="monotone" dataKey="blood_pressure_systolic" name="BP Systolic (mmHg)" stroke="#3b82f6" strokeWidth={2} isAnimationActive={false} dot={false} />
                <Line type="monotone" dataKey="oxygen_level" name="SpO2 (%)" stroke="#10b981" strokeWidth={2} isAnimationActive={false} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
};

const GrokChatbot = () => {
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hello! I am HealthHadoop AI, powered by xAI Grok. I have full context of the Apache Spark analysis on this dashboard. What would you like to know?" }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, I could not process that.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network Error connecting to Grok API.' }]);
    }
    setLoading(false);
  };

  return (
    <Card className="flex flex-col h-[600px] p-0 overflow-hidden">
      <div className="bg-muted/50 p-4 border-b border-border flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold tracking-tight">Grok Data Assistant</h3>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4" ref={scrollRef}>
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[80%] rounded-xl px-4 py-2 text-sm",
              msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted border border-border"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex w-full justify-start">
            <div className="bg-muted border border-border rounded-xl px-4 py-2 text-sm animate-pulse flex items-center gap-2">
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce delay-75"></div>
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-2 bg-background">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about readmission trends..."
          className="flex-1 bg-muted border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button type="submit" disabled={loading} className="bg-primary text-primary-foreground p-2 rounded-md hover:bg-primary/90 disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Card>
  );
};

// --- Main App ---

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'batch' | 'streaming' | 'ai'>('batch');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});
  
  // ML Form State
  const [mlForm, setMlForm] = useState({ age_band: '61-70', disease: 'Heart Disease', gender: 'M', treatment_cost: 5000 });
  const [prediction, setPrediction] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [kpis, trends, regions, readmissions, perf, insight] = await Promise.all([
      fetchApi('kpis'),
      fetchApi('disease-trends'),
      fetchApi('regional-burden'),
      fetchApi('readmission-rates'),
      fetchApi('mapreduce-vs-spark'),
      fetchApi('surprising-insight'),
    ]);
    setData({ kpis, trends, regions, readmissions, perf, insight });
    setLoading(false);
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadStatus('idle');
    setUploadMessage('Spark Cluster Processing Data...');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      
      if (res.ok) {
        setUploadStatus('success');
        setUploadMessage('Processing Complete! Dashboard Updated.');
        loadData(); // Re-fetch the newly generated data
      } else {
        setUploadStatus('error');
        setUploadMessage(result.detail || 'Processing failed');
      }
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage('Network error communicating with Spark backend.');
    }
    setIsUploading(false);
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setPredicting(true);
    try {
      const res = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mlForm)
      });
      if (res.ok) {
        setPrediction(await res.json());
      }
    } catch (err) {
      // Mock fallback if backend is down
      const baseRisk = mlForm.disease === 'Heart Disease' ? 0.35 : 0.15;
      const agePenalty = mlForm.age_band.includes('71') || mlForm.age_band.includes('81') ? 0.2 : 0;
      const risk = Math.min(0.95, baseRisk + agePenalty);
      setPrediction({
        model_used: "PySpark RandomForestClassifier (Fallback)",
        probability: `${(risk*100).toFixed(1)}%`,
        prediction: risk > 0.4 ? "High Risk" : "Low Risk",
        factors: ["Mock Fallback Mode"]
      });
    }
    setPredicting(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 font-sans selection:bg-primary/30">
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">HealthHadoop<span className="text-primary">.ai</span></span>
          </div>
          
          {/* Navigation Tabs */}
          <div className="hidden md:flex bg-muted p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('batch')} 
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === 'batch' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Batch Analytics
            </button>
            <button 
              onClick={() => setActiveTab('streaming')} 
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === 'streaming' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Live Streaming (Speed Layer)
            </button>
            <button 
              onClick={() => setActiveTab('ai')} 
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === 'ai' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              AI Insights
            </button>
          </div>

          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 space-y-16">
        <section className="py-12 md:py-24 flex flex-col items-center text-center space-y-6">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-4">
            <Zap className="h-4 w-4 mr-2" /> Lambda Architecture Capstone
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl">
            Uncovering Healthcare Insights at <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Petabyte Scale</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
            A full-stack Lambda Architecture demonstrating Apache Hadoop, Hive, Spark Streaming, and Grok Generative AI to analyze and predict hospital readmissions.
          </p>
        </section>

        {/* Mobile Tabs */}
        <div className="flex md:hidden bg-muted p-1 rounded-lg w-full overflow-x-auto mb-8">
            <button onClick={() => setActiveTab('batch')} className={cn("flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap", activeTab === 'batch' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Batch</button>
            <button onClick={() => setActiveTab('streaming')} className={cn("flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap", activeTab === 'streaming' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Streaming</button>
            <button onClick={() => setActiveTab('ai')} className={cn("flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap", activeTab === 'ai' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>AI Insights</button>
        </div>

        {/* --- TAB: BATCH ANALYTICS --- */}
        {activeTab === 'batch' && (
          <div className="space-y-16 animate-in fade-in duration-500">
            {/* Dynamic Dataset Upload */}
            <section className="flex flex-col items-center w-full max-w-xl mx-auto">
              <Card className="w-full relative overflow-hidden border-dashed border-2">
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
                    {isUploading ? <Activity className="h-8 w-8 animate-pulse" /> : <FileUp className="h-8 w-8" />}
                  </div>
                  <h3 className="text-xl font-bold mb-2">Upload Custom Dataset</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Drag & drop a CSV file to instantly trigger a PySpark job in the Batch Layer.
                  </p>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <button 
                      disabled={isUploading}
                      className="bg-primary text-primary-foreground font-semibold px-6 py-2 rounded-md flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? "Uploading & Processing..." : "Select CSV File"}
                    </button>
                  </div>

                  {uploadMessage && (
                    <div className={cn(
                      "mt-6 flex items-center gap-2 text-sm font-medium animate-in fade-in duration-300",
                      uploadStatus === 'success' ? "text-green-500" : 
                      uploadStatus === 'error' ? "text-red-500" : "text-blue-500"
                    )}>
                      {uploadStatus === 'success' && <CheckCircle2 className="h-4 w-4" />}
                      {uploadStatus === 'error' && <XCircle className="h-4 w-4" />}
                      {uploadStatus === 'idle' && <Activity className="h-4 w-4 animate-spin" />}
                      {uploadMessage}
                    </div>
                  )}
                </div>
              </Card>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Records Processed", icon: Database, value: data.kpis?.total_records_processed },
                { label: "Regions Analyzed", icon: Map, value: data.kpis?.regions_analyzed },
                { label: "Top Disease Volume", icon: Users, value: data.kpis?.top_disease },
                { label: "Avg Readmission Rate", icon: AlertTriangle, value: data.kpis?.avg_readmission_rate, color: "text-red-500" },
              ].map((kpi, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow group">
                  <div className="flex items-center justify-between pb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{kpi.label}</h3>
                    <kpi.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  {loading ? <Skeleton className="h-8 w-24 mt-2" /> : (
                    <div className={cn("text-3xl font-bold", kpi.color)}>{kpi.value}</div>
                  )}
                </Card>
              ))}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="flex flex-col h-[400px]">
                <h3 className="text-lg font-semibold mb-4">Year-over-Year Disease Trend</h3>
                <div className="flex-1 w-full">
                  {loading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                        <XAxis dataKey="year" stroke="currentColor" className="opacity-50 text-xs" />
                        <YAxis stroke="currentColor" className="opacity-50 text-xs" />
                        <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
                        <Legend />
                        <Line type="monotone" dataKey="Heart Disease" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Diabetes" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Pneumonia" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
              <Card className="flex flex-col h-[400px]">
                <h3 className="text-lg font-semibold mb-4">Regional Disease Burden</h3>
                <div className="flex-1 w-full">
                  {loading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.regions}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                        <XAxis dataKey="region" stroke="currentColor" className="opacity-50 text-xs" />
                        <YAxis stroke="currentColor" className="opacity-50 text-xs" />
                        <RechartsTooltip cursor={{fill: 'currentColor', opacity: 0.05}} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                        <Bar dataKey="cases" radius={[4, 4, 0, 0]}>
                          {data.regions?.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#60a5fa'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </section>
          </div>
        )}

        {/* --- TAB: STREAMING SPEED LAYER --- */}
        {activeTab === 'streaming' && (
          <div className="animate-in fade-in duration-500">
            <LiveStreaming />
          </div>
        )}

        {/* --- TAB: AI INSIGHTS & PREDICTION --- */}
        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <section className="space-y-6">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Target className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold tracking-tight">AI Readmission Predictor</h2>
              </div>
              <Card>
                <form onSubmit={handlePredict} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">Disease Category</label>
                    <select 
                      className="w-full bg-background border border-border rounded-md p-2"
                      value={mlForm.disease}
                      onChange={e => setMlForm({...mlForm, disease: e.target.value})}
                    >
                      <option>Heart Disease</option>
                      <option>Diabetes</option>
                      <option>Sepsis</option>
                      <option>Pneumonia</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">Age Band</label>
                    <select 
                      className="w-full bg-background border border-border rounded-md p-2"
                      value={mlForm.age_band}
                      onChange={e => setMlForm({...mlForm, age_band: e.target.value})}
                    >
                      <option>41-50</option>
                      <option>51-60</option>
                      <option>61-70</option>
                      <option>71-80</option>
                      <option>81-90</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">Treatment Cost ($)</label>
                    <input 
                      type="number"
                      className="w-full bg-background border border-border rounded-md p-2"
                      value={mlForm.treatment_cost}
                      onChange={e => setMlForm({...mlForm, treatment_cost: Number(e.target.value)})}
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={predicting}
                    className="w-full bg-primary text-primary-foreground font-semibold py-2 rounded-md hover:bg-primary/90 transition-colors"
                  >
                    {predicting ? "Running Inference..." : "Predict Readmission Risk"}
                  </button>
                </form>
              </Card>
              {prediction && (
                <Card className="bg-gradient-to-br from-card to-muted/20 flex flex-col justify-center items-center text-center p-8 animate-in zoom-in duration-300">
                  <h3 className="text-xl font-medium text-muted-foreground">Prediction Result</h3>
                  <div className={cn(
                    "text-6xl font-black mt-2",
                    prediction.prediction === "High Risk" ? "text-red-500" : "text-green-500"
                  )}>
                    {prediction.probability}
                  </div>
                  <div className="inline-block px-4 py-1 mt-4 rounded-full bg-background border border-border font-medium">
                    {prediction.prediction}
                  </div>
                </Card>
              )}
            </section>

            <section className="space-y-6 flex flex-col">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Cpu className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold tracking-tight">Chat with your Data</h2>
              </div>
              <GrokChatbot />
            </section>
          </div>
        )}
      </main>
      
      <footer className="border-t border-border mt-12 py-8 text-center text-sm text-muted-foreground">
        <p>Built for Big Data Essentials Capstone. Powered by React, FastAPI, Spark ML, and Grok AI.</p>
      </footer>
    </div>
  );
}

export default App;
