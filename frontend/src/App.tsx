import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  Activity, Users, Map, AlertTriangle, Database, Cpu, Target, Upload, FileUp, CheckCircle2, XCircle, MessageSquare, Radio, Send
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Environment Config ---
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const WS_BASE = API_BASE.replace(/^http/, 'ws');

// --- API Fetcher ---
const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const token = localStorage.getItem('token');
    const headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    const response = await fetch(`${API_BASE}/api/${endpoint}`, { ...options, headers });
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
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
  <div className={cn("bg-[var(--color-white)] text-[var(--color-pure-black)] rounded-[var(--radius-sm)] border border-[var(--color-mist)] p-[var(--card-padding)] transition-all duration-300", className)}>
    {children}
  </div>
);

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-[var(--color-cloud)] rounded-[var(--radius-sm)]", className)} />
);

// --- Subcomponents ---

const LiveStreaming = () => {
  const [streamData, setStreamData] = useState<any[]>([]);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/api/stream/vitals`);
    
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
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${API_BASE}/api/ask-grok`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: userMsg })
      });
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.reload();
        return;
      }
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, I could not process that.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network Error connecting to Grok API.' }]);
    }
    setLoading(false);
  };

  return (
    <Card className="flex flex-col h-[600px] p-0 overflow-hidden">
      <div className="bg-[var(--color-white)] border-b border-[var(--color-mist)] p-4 flex items-center gap-2 rounded-t-[var(--radius-sm)]">
        <MessageSquare className="h-5 w-5 text-[var(--color-pure-black)]" />
        <h3 className="text-[var(--text-heading-sm)] font-bold tracking-tight text-[var(--color-pure-black)]">Grok Data Assistant</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--color-paper)]">
        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[80%] rounded-[var(--radius-sm)] px-[var(--spacing-16)] py-[var(--spacing-16)] text-[var(--text-body-sm)] border border-[var(--color-mist)]",
              msg.role === 'user' ? "bg-[var(--color-pure-black)] text-[var(--color-white)]" : "bg-[var(--color-white)] text-[var(--color-pure-black)] shadow-sm"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-white)] border border-[var(--color-mist)] rounded-[var(--radius-sm)] px-[var(--spacing-16)] py-[var(--spacing-16)] text-sm animate-pulse flex items-center gap-2">
              <div className="h-2 w-2 bg-[var(--color-iron)] rounded-full animate-bounce"></div>
              <div className="h-2 w-2 bg-[var(--color-iron)] rounded-full animate-bounce delay-75"></div>
              <div className="h-2 w-2 bg-[var(--color-iron)] rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-[var(--spacing-16)] border-t border-[var(--color-mist)] flex gap-2 bg-[var(--color-white)] rounded-b-[var(--radius-sm)]">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Grok about anomalies, predictions, or trends..."
          className="flex-1 bg-[var(--color-white)] border border-[var(--color-mist)] rounded-[var(--radius-inputs)] px-4 py-3 text-[var(--text-body-sm)] text-[var(--color-pure-black)] focus:outline-none focus:border-[var(--color-pure-black)] transition-colors"
        />
        <button type="submit" disabled={loading} className="bg-[var(--color-pure-black)] text-[var(--color-white)] px-[20px] py-[10px] rounded-[var(--radius-buttons)] hover:bg-[var(--color-obsidian)] disabled:opacity-50 transition-colors shadow-sm">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Card>
  );
};

// --- Main App ---

