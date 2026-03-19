import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { DashboardSpec } from '../services/geminiService';

interface ChartRendererProps {
  chartSpec: DashboardSpec['visualization_plan']['charts'][0];
  data: any[];
}

const COLORS = ['#6c63ff', '#ff6b9d', '#00d4a0', '#ffb84d', '#60a5fa', '#f87171', '#a78bfa', '#34d399'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#161820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
      padding: '10px 14px', fontSize: '12px', color: '#f0f2f8', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
    }}>
      {label && <div style={{ color: '#8890a6', marginBottom: '6px', fontWeight: 600 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#8890a6' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ChartRenderer({ chartSpec, data }: ChartRendererProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4a5166', fontSize: '13px' }}>
        No data returned for this chart
      </div>
    );
  }

  const { recommended_chart_type, x_field, y_field, series_field } = chartSpec;

  let chartData = data;
  let seriesKeys = [y_field || Object.keys(data[0])[1] || 'value'];

  if (series_field && x_field && y_field) {
    const pivoted: Record<string, any> = {};
    const keys = new Set<string>();
    data.forEach(row => {
      const xVal = String(row[x_field]);
      const sVal = String(row[series_field]);
      const yVal = row[y_field];
      if (!pivoted[xVal]) pivoted[xVal] = { [x_field]: xVal };
      pivoted[xVal][sVal] = yVal;
      keys.add(sVal);
    });
    chartData = Object.values(pivoted);
    seriesKeys = Array.from(keys);
  }

  const axisStyle = { fill: '#8890a6', fontSize: 11, fontFamily: 'DM Sans, sans-serif' };
  const gridStyle = { stroke: 'rgba(255,255,255,0.05)', strokeDasharray: '3 3' };

  const renderChart = () => {
    switch (recommended_chart_type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey={x_field || undefined} tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#8890a6' }} />
              {seriesKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2} dot={{ fill: COLORS[i % COLORS.length], r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 0 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'bar':
      case 'stacked_bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey={x_field || undefined} tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#8890a6' }} />
              {seriesKeys.map((key, i) => (
                <Bar key={key} dataKey={key} stackId={recommended_chart_type === 'stacked_bar' ? 'a' : undefined}
                  fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                {seriesKeys.map((key, i) => (
                  <linearGradient key={key} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey={x_field || undefined} tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#8890a6' }} />
              {seriesKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key}
                  stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                  fill={`url(#grad-${i})`} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#8890a6' }} />
              <Pie data={data} dataKey={y_field || 'value'} nameKey={x_field || 'name'}
                cx="50%" cy="50%"
                innerRadius={recommended_chart_type === 'donut' ? '50%' : 0}
                outerRadius="70%" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}
                    stroke="transparent" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      case 'table':
        const tableKeys = Object.keys(data[0] || {});
        return (
          <div style={{ overflowX: 'auto', height: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {tableKeys.map(key => (
                    <th key={key} style={{
                      padding: '8px 12px', textAlign: 'left', color: '#8890a6',
                      fontWeight: 600, fontSize: '10px', letterSpacing: '0.1em',
                      textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.07)',
                      fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap'
                    }}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {tableKeys.map((k, j) => (
                      <td key={j} style={{ padding: '9px 12px', color: '#f0f2f8' }}>
                        {typeof row[k] === 'number' ? row[k].toLocaleString() : String(row[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'KPI':
        const kpiValue = data[0]?.[y_field || Object.keys(data[0])[0]];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
            <div style={{
              fontSize: '56px', fontWeight: 800, fontFamily: 'Syne, sans-serif',
              background: 'linear-gradient(135deg, #6c63ff, #ff6b9d)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em'
            }}>
              {typeof kpiValue === 'number' ? kpiValue.toLocaleString() : kpiValue}
            </div>
            {x_field && data[0]?.[x_field] && (
              <div style={{ fontSize: '12px', color: '#8890a6', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' }}>
                {data[0][x_field]}
              </div>
            )}
          </div>
        );
      default:
        return <div style={{ color: '#4a5166', fontSize: '13px' }}>Unsupported: {recommended_chart_type}</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', color: '#f0f2f8', marginBottom: '4px' }}>
          {chartSpec.title}
        </h3>
        {chartSpec.rationale && (
          <p style={{ fontSize: '11px', color: '#4a5166', lineHeight: '1.5' }}>{chartSpec.rationale}</p>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {renderChart()}
      </div>
    </div>
  );
}
