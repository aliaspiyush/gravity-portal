import React, { useState, useRef, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import alasql from 'alasql';
import {
  Upload, Send, Loader2, BarChart3, Database, AlertCircle,
  Download, RefreshCw, Sparkles, Globe, Volume2, ChevronRight,
  FileSpreadsheet, Bot, User, Zap, TrendingUp, PieChart, X
} from 'lucide-react';
import { generateDashboardSpec, DashboardSpec, generateDetailedInsights, generateWebContext } from './services/geminiService';
import { ChartRenderer } from './components/ChartRenderer';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUERIES = [
  "Show monthly revenue trends by region",
  "Which product category performs best?",
  "Compare Q1 vs Q2 sales performance",
  "Show top 5 regions by total revenue",
];

const SAMPLE_DATA = [
  { date: '2023-01-01', region: 'North', product_category: 'Electronics', sales_revenue: 15000, units_sold: 120 },
  { date: '2023-01-01', region: 'South', product_category: 'Electronics', sales_revenue: 12000, units_sold: 90 },
  { date: '2023-01-01', region: 'North', product_category: 'Clothing', sales_revenue: 8000, units_sold: 200 },
  { date: '2023-01-01', region: 'South', product_category: 'Clothing', sales_revenue: 9500, units_sold: 250 },
  { date: '2023-02-01', region: 'North', product_category: 'Electronics', sales_revenue: 16500, units_sold: 130 },
  { date: '2023-02-01', region: 'South', product_category: 'Electronics', sales_revenue: 14000, units_sold: 110 },
  { date: '2023-02-01', region: 'North', product_category: 'Clothing', sales_revenue: 8500, units_sold: 210 },
  { date: '2023-02-01', region: 'South', product_category: 'Clothing', sales_revenue: 10000, units_sold: 260 },
  { date: '2023-03-01', region: 'North', product_category: 'Electronics', sales_revenue: 18000, units_sold: 150 },
  { date: '2023-03-01', region: 'South', product_category: 'Electronics', sales_revenue: 15500, units_sold: 125 },
  { date: '2023-03-01', region: 'North', product_category: 'Clothing', sales_revenue: 9000, units_sold: 220 },
  { date: '2023-03-01', region: 'South', product_category: 'Clothing', sales_revenue: 11000, units_sold: 280 },
  { date: '2023-04-01', region: 'East', product_category: 'Electronics', sales_revenue: 13000, units_sold: 100 },
  { date: '2023-04-01', region: 'West', product_category: 'Clothing', sales_revenue: 7500, units_sold: 180 },
  { date: '2023-04-01', region: 'North', product_category: 'Electronics', sales_revenue: 19000, units_sold: 160 },
  { date: '2023-04-01', region: 'South', product_category: 'Furniture', sales_revenue: 22000, units_sold: 45 },
];

export default function App() {
  const [data, setData] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [schema, setSchema] = useState<string>('');
  const [queryInput, setQueryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dashboardSpec, setDashboardSpec] = useState<DashboardSpec | null>(null);
  const [chartData, setChartData] = useState<Record<string, any[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'data'>('chat');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const initData = (parsedData: any[], name?: string) => {
    alasql('DROP TABLE IF EXISTS data');
    alasql('CREATE TABLE data');
    alasql.tables.data.data = parsedData;
    const firstRow = parsedData[0];
    const cols = Object.keys(firstRow);
    setColumns(cols);
    const schemaCols = cols.map(k => `- ${k} (${typeof (firstRow as any)[k]})`).join('\n');
    const sampleValues = parsedData.slice(0, 3).map(r => JSON.stringify(r)).join('\n');
    const schemaStr = `Table Name: data\nColumns:\n${schemaCols}\n\nSample Data:\n${sampleValues}`;
    setSchema(schemaStr);
    setData(parsedData);
    if (name) setFileName(name);
    setChatHistory([{
      role: 'assistant',
      content: `Dataset loaded — **${parsedData.length} rows** across **${cols.length} columns** (${cols.join(', ')}). What business question would you like to explore?`,
      timestamp: new Date()
    }]);
    setDashboardSpec(null);
    setChartData({});
    setError(null);
  };

  const loadSampleData = () => {
    setFileName('sample_sales_data.csv');
    initData(SAMPLE_DATA, 'sample_sales_data.csv');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          initData(results.data as any[], file.name);
        } else {
          setError('CSV file appears to be empty or malformed.');
        }
      },
      error: (err) => setError(`Error parsing CSV: ${err.message}`)
    });
  };

  const handleQuerySubmit = async (e?: React.FormEvent, overrideQuery?: string) => {
    e?.preventDefault();
    const q = overrideQuery || queryInput;
    if (!q.trim() || !schema || loading) return;

    setQueryInput('');
    setLoading(true);
    setError(null);
    setChatHistory(prev => [...prev, { role: 'user', content: q, timestamp: new Date() }]);

    try {
      const spec = await generateDashboardSpec(q, schema, { current_dashboard_state: dashboardSpec });
      setDashboardSpec(spec);

      if (spec.status === 'success') {
        const newChartData: Record<string, any[]> = {};
        for (const sq of spec.data_plan.sql_queries) {
          try {
            const result = alasql(sq.sql) as any[];
            newChartData[sq.id] = result;
          } catch (sqlErr: any) {
            console.error('SQL Error:', sqlErr);
          }
        }
        setChartData(newChartData);
        setChatHistory(prev => [...prev, { role: 'assistant', content: spec.explanation, timestamp: new Date() }]);
      } else if (spec.status === 'needs_clarification') {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: spec.explanation + '\n\n' + spec.data_plan.clarification_questions.join('\n'),
          timestamp: new Date()
        }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'assistant', content: spec.explanation, timestamp: new Date() }]);
      }
    } catch (err: any) {
      const msg = err.message || 'Error generating dashboard.';
      setError(msg);
      setChatHistory(prev => [...prev, { role: 'assistant', content: `I encountered an error: ${msg}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleInsights = async () => {
    if (!schema || loading) return;
    setLoading(true);
    setChatHistory(prev => [...prev, { role: 'user', content: '✦ Generate deep business insights from this dataset', timestamp: new Date() }]);
    try {
      const insights = await generateDetailedInsights(schema, dashboardSpec);
      setChatHistory(prev => [...prev, { role: 'assistant', content: insights, timestamp: new Date() }]);
    } catch { setError('Failed to generate insights.'); }
    finally { setLoading(false); }
  };

  const handleWebContext = async () => {
    if (!schema || loading) return;
    setLoading(true);
    setChatHistory(prev => [...prev, { role: 'user', content: '✦ Search for industry benchmarks and market context', timestamp: new Date() }]);
    try {
      const { text, urls } = await generateWebContext('Current dashboard data', schema);
      const content = urls.length > 0 ? `${text}\n\nSources:\n${urls.map(u => `• ${u}`).join('\n')}` : text;
      setChatHistory(prev => [...prev, { role: 'assistant', content, timestamp: new Date() }]);
    } catch { setError('Failed to load web context.'); }
    finally { setLoading(false); }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gravity_portal_export.csv';
    a.click();
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow bg elements */}
      <div style={{
        position: 'fixed', top: '-20%', left: '-10%', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'fixed', bottom: '-10%', right: '20%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(255,107,157,0.05) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: '300px', minWidth: '300px', background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 10
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/gravity-logo.png" alt="Gravity" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Gravity Portal
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                CONVERSATIONAL BI
              </div>
            </div>
          </div>
        </div>

        {/* Data Source Section */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '10px', textTransform: 'uppercase' }}>
            Data Source
          </div>
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%', padding: '9px 12px', background: 'var(--bg-card)',
              border: '1px solid var(--border-strong)', borderRadius: '10px',
              color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '8px', transition: 'all 0.2s', fontFamily: 'var(--font-body)'
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(108,99,255,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
          >
            <Upload size={14} style={{ color: 'var(--accent)' }} />
            {data ? 'Replace CSV' : 'Upload CSV File'}
          </button>
          {!data && (
            <button onClick={loadSampleData}
              style={{
                width: '100%', padding: '9px 12px', background: 'rgba(108,99,255,0.1)',
                border: '1px solid rgba(108,99,255,0.25)', borderRadius: '10px',
                color: 'var(--accent)', fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s', fontFamily: 'var(--font-body)'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,99,255,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(108,99,255,0.1)')}
            >
              <Database size={14} />
              Use Sample Dataset
            </button>
          )}
          {data && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
              background: 'rgba(0,212,160,0.08)', border: '1px solid rgba(0,212,160,0.2)',
              borderRadius: '8px', fontSize: '12px', color: 'var(--accent-green)'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)', animation: 'blink 2s infinite' }} />
              <FileSpreadsheet size={12} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
              <span style={{ color: 'var(--text-muted)' }}>{data.length}r</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {data && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '10px', textTransform: 'uppercase' }}>
              Quick Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { icon: <Sparkles size={13} />, label: 'Deep Insights', action: handleInsights, color: '#a78bfa' },
                { icon: <Globe size={13} />, label: 'Web Context', action: handleWebContext, color: '#60a5fa' },
                { icon: <Download size={13} />, label: 'Export CSV', action: handleExportCSV, color: 'var(--accent-green)' },
              ].map(({ icon, label, action, color }) => (
                <button key={label} onClick={action} disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
                    color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.2s', textAlign: 'left', fontFamily: 'var(--font-body)',
                    opacity: loading ? 0.5 : 1
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <span style={{ color }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {data && (
          <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '10px', textTransform: 'uppercase' }}>
              Try These
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {SUGGESTED_QUERIES.map((q, i) => (
                <button key={i} onClick={() => handleQuerySubmit(undefined, q)} disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px',
                    color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer',
                    transition: 'all 0.2s', textAlign: 'left', fontFamily: 'var(--font-body)',
                    opacity: loading ? 0.5 : 1
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(108,99,255,0.4)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(108,99,255,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <ChevronRight size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Powered By */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Powered by Gemini · Built by Gravity Labs
          </div>
        </div>
      </aside>

      {/* ── CHAT PANEL ── */}
      <div style={{
        width: '380px', minWidth: '380px', display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)', position: 'relative', zIndex: 10
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-panel)'
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Bot size={16} color="white" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
              Portal AI
            </div>
            <div style={{ fontSize: '11px', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-green)' }} />
              {data ? 'Dataset Active' : 'Awaiting Data'}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-base)' }}>
          {chatHistory.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '32px 16px' }}
              className="animate-fade-up">
              <div style={{
                width: '64px', height: '64px', borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(255,107,157,0.1))',
                border: '1px solid rgba(108,99,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '16px'
              }} className="animate-float">
                <BarChart3 size={28} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Start with your data
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Upload a CSV or use sample data, then ask any business question in plain English.
              </div>
            </div>
          )}

          {chatHistory.map((msg, idx) => (
            <div key={idx} className="msg-bubble"
              style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Bot size={12} color="white" />
                  </div>
                )}
                <div style={{
                  maxWidth: '85%', padding: '10px 13px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, var(--accent), #8b83ff)'
                    : 'var(--bg-card)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  fontSize: '13px', lineHeight: '1.55', color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {msg.content}
                </div>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: msg.role === 'assistant' ? '28px' : '0', paddingRight: msg.role === 'user' ? '0' : '0' }}>
                {formatTime(msg.timestamp)}
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg-bubble" style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Bot size={12} color="white" />
              </div>
              <div style={{
                padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', gap: '4px', alignItems: 'center'
              }}>
                <div className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                <div className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                <div className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
          {/* Toolbar chips */}
          {data && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {[
                { label: 'Insights', icon: <Sparkles size={10} />, action: handleInsights, color: '#a78bfa' },
                { label: 'Web Context', icon: <Globe size={10} />, action: handleWebContext, color: '#60a5fa' },
                { label: 'Export', icon: <Download size={10} />, action: handleExportCSV, color: 'var(--accent-green)' },
                { label: 'Refresh', icon: <RefreshCw size={10} />, action: () => {}, color: 'var(--text-secondary)' },
              ].map(({ label, icon, action, color }) => (
                <button key={label} onClick={action} disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px',
                    color, fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'var(--font-body)', opacity: loading ? 0.5 : 1,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleQuerySubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={inputRef}
                type="text"
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                placeholder={data ? 'Ask anything about your data...' : 'Upload data to start'}
                disabled={!data || loading}
                style={{
                  width: '100%', padding: '11px 14px', background: 'var(--bg-input)',
                  border: '1px solid var(--border-strong)', borderRadius: '12px',
                  color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                  fontFamily: 'var(--font-body)', transition: 'border-color 0.2s',
                  opacity: !data ? 0.5 : 1
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(108,99,255,0.6)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
              />
            </div>
            <button type="submit" disabled={!data || !queryInput.trim() || loading}
              className="glow-btn"
              style={{
                width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent), #8b83ff)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: (!data || !queryInput.trim() || loading) ? 0.4 : 1,
                transition: 'all 0.2s'
              }}
            >
              {loading ? <Loader2 size={16} color="white" className="animate-spin" /> : <Send size={16} color="white" />}
            </button>
          </form>
        </div>
      </div>

      {/* ── DASHBOARD PANEL ── */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 5 }}>
        {error && (
          <div style={{
            margin: '20px', padding: '12px 16px', background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px',
            display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#fca5a5', fontSize: '13px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {!dashboardSpec || dashboardSpec.status !== 'success' ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', padding: '48px', textAlign: 'center'
          }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(255,107,157,0.08))',
              border: '1px solid rgba(108,99,255,0.2)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '24px'
            }} className="animate-float">
              <BarChart3 size={36} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '28px', color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '-0.03em' }}>
              Gravity Portal
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.7', maxWidth: '400px', marginBottom: '32px' }}>
              Conversational Business Intelligence — ask any question in plain English and watch your data transform into interactive dashboards instantly.
            </div>
            {!data && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '320px' }}>
                <button onClick={() => fileInputRef.current?.click()}
                  className="glow-btn"
                  style={{
                    padding: '14px 24px', background: 'linear-gradient(135deg, var(--accent), #8b83ff)',
                    border: 'none', borderRadius: '14px', color: 'white', fontSize: '14px',
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-display)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}>
                  <Upload size={16} /> Upload CSV to Start
                </button>
                <button onClick={loadSampleData}
                  style={{
                    padding: '13px 24px', background: 'var(--bg-card)',
                    border: '1px solid var(--border-strong)', borderRadius: '14px',
                    color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'var(--font-display)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(108,99,255,0.4)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  Or Use Sample Dataset
                </button>
              </div>
            )}
            {data && (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                ← Ask a question in the chat to generate your dashboard
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '28px' }} className="animate-fade-up">
            {/* Dashboard Header */}
            <div style={{
              padding: '24px 28px', borderRadius: '16px', marginBottom: '24px',
              background: 'linear-gradient(135deg, rgba(108,99,255,0.12), rgba(255,107,157,0.06))',
              border: '1px solid rgba(108,99,255,0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      padding: '3px 8px', background: 'rgba(108,99,255,0.2)', borderRadius: '20px',
                      fontSize: '10px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {dashboardSpec.natural_language_understanding.primary_intent}
                    </div>
                    {dashboardSpec.natural_language_understanding.time_scope && (
                      <div style={{
                        padding: '3px 8px', background: 'rgba(255,184,77,0.15)', borderRadius: '20px',
                        fontSize: '10px', fontWeight: 600, color: 'var(--accent-amber)', letterSpacing: '0.08em', textTransform: 'uppercase',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {dashboardSpec.natural_language_understanding.time_scope}
                      </div>
                    )}
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
                    {dashboardSpec.natural_language_understanding.business_question}
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
                    {dashboardSpec.explanation}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    padding: '6px 12px', background: 'rgba(0,212,160,0.1)', border: '1px solid rgba(0,212,160,0.2)',
                    borderRadius: '8px', fontSize: '11px', color: 'var(--accent-green)', fontWeight: 600
                  }}>
                    {dashboardSpec.visualization_plan.charts.length} charts
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div style={{
              display: 'grid', gap: '16px',
              gridTemplateColumns: `repeat(${Math.min(dashboardSpec.visualization_plan.layout.columns || 2, 2)}, minmax(0, 1fr))`
            }}>
              {dashboardSpec.visualization_plan.charts.map(chart => {
                const pos = dashboardSpec.visualization_plan.layout.positions.find(p => p.chart_id === chart.id);
                const colSpan = Math.min(pos?.column_span || 1, 2);
                return (
                  <div key={chart.id}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: '16px', padding: '24px',
                      gridColumn: `span ${colSpan} / span ${colSpan}`, minHeight: '360px',
                      transition: 'border-color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(108,99,255,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <ChartRenderer chartSpec={chart} data={chartData[chart.query_id] || []} />
                  </div>
                );
              })}
            </div>

            {/* Follow-up suggestions */}
            {dashboardSpec.follow_up_suggestions?.length > 0 && (
              <div style={{ marginTop: '24px', padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '12px', textTransform: 'uppercase' }}>
                  Suggested Follow-ups
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {dashboardSpec.follow_up_suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setQueryInput(s); inputRef.current?.focus(); }}
                      style={{
                        padding: '7px 14px', background: 'transparent', border: '1px solid var(--border-strong)',
                        borderRadius: '20px', color: 'var(--text-secondary)', fontSize: '12px',
                        cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'rgba(108,99,255,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