function App() {
  const [darkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'batch' | 'streaming' | 'ai'>('batch');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  
  // Login State
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loginError, setLoginError] = useState('');
  
  // ML Form State
  const [mlForm, setMlForm] = useState({ age_band: '51-60', disease: 'Heart Disease', treatment_cost: 15000, gender: 'Male' });
  const [prediction, setPrediction] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  const loadData = async () => {
    if (!token) return;
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
    loadData();
  }, []);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await fetch(`${API_BASE}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Invalid credentials');
      }
      
      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
    } catch (err) {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadStatus('idle');
    setUploadMessage('Spark Cluster Processing Data...');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers,
        body: formData
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
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
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/predict`, {
        method: 'POST',
        headers,
        body: JSON.stringify(mlForm)
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.reload();
        return;
      }
      const data = await res.json();
      setPrediction(data);
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

  if (!token) {
    return (
      <div className="min-h-screen font-sans antialiased flex flex-col items-center justify-center bg-[var(--color-cloud)]">
        <Card className="w-full max-w-md relative z-10 p-[var(--spacing-32)] space-y-[var(--spacing-32)] shadow-sm">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-[48px] h-[48px] rounded-[var(--radius-sm)] bg-[var(--color-paper)] border border-[var(--color-mist)] text-[var(--color-pure-black)] mb-[var(--spacing-24)]">
              <Activity className="h-6 w-6" />
            </div>
            <h1 className="text-[var(--text-heading)] leading-[var(--leading-heading)] font-bold tracking-tight text-[var(--color-pure-black)] mb-[var(--spacing-16)] font-fraktion">
              Login
            </h1>
            <p className="text-[var(--text-body)] text-[var(--color-iron)] max-w-[640px] mx-auto">
              Secure access to BDE Healthcare Analytics
            </p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-[var(--spacing-24)] mt-[var(--spacing-32)]">
            <div>
              <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--color-graphite)] tracking-wider uppercase">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-[var(--color-white)] border border-[var(--color-mist)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] text-[var(--color-pure-black)] focus:outline-none focus:border-[var(--color-pure-black)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--color-graphite)] tracking-wider uppercase">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[var(--color-white)] border border-[var(--color-mist)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] text-[var(--color-pure-black)] focus:outline-none focus:border-[var(--color-pure-black)] transition-colors"
              />
            </div>
            {loginError && <p className="text-[var(--color-pure-black)] text-[var(--text-body-sm)] font-medium">{loginError}</p>}
            <button 
              type="submit" 
              className="w-full bg-[var(--color-pure-black)] text-[var(--color-white)] rounded-[var(--radius-buttons)] font-medium px-[var(--spacing-24)] py-[12px] shadow-sm hover:bg-[var(--color-obsidian)] transition-colors"
            >
              Sign In
            </button>
          </form>
          <div className="text-center text-[var(--text-caption)] text-[var(--color-steel)] mt-[var(--spacing-24)]">
            Default credentials: admin / admin123
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-cloud)]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Activity className="h-12 w-12 text-[var(--color-pure-black)] animate-bounce" />
          <p className="text-[var(--text-subheading)] font-medium tracking-tight text-[var(--color-pure-black)]">Initializing Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans antialiased selection:bg-[var(--color-glacier-tint)] selection:text-[var(--color-pure-black)] bg-[var(--color-cloud)]">
      <div className="relative z-10 w-full">
        {/* Top Navigation - Glassnode style */}
        <header className="w-full bg-[var(--color-white)] border-b border-[var(--color-mist)] h-[64px] flex items-center px-[var(--spacing-24)] justify-between animate-in slide-in-from-top-4 duration-500 sticky top-0 z-50">
          <div className="flex items-center gap-[var(--spacing-8)]">
            <Activity className="h-5 w-5 text-[var(--color-pure-black)]" />
            <span className="text-[var(--text-subheading)] font-bold tracking-tight text-[var(--color-pure-black)]">glassnode</span>
            <span className="text-[var(--text-body-sm)] text-[var(--color-iron)] ml-2 border-l border-[var(--color-mist)] pl-2">BDE Healthcare</span>
          </div>
          <div className="flex items-center gap-[var(--spacing-16)]">
            <button
              onClick={() => {
                localStorage.removeItem('token');
                window.location.reload();
              }}
              className="bg-transparent text-[var(--color-pure-black)] font-medium text-[var(--text-body-sm)] px-[20px] py-[10px] rounded-[var(--radius-buttons)] hover:bg-[var(--color-paper)] transition-colors"
            >
              Log out
            </button>
            <button className="bg-[var(--color-pure-black)] text-[var(--color-white)] font-medium text-[var(--text-body-sm)] px-[20px] py-[10px] rounded-[var(--radius-buttons)] shadow-sm hover:bg-[var(--color-obsidian)] transition-colors">
              Launch Studio
            </button>
          </div>
        </header>

      <nav className="w-full mb-[var(--section-gap)]">
        <div className="flex items-center justify-center">
          <div className="hidden md:flex bg-[var(--color-paper)] p-1 rounded-[var(--radius-sm)] border border-[var(--color-mist)]">
            <button 
              onClick={() => setActiveTab('batch')} 
              className={cn("px-[20px] py-[8px] text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all border", activeTab === 'batch' ? "bg-[var(--color-pure-black)] border-[var(--color-pure-black)] text-[var(--color-white)]" : "bg-transparent border-transparent text-[var(--color-iron)] hover:text-[var(--color-pure-black)]")}
            >
              Batch Analytics
            </button>
            <button 
              onClick={() => setActiveTab('streaming')} 
              className={cn("px-[20px] py-[8px] text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all border", activeTab === 'streaming' ? "bg-[var(--color-pure-black)] border-[var(--color-pure-black)] text-[var(--color-white)]" : "bg-transparent border-transparent text-[var(--color-iron)] hover:text-[var(--color-pure-black)]")}
            >
              Live Streaming (Speed Layer)
            </button>
            <button 
              onClick={() => setActiveTab('ai')} 
              className={cn("px-[20px] py-[8px] text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all border", activeTab === 'ai' ? "bg-[var(--color-pure-black)] border-[var(--color-pure-black)] text-[var(--color-white)]" : "bg-transparent border-transparent text-[var(--color-iron)] hover:text-[var(--color-pure-black)]")}
            >
              AI Insights
            </button>
          </div>
        </div>
      </nav>

      <main className="w-full pb-16">
        <section className="w-full max-w-[var(--page-max-width)] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24 flex flex-col items-start md:items-center md:text-center space-y-[var(--spacing-24)]">
          <div className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--color-mist)] bg-[var(--color-white)] pl-1 pr-3 py-1 mb-4">
            <div className="bg-[var(--color-pure-black)] text-[var(--color-white)] rounded-[1px] w-6 h-6 flex items-center justify-center text-[12px] font-medium mr-2">1</div>
            <span className="text-[12px] font-medium text-[var(--color-badge-slate)] uppercase">LAMBDA ARCHITECTURE</span>
          </div>
          <h1 className="text-[var(--text-display)] leading-[var(--leading-display)] font-bold text-[var(--color-pure-black)] max-w-4xl font-fraktion">
            Uncovering Healthcare Insights <span className="bg-[var(--color-glacier-tint)] px-2">at Petabyte Scale</span>
          </h1>
          <p className="text-[var(--text-heading-sm)] text-[var(--color-iron)] max-w-[800px] leading-relaxed mx-auto font-medium">
            A full-stack Lambda Architecture demonstrating Apache Hadoop, Hive, Spark Streaming, and Grok Generative AI to analyze and predict hospital readmissions.
          </p>
        </section>

        {/* Mobile Tabs */}
        <div className="flex md:hidden gap-[var(--spacing-8)] w-full overflow-x-auto mb-[var(--section-gap)] pb-2 px-4">
            <button onClick={() => setActiveTab('batch')} className={cn("flex-1 px-4 py-2 text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all whitespace-nowrap border", activeTab === 'batch' ? "bg-[var(--color-pure-black)] border-[var(--color-pure-black)] text-[var(--color-white)]" : "bg-[var(--color-white)] border-[var(--color-mist)] text-[var(--color-pure-black)]")}>Batch</button>
            <button onClick={() => setActiveTab('streaming')} className={cn("flex-1 px-4 py-2 text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all whitespace-nowrap border", activeTab === 'streaming' ? "bg-[var(--color-pure-black)] border-[var(--color-pure-black)] text-[var(--color-white)]" : "bg-[var(--color-white)] border-[var(--color-mist)] text-[var(--color-pure-black)]")}>Streaming</button>
            <button onClick={() => setActiveTab('ai')} className={cn("flex-1 px-4 py-2 text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all whitespace-nowrap border", activeTab === 'ai' ? "bg-[var(--color-pure-black)] border-[var(--color-pure-black)] text-[var(--color-white)]" : "bg-[var(--color-white)] border-[var(--color-mist)] text-[var(--color-pure-black)]")}>AI Insights</button>
        </div>

        {/* --- TAB: BATCH ANALYTICS --- */}
        {activeTab === 'batch' && (
          <div className="w-full max-w-[var(--page-max-width)] mx-auto px-4 sm:px-6 lg:px-8 space-y-[var(--spacing-80)] animate-in fade-in duration-500">
            {/* Dynamic Dataset Upload */}
            <section className="flex flex-col items-center w-full max-w-xl mx-auto">
              <Card className="w-full relative overflow-hidden bg-[var(--color-white)]">
                <div className="flex flex-col items-center justify-center p-[var(--spacing-32)] text-center">
                  <div className="p-[var(--spacing-16)] rounded-[var(--radius-sm)] border border-[var(--color-mist)] bg-[var(--color-paper)] text-[var(--color-pure-black)] mb-[var(--spacing-16)]">
                    {isUploading ? <Activity className="h-8 w-8 animate-pulse text-[var(--color-iron)]" /> : <FileUp className="h-8 w-8 text-[var(--color-iron)]" />}
                  </div>
                  <h3 className="text-[var(--text-heading-sm)] font-bold mb-[var(--spacing-8)] text-[var(--color-pure-black)]">Upload Custom Dataset</h3>
                  <p className="text-[var(--text-body)] text-[var(--color-iron)] mb-[var(--spacing-24)]">
                    Drag & drop a CSV file to instantly trigger a PySpark job in the Batch Layer.
                  </p>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
                    />
                    <button 
                      disabled={isUploading}
                      className="bg-[var(--color-pure-black)] text-[var(--color-white)] font-medium px-[24px] py-[12px] rounded-[var(--radius-buttons)] flex items-center gap-2 hover:bg-[var(--color-obsidian)] transition-colors disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? "Uploading & Processing..." : "Select CSV File"}
                    </button>
                  </div>

                  {uploadMessage && (
                    <div className={cn(
                      "mt-[var(--spacing-24)] flex items-center gap-2 text-[var(--text-caption)] font-medium animate-in fade-in duration-300",
                      uploadStatus === 'success' ? "text-[#10b981]" : 
                      uploadStatus === 'error' ? "text-[#ef4444]" : "text-[var(--color-pure-black)]"
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
                <Card key={i} className="hover:-translate-y-1 transition-transform group">
                  <div className="flex items-center justify-between pb-2">
                    <h3 className="text-[var(--text-caption)] font-medium text-[var(--color-iron)] uppercase tracking-wider">{kpi.label}</h3>
                    <kpi.icon className="h-4 w-4 text-[var(--color-iron)] group-hover:text-[var(--color-pure-black)] transition-colors" />
                  </div>
                  <div className="mt-2">
                    <div className={cn("text-[var(--text-heading)] font-medium text-[var(--color-pure-black)]", kpi.color === "text-red-500" ? "text-[#ef4444]" : "")}>{kpi.value}</div>
                  </div>
                </Card>
              ))}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="flex flex-col h-[400px]">
                <h3 className="text-[var(--text-heading-sm)] font-medium mb-4">Year-over-Year Disease Trend</h3>
                <div className="flex-1 w-full">
                  {loading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mist)" className="opacity-50" />
                        <XAxis dataKey="year" stroke="var(--color-iron)" className="text-[12px]" />
                        <YAxis stroke="var(--color-iron)" className="text-[12px]" />
                        <RechartsTooltip contentStyle={{ backgroundColor: 'var(--color-white)', borderColor: 'var(--color-mist)', borderRadius: 'var(--radius-sm)', color: 'var(--color-pure-black)' }} itemStyle={{ color: 'var(--color-pure-black)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="Heart Disease" stroke="var(--color-pure-black)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Diabetes" stroke="var(--color-graphite)" strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="Pneumonia" stroke="var(--color-iron)" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
              <Card className="flex flex-col h-[400px]">
                <h3 className="text-[var(--text-heading-sm)] font-medium mb-4">Regional Disease Burden</h3>
                <div className="flex-1 w-full">
                  {loading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.regions}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mist)" className="opacity-50" vertical={false} />
                        <XAxis dataKey="region" stroke="var(--color-iron)" className="text-[12px]" />
                        <YAxis stroke="var(--color-iron)" className="text-[12px]" />
                        <RechartsTooltip cursor={{fill: 'var(--color-paper)'}} contentStyle={{ backgroundColor: 'var(--color-white)', borderColor: 'var(--color-mist)', borderRadius: 'var(--radius-sm)', color: 'var(--color-pure-black)' }} itemStyle={{ color: 'var(--color-pure-black)' }} />
                        <Bar dataKey="cases" radius={[4, 4, 0, 0]}>
                          {data.regions?.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--color-pure-black)' : 'var(--color-graphite)'} />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500 max-w-[var(--page-max-width)] mx-auto px-4 sm:px-6 lg:px-8">
            <section className="space-y-6">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Target className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-pure-black)]">AI Readmission Predictor</h2>
              </div>
              <Card>
                <form onSubmit={handlePredict} className="space-y-[var(--spacing-16)]">
                  <div>
                    <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--color-iron)] uppercase tracking-wider">Disease Category</label>
                    <select 
                      className="w-full bg-[var(--color-white)] border border-[var(--color-mist)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--color-pure-black)] transition-colors text-[var(--color-pure-black)]"
                      value={mlForm.disease}
                      onChange={e => setMlForm({...mlForm, disease: e.target.value})}
                    >
                      <option>Heart Disease</option>
                      <option>Diabetes</option>
                      <option>Pneumonia</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--color-iron)] uppercase tracking-wider">Age Band</label>
                    <select 
                      className="w-full bg-[var(--color-white)] border border-[var(--color-mist)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--color-pure-black)] transition-colors text-[var(--color-pure-black)]"
                      value={mlForm.age_band}
                      onChange={e => setMlForm({...mlForm, age_band: e.target.value})}
                    >
                      <option>41-50</option>
                      <option>51-60</option>
                      <option>61-70</option>
                      <option>71-80</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--color-iron)] uppercase tracking-wider">Treatment Cost ($)</label>
                    <input 
                      type="number" 
                      className="w-full bg-[var(--color-white)] border border-[var(--color-mist)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--color-pure-black)] transition-colors text-[var(--color-pure-black)]"
                      value={mlForm.treatment_cost}
                      onChange={e => setMlForm({...mlForm, treatment_cost: parseInt(e.target.value)})}
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={predicting}
                    className="w-full bg-[var(--color-pure-black)] text-[var(--color-white)] rounded-[var(--radius-buttons)] font-medium px-[var(--spacing-24)] py-[12px] mt-[var(--spacing-24)] hover:bg-[var(--color-obsidian)] transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {predicting ? "Running Model..." : "Predict Readmission Risk"}
                  </button>
                </form>
              </Card>
              {prediction && (
                <Card className="flex flex-col items-center justify-center text-center p-[var(--spacing-32)] border border-[var(--color-mist)] bg-[var(--color-paper)]">
                  <div className="animate-in zoom-in duration-300">
                    <h3 className="text-[var(--text-caption)] font-medium text-[var(--color-iron)] uppercase tracking-wider">Prediction Result</h3>
                    <div className={cn(
                      "text-[var(--text-display)] font-bold mt-[var(--spacing-16)] mb-[var(--spacing-8)]",
                      prediction.prediction === "High Risk" ? "text-[#ef4444]" : "text-[#10b981]"
                    )}>
                      {prediction.probability}
                    </div>
                    <div className="inline-block px-[var(--spacing-16)] py-[var(--spacing-8)] mt-[var(--spacing-16)] rounded-[var(--radius-sm)] bg-[var(--color-white)] border border-[var(--color-mist)] text-[var(--text-body-sm)] font-medium text-[var(--color-pure-black)] shadow-sm">
                      {prediction.prediction}
                    </div>
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
    </div>
  );
}

export default App;
