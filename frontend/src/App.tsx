import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Activity, Users, Map, AlertTriangle, Database, Cpu, Target, Upload, FileUp, CheckCircle2, XCircle, MessageSquare, Radio, Send, Sun, Moon, DollarSign, HeartPulse, PieChart, TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Environment Config ---
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const WS_BASE = API_BASE.replace(/^http/, 'ws');

const TREND_COLORS = ['#ef4444', '#06b6d4', '#a855f7', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];

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
    console.warn(`Backend not reachable for ${endpoint} or data empty. Returning null.`);
    return null;
  }
};

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-color)] p-[var(--card-padding)] transition-all duration-300", className)}>
    {children}
  </div>
);

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-[var(--bg-secondary)] rounded-[var(--radius-sm)]", className)} />
);

// --- Subcomponents ---

const LiveStreaming = () => {
  const [streamData, setStreamData] = useState<any[]>([]);
  const [status, setStatus] = useState('Connecting...');
  const [latestVital, setLatestVital] = useState<any>(null);
  const [anomalyAlert, setAnomalyAlert] = useState(false);
  const tickRef = useRef(0);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/api/stream/vitals`);
    
    ws.onopen = () => setStatus('Live — Real-Time Vitals Stream');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      tickRef.current += 1;
      const entry = { ...data, tick: tickRef.current };
      setLatestVital(entry);
      setAnomalyAlert(!!data.anomaly_detected);
      setStreamData(prev => [...prev.slice(-29), entry]);
    };
    ws.onerror = () => setStatus('WebSocket Error — Backend Offline');
    ws.onclose = () => setStatus('Disconnected');

    return () => ws.close();
  }, []);

  return (
    <div className="space-y-4 w-full max-w-[var(--page-max-width)] mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-red-500 animate-pulse" />
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Live ICU Vitals Monitor</h2>
        </div>
        <div className={cn("text-xs font-semibold px-3 py-1 rounded-full border", status.includes('Live') ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30")}>
          {status}
        </div>
      </div>

      {/* Anomaly Alert Banner */}
      {anomalyAlert && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg px-4 py-3 font-semibold text-sm"
        >
          <AlertTriangle className="h-5 w-5 animate-pulse flex-shrink-0" />
          <span>ANOMALY DETECTED — Patient vitals outside safe thresholds! Immediate review required.</span>
        </motion.div>
      )}

      {/* Live Stats Cards */}
      {latestVital && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Heart Rate", value: `${latestVital.heart_rate} bpm`, alert: latestVital.heart_rate > 110, color: "#ef4444" },
            { label: "SpO2", value: `${latestVital.oxygen_level}%`, alert: latestVital.oxygen_level < 92, color: "#10b981" },
            { label: "BP (Systolic)", value: `${latestVital.blood_pressure_systolic} mmHg`, alert: latestVital.blood_pressure_systolic > 140, color: "#3b82f6" },
            { label: "Patient ID", value: latestVital.patient_id, alert: false, color: "var(--text-secondary)" },
          ].map((stat, i) => (
            <Card key={i} className={cn("text-center transition-all", stat.alert ? "border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]" : "")}>
              <div className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mb-1">{stat.label}</div>
              <div className="text-2xl font-bold" style={{ color: stat.alert ? "#ef4444" : stat.color }}>{stat.value}</div>
              {stat.alert && <div className="text-xs text-red-400 mt-1 animate-pulse">CRITICAL</div>}
            </Card>
          ))}
        </div>
      )}

      {/* Chart */}
      <Card className="h-[380px] flex flex-col">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Real-Time Vitals Chart</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Heart Rate (bpm) · BP Systolic (mmHg) · SpO2 (%)</p>
        </div>
        <div className="flex-1 w-full">
          {streamData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-sm">Connecting to stream...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={streamData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} vertical={false} />
                <XAxis dataKey="tick" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'Time (ticks)', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: 'var(--text-secondary)' }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[50, 180]} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
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
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hello! I am HealthHadoop AI, powered by Groq. I have full context of the analytics on this dashboard. What would you like to know?" }]);
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network Error connecting to AI backend.' }]);
    }
    setLoading(false);
  };

  return (
    <Card className="flex flex-col h-[600px] p-0 overflow-hidden">
      <div className="bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border-b border-[var(--border-color)] p-4 flex items-center justify-between rounded-t-[var(--radius-sm)]">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[var(--text-primary)]" />
          <h3 className="text-[var(--text-heading-sm)] font-bold tracking-tight text-[var(--text-primary)]">HealthHadoop AI Assistant</h3>
          <span className="text-[10px] px-2 py-0.5 bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded-full font-semibold">Groq AI</span>
        </div>
        <button
          onClick={() => setMessages([{ role: 'assistant', content: "Hello! I am HealthHadoop AI, powered by Groq. I have full context of the analytics on this dashboard. What would you like to know?" }])}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
        >
          Clear chat
        </button>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-secondary)]">
        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[80%] whitespace-pre-wrap break-words rounded-[var(--radius-sm)] px-[var(--spacing-16)] py-[var(--spacing-16)] text-[var(--text-body-sm)] border border-[var(--border-color)]",
              msg.role === 'user' ? "bg-[var(--accent-primary)] text-[var(--accent-fg)]" : "bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] text-[var(--text-primary)] shadow-sm"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-sm)] px-[var(--spacing-16)] py-[var(--spacing-16)] text-sm animate-pulse flex items-center gap-2">
              <div className="h-2 w-2 bg-[var(--text-secondary)] rounded-full animate-bounce"></div>
              <div className="h-2 w-2 bg-[var(--text-secondary)] rounded-full animate-bounce delay-75"></div>
              <div className="h-2 w-2 bg-[var(--text-secondary)] rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-[var(--spacing-16)] border-t border-[var(--border-color)] flex gap-2 bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] rounded-b-[var(--radius-sm)]">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about trends, anomalies, readmissions..."
          className="flex-1 bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] px-4 py-3 text-[var(--text-body-sm)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
        />
        <button type="submit" disabled={loading} className="bg-[var(--accent-primary)] text-[var(--accent-fg)] px-[20px] py-[10px] rounded-[var(--radius-buttons)] hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Card>
  );
};

// --- Main App ---

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [activeTab, setActiveTab] = useState<'batch' | 'streaming' | 'ai'>('batch');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ 
    kpis: null, 
    trends: [], 
    regions: [], 
    readmissions: [],
    costs: null,
    demographics: []
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // ML Form State
  const [mlForm, setMlForm] = useState({ age_band: '51-60', disease: 'Heart Disease', treatment_cost: 15000, gender: 'Male', length_of_stay: 5, previous_admissions: 1 });
  const [prediction, setPrediction] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    const [kpis, trends, regions, readmissions, costs, demographics] = await Promise.all([
        fetchApi('kpis'),
        fetchApi('disease-trends'),
        fetchApi('regional-burden'),
        fetchApi('readmission-rates'),
        fetchApi('costs'),
        fetchApi('demographics')
      ]);

      setData({ kpis, trends, regions, readmissions, costs, demographics });
    setLoading(false);
  };

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

  const trendKeys: string[] = Array.from(
    new Set<string>((data.trends || []).flatMap((row: Record<string, unknown>) => Object.keys(row)))
  ).filter(k => k !== 'year');

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadStatus('idle');
    setUploadMessage('Processing dataset...');
    
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
        if (result.processed_results) {
           setData(result.processed_results);
        } else {
           loadData();
        }
      } else {
        setUploadStatus('error');
        setUploadMessage(result.detail || 'Processing failed');
      }
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage('Network error communicating with the backend.');
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
      <div className="min-h-screen font-sans antialiased flex flex-col items-center justify-center bg-[var(--bg-secondary)]">
        <Card className="w-full max-w-md relative z-10 p-[var(--spacing-32)] space-y-[var(--spacing-32)] shadow-sm">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-[48px] h-[48px] rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] mb-[var(--spacing-24)]">
              <Activity className="h-6 w-6" />
            </div>
            <h1 className="text-[var(--text-heading)] leading-[var(--leading-heading)] font-bold tracking-tight text-[var(--text-primary)] mb-[var(--spacing-16)] font-fraktion">
              Login
            </h1>
            <p className="text-[var(--text-body)] text-[var(--text-secondary)] max-w-[640px] mx-auto">
              Secure access to BDE Healthcare Analytics
            </p>
            <p className="text-[var(--text-caption)] text-[var(--text-secondary)] mt-2">Demo account: admin / admin123</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-[var(--spacing-24)] mt-[var(--spacing-32)]">
            <div>
              <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--text-secondary)] tracking-wider uppercase">Username</label>
              <input 
                type="text" 
                autoComplete="username"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--text-secondary)] tracking-wider uppercase">Password</label>
              <input 
                type="password" 
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
              />
            </div>
            {loginError && <p className="text-red-500 text-[var(--text-body-sm)] font-medium">{loginError}</p>}
            <button 
              type="submit" 
              className="w-full bg-[var(--accent-primary)] text-[var(--accent-fg)] rounded-[var(--radius-buttons)] font-medium px-[var(--spacing-24)] py-[12px] shadow-sm hover:opacity-90 transition-colors"
            >
              Sign In
            </button>
          </form>
          <div className="text-center text-[var(--text-caption)] text-[var(--text-secondary)] mt-[var(--spacing-24)]">
            BDE Healthcare Analytics — Capstone Project
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Activity className="h-12 w-12 text-[var(--text-primary)] animate-bounce" />
          <p className="text-[var(--text-subheading)] font-medium tracking-tight text-[var(--text-primary)]">Initializing Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans antialiased selection:bg-[var(--accent-glow)] selection:text-[var(--text-primary)] bg-[var(--bg-secondary)]">
      <div className="relative z-10 w-full">
        {/* Top Navigation - Glassnode style */}
        <header className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border-b border-[var(--border-color)] h-[64px] flex items-center px-4 sm:px-[var(--spacing-24)] justify-between animate-in slide-in-from-top-4 duration-500 sticky top-0 z-50">
          <div className="flex items-center gap-[var(--spacing-8)]">
            <Activity className="h-5 w-5 text-[var(--text-primary)]" />
            <span className="text-[var(--text-subheading)] font-bold tracking-tight text-[var(--text-primary)]">HealthHadoop</span>
            <span className="hidden sm:inline text-[var(--text-body-sm)] text-[var(--text-secondary)] ml-2 border-l border-[var(--border-color)] pl-2">BDE Healthcare</span>
          </div>
          <div className="flex items-center gap-[var(--spacing-16)]">
            <button
              aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {/* Persistent Upload Button */}
            <label className="relative cursor-pointer">
              <input
                type="file"
                accept=".csv,text/csv,application/csv,application/x-csv,text/x-csv"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-[var(--text-body-sm)] px-[16px] py-[10px] rounded-[var(--radius-buttons)] hover:bg-[var(--bg-secondary)] transition-colors border border-[var(--border-color)]">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">{isUploading ? 'Processing...' : 'Upload CSV'}</span>
              </div>
            </label>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                window.location.reload();
              }}
              className="bg-transparent text-[var(--text-primary)] font-medium text-[var(--text-body-sm)] px-[12px] sm:px-[20px] py-[10px] rounded-[var(--radius-buttons)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Log out
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className="bg-[var(--accent-primary)] text-[var(--accent-fg)] font-medium text-[var(--text-body-sm)] px-[20px] py-[10px] rounded-[var(--radius-buttons)] shadow-sm hover:opacity-90 transition-colors"
            >
              <span className="hidden sm:inline">Launch </span>AI
            </button>
          </div>
        </header>

      <nav className="w-full mt-6 mb-6">
        <div className="flex items-center justify-center">
          <div className="hidden md:flex bg-[var(--bg-secondary)] p-1 rounded-[var(--radius-sm)] border border-[var(--border-color)]">
            <button 
              onClick={() => setActiveTab('batch')} 
              className={cn("px-[20px] py-[8px] text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all border", activeTab === 'batch' ? "bg-[var(--accent-primary)] border-[var(--text-primary)] text-[var(--accent-fg)]" : "bg-transparent border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}
            >
              Batch Analytics
            </button>
            <button 
              onClick={() => setActiveTab('streaming')} 
              className={cn("px-[20px] py-[8px] text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all border", activeTab === 'streaming' ? "bg-[var(--accent-primary)] border-[var(--text-primary)] text-[var(--accent-fg)]" : "bg-transparent border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}
            >
              Live Streaming (Speed Layer)
            </button>
            <button 
              onClick={() => setActiveTab('ai')} 
              className={cn("px-[20px] py-[8px] text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all border", activeTab === 'ai' ? "bg-[var(--accent-primary)] border-[var(--text-primary)] text-[var(--accent-fg)]" : "bg-transparent border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}
            >
              AI Insights
            </button>
          </div>
        </div>
      </nav>

      <main className="w-full pb-16">
        <section className="w-full max-w-[var(--page-max-width)] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 flex flex-col items-start md:items-center md:text-center space-y-[var(--spacing-24)]">
          <div className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] pl-1 pr-3 py-1 mb-4">
            <div className="bg-[var(--accent-primary)] text-[var(--accent-fg)] rounded-[1px] w-6 h-6 flex items-center justify-center text-[12px] font-medium mr-2">1</div>
            <span className="text-[12px] font-medium text-[var(--text-secondary)] uppercase">LAMBDA ARCHITECTURE</span>
          </div>
          <h1 className="text-4xl md:text-[var(--text-display)] leading-[var(--leading-display)] font-bold text-[var(--text-primary)] max-w-4xl font-fraktion">
            Uncovering Healthcare Insights <span className="bg-[var(--accent-glow)] px-2">at Petabyte Scale</span>
          </h1>
          <p className="text-lg md:text-[var(--text-heading-sm)] text-[var(--text-secondary)] max-w-[800px] leading-relaxed mx-auto font-medium">
            A full-stack Lambda Architecture demonstrating Apache Hadoop, Hive, Spark Streaming, and Groq Generative AI to analyze and predict hospital readmissions.
          </p>
        </section>

        {/* Data Gateway */}
        {!loading && !data.kpis && (
          <div className="w-full max-w-[var(--page-max-width)] mx-auto px-4 sm:px-6 lg:px-8 space-y-[var(--spacing-80)] animate-in fade-in duration-500">
            <section className="flex flex-col items-center w-full max-w-xl mx-auto">
              <Card className="w-full relative overflow-hidden bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)]">
                <div className="flex flex-col items-center justify-center p-[var(--spacing-32)] text-center">
                  <div className="p-[var(--spacing-16)] rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] mb-[var(--spacing-16)]">
                    {isUploading ? <Activity className="h-8 w-8 animate-pulse text-[var(--text-secondary)]" /> : <FileUp className="h-8 w-8 text-[var(--text-secondary)]" />}
                  </div>
                  <h3 className="text-[var(--text-heading-sm)] font-bold mb-[var(--spacing-8)] text-[var(--text-primary)]">Upload Dataset to Begin</h3>
                  <p className="text-[var(--text-body)] text-[var(--text-secondary)] mb-[var(--spacing-24)]">
                    Please upload a healthcare CSV dataset to analyze and unlock the dashboard.
                  </p>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".csv,text/csv,application/csv,application/x-csv,text/x-csv,text/comma-separated-values,text/x-comma-separated-values"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
                    />
                    <button 
                      disabled={isUploading}
                      className="bg-[var(--accent-primary)] text-[var(--accent-fg)] font-medium px-[24px] py-[12px] rounded-[var(--radius-buttons)] flex items-center gap-2 hover:opacity-90 transition-colors disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? "Uploading & Processing..." : "Select CSV File"}
                    </button>
                  </div>

                  {uploadMessage && (
                    <div className={cn(
                      "mt-[var(--spacing-24)] flex items-center gap-2 text-[var(--text-caption)] font-medium animate-in fade-in duration-300",
                      uploadStatus === 'success' ? "text-[#10b981]" : 
                      uploadStatus === 'error' ? "text-[#ef4444]" : "text-[var(--text-primary)]"
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
          </div>
        )}

            {/* Mobile Tabs */}
            <div className="flex md:hidden gap-[var(--spacing-8)] w-full overflow-x-auto mb-8 pb-2 px-4">
                <button onClick={() => setActiveTab('batch')} className={cn("flex-1 px-4 py-2 text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all whitespace-nowrap border", activeTab === 'batch' ? "bg-[var(--accent-primary)] border-[var(--text-primary)] text-[var(--accent-fg)]" : "bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border-[var(--border-color)] text-[var(--text-primary)]")}>Batch</button>
                <button onClick={() => setActiveTab('streaming')} className={cn("flex-1 px-4 py-2 text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all whitespace-nowrap border", activeTab === 'streaming' ? "bg-[var(--accent-primary)] border-[var(--text-primary)] text-[var(--accent-fg)]" : "bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border-[var(--border-color)] text-[var(--text-primary)]")}>Streaming</button>
                <button onClick={() => setActiveTab('ai')} className={cn("flex-1 px-4 py-2 text-[var(--text-body-sm)] font-medium rounded-[var(--radius-sm)] transition-all whitespace-nowrap border", activeTab === 'ai' ? "bg-[var(--accent-primary)] border-[var(--text-primary)] text-[var(--accent-fg)]" : "bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border-[var(--border-color)] text-[var(--text-primary)]")}>AI Insights</button>
            </div>

        {/* --- TAB: BATCH ANALYTICS --- */}
        {activeTab === 'batch' && (
          <motion.div 
            initial="hidden" animate="show" 
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
            className="w-full max-w-[var(--page-max-width)] mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
          >
            {!data.kpis ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center bg-[var(--bg-glass)] border border-[var(--border-color)]">
                <Database className="h-12 w-12 text-[var(--text-secondary)] mb-4" />
                <h2 className="text-xl font-bold text-[var(--text-primary)]">No Data Found</h2>
                <p className="text-[var(--text-secondary)] mt-2">Please upload a CSV dataset to begin generating insights.</p>
              </Card>
            ) : (
              <>
            {/* KPI ROW */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { label: "Records Processed", icon: Database, value: data.kpis?.total_records_processed },
                { label: "Regions Analyzed", icon: Map, value: data.kpis?.regions_analyzed },
                { label: "Top Disease Volume", icon: Users, value: data.kpis?.top_disease },
                { label: "Avg Readmission Rate", icon: AlertTriangle, value: data.kpis?.avg_readmission_rate, color: "text-[#ff4d4d]" },
                { label: "Total Revenue", icon: DollarSign, value: data.costs ? `$${(data.costs.total_revenue / 1000000).toFixed(1)}M` : 'N/A', color: "text-[var(--accent-primary)]" },
              ].map((kpi, i) => (
                <motion.div key={i} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }}>
                  <Card className="hover:-translate-y-1 transition-transform group h-full bg-[var(--bg-glass)] border border-[var(--border-color)] shadow-[var(--shadow-glass)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-glow)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between pb-2 relative z-10">
                      <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest">{kpi.label}</h3>
                      <kpi.icon className="h-4 w-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
                    </div>
                    <div className="mt-2 relative z-10">
                      <div className={cn("text-[28px] font-bold text-[var(--text-primary)] tracking-tight", kpi.color)}>{kpi.value}</div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </section>

            {/* BENTO GRID */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Main Chart - Spans 2 columns */}
              <motion.div className="lg:col-span-2" variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                <Card className="flex flex-col h-[420px] bg-[var(--bg-glass)] border border-[var(--border-color)] shadow-[var(--shadow-glass)]">
                  <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="h-5 w-5 text-[var(--accent-primary)]" />
                    <h3 className="text-[var(--text-body)] font-semibold">Year-over-Year Disease Trend</h3>
                  </div>
                  <div className="flex-1 w-full relative">
                    {loading ? <Skeleton className="h-full w-full" /> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.trends}>
                          <defs>
                            <linearGradient id="colorHeart" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ff4d4d" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#ff4d4d" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorDiabetes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#00f2fe" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" className="opacity-30" vertical={false} />
                          <XAxis dataKey="year" stroke="var(--text-secondary)" className="text-[12px]" tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--text-secondary)" className="text-[12px]" tickLine={false} axisLine={false} />
                          <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-neon)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                          {trendKeys.map((key, i) => (
                            <Line key={key} type="monotone" dataKey={key} stroke={TREND_COLORS[i % TREND_COLORS.length]} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: TREND_COLORS[i % TREND_COLORS.length], stroke: 'var(--bg-primary)', strokeWidth: 2 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Secondary Chart - Demographics */}
              <motion.div className="lg:col-span-1" variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                <Card className="flex flex-col h-[420px] bg-[var(--bg-glass)] border border-[var(--border-color)] shadow-[var(--shadow-glass)]">
                  <div className="flex items-center gap-2 mb-6">
                    <HeartPulse className="h-5 w-5 text-[var(--accent-primary)]" />
                    <h3 className="text-[var(--text-body)] font-semibold">Demographics Risk (Readmission Rate)</h3>
                  </div>
                  <div className="flex-1 w-full">
                    {loading ? <Skeleton className="h-full w-full" /> : (data.demographics && data.demographics.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.demographics} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" className="opacity-30" horizontal={true} vertical={false} />
                          <XAxis type="number" stroke="var(--text-secondary)" className="text-[12px]" tickLine={false} axisLine={false} />
                          <YAxis dataKey="age" type="category" width={56} stroke="var(--text-secondary)" className="text-[12px]" tickLine={false} axisLine={false} />
                          <RechartsTooltip cursor={{fill: 'var(--bg-secondary)', opacity: 0.5}} contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-neon)' }} />
                          <Legend iconType="circle" />
                          <Bar dataKey="Male" fill="#00f2fe" radius={[0, 4, 4, 0]} barSize={12} />
                          <Bar dataKey="Female" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={12} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] text-sm">
                        <PieChart className="h-8 w-8 mb-2 opacity-50" />
                        No demographic data found in CSV
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>

              {/* Bottom Row - Regional Burden */}
              <motion.div className="lg:col-span-3" variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                <Card className="flex flex-col h-[350px] bg-[var(--bg-glass)] border border-[var(--border-color)] shadow-[var(--shadow-glass)]">
                  <div className="flex items-center gap-2 mb-6">
                    <Map className="h-5 w-5 text-[var(--accent-primary)]" />
                    <h3 className="text-[var(--text-body)] font-semibold">Regional Case Volume</h3>
                  </div>
                  <div className="flex-1 w-full">
                    {loading ? <Skeleton className="h-full w-full" /> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.regions}>
                          <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={1}/>
                              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0.2}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" className="opacity-30" vertical={false} />
                          <XAxis dataKey="region" stroke="var(--text-secondary)" className="text-[12px]" tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--text-secondary)" className="text-[12px]" tickLine={false} axisLine={false} />
                          <RechartsTooltip cursor={{fill: 'var(--bg-secondary)', opacity: 0.5}} contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-neon)' }} />
                          <Bar dataKey="cases" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </motion.div>

            </section>
            </>
            )}
          </motion.div>
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
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
                <Target className="h-6 w-6 text-[var(--accent-primary)]" />
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">AI Readmission Predictor</h2>
              </div>
              <Card>
                <form onSubmit={handlePredict} className="space-y-[var(--spacing-16)]">
                  <div>
                    <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--text-secondary)] uppercase tracking-wider">Disease Category</label>
                    <select 
                      className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)]"
                      value={mlForm.disease}
                      onChange={e => setMlForm({...mlForm, disease: e.target.value})}
                    >
                      <option>Heart Disease</option>
                      <option>Diabetes</option>
                      <option>Pneumonia</option>
                      <option>Sepsis</option>
                      <option>Asthma</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--text-secondary)] uppercase tracking-wider">Age Band</label>
                    <select 
                      className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)]"
                      value={mlForm.age_band}
                      onChange={e => setMlForm({...mlForm, age_band: e.target.value})}
                    >
                      <option>18-30</option>
                      <option>31-40</option>
                      <option>41-50</option>
                      <option>51-60</option>
                      <option>61-70</option>
                      <option>71-80</option>
                      <option>80+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--text-secondary)] uppercase tracking-wider">Treatment Cost ($)</label>
                    <input 
                      type="number" 
                      className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)]"
                      value={mlForm.treatment_cost}
                      onChange={e => setMlForm({...mlForm, treatment_cost: Math.max(0, Number(e.target.value) || 0)})}
                    />
                  </div>
                  
                    <div>
                      <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--text-secondary)] uppercase tracking-wider">Length of Stay (Days)</label>
                      <input 
                        type="number" 
                        min="1"
                        max="30"
                        className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)]"
                        value={mlForm.length_of_stay}
                        onChange={e => setMlForm({...mlForm, length_of_stay: parseInt(e.target.value) || 1})}
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-caption)] font-medium mb-[var(--spacing-8)] text-[var(--text-secondary)] uppercase tracking-wider">Previous Admissions</label>
                      <input 
                        type="number" 
                        min="0"
                        max="10"
                        className="w-full bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] rounded-[var(--radius-inputs)] p-[var(--spacing-16)] text-[var(--text-body-sm)] focus:outline-none focus:border-[var(--text-primary)] transition-colors text-[var(--text-primary)]"
                        value={mlForm.previous_admissions}
                        onChange={e => setMlForm({...mlForm, previous_admissions: parseInt(e.target.value) || 0})}
                      />
                    </div>
    <button 
                    type="submit" 
                    disabled={predicting}
                    className="w-full bg-[var(--accent-primary)] text-[var(--accent-fg)] rounded-[var(--radius-buttons)] font-medium px-[var(--spacing-24)] py-[12px] mt-[var(--spacing-24)] hover:opacity-90 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {predicting ? "Running Model..." : "Predict Readmission Risk"}
                  </button>
                </form>
              </Card>
              {prediction && (
                <Card className="flex flex-col items-center justify-center text-center p-[var(--spacing-32)] border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                  <div className="animate-in zoom-in duration-300">
                    <h3 className="text-[var(--text-caption)] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Prediction Result</h3>
                    <div className={cn(
                      "text-[var(--text-display)] font-bold mt-[var(--spacing-16)] mb-[var(--spacing-8)]",
                      prediction.prediction === "High Risk" ? "text-[#ef4444]" : "text-[#10b981]"
                    )}>
                      {prediction.probability}
                    </div>
                    <div className="inline-block px-[var(--spacing-16)] py-[var(--spacing-8)] mt-[var(--spacing-16)] rounded-[var(--radius-sm)] bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-glass)] border border-[var(--border-color)] text-[var(--text-body-sm)] font-medium text-[var(--text-primary)] shadow-sm">
                      {prediction.prediction}
                    </div>
                  </div>
                </Card>
              )}
            </section>

            <section className="space-y-6 flex flex-col">
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
                <Cpu className="h-6 w-6 text-[var(--accent-primary)]" />
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Chat with your Data</h2>
              </div>
              <GrokChatbot />
            </section>
          </div>
        )}
      </main>
      
      <footer className="border-t border-[var(--border-color)] mt-12 py-8 text-center text-sm text-[var(--text-secondary)]">
        <p>Built for Big Data Essentials Capstone. Powered by React, FastAPI, scikit-learn, and Groq AI.</p>
      </footer>
      </div>
    </div>
  );
}

export default App;
