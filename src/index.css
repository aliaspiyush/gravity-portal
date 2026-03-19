@import "tailwindcss";

:root {
  --bg-base: #0a0b0f;
  --bg-panel: #111318;
  --bg-card: #161820;
  --bg-card-hover: #1c1f28;
  --bg-input: #0f1116;
  --border: rgba(255,255,255,0.07);
  --border-strong: rgba(255,255,255,0.12);
  --text-primary: #f0f2f8;
  --text-secondary: #8890a6;
  --text-muted: #4a5166;
  --accent: #6c63ff;
  --accent-glow: rgba(108,99,255,0.25);
  --accent-2: #ff6b9d;
  --accent-green: #00d4a0;
  --accent-amber: #ffb84d;
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'DM Mono', monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  height: 100%;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

.animate-fade-up { animation: fadeSlideUp 0.3s ease forwards; }
.animate-spin { animation: spin 1s linear infinite; }
.animate-float { animation: float 3s ease-in-out infinite; }
.msg-bubble { animation: fadeSlideUp 0.25s ease forwards; }

.glow-btn {
  transition: box-shadow 0.2s ease, transform 0.15s ease, background 0.2s ease;
}
.glow-btn:hover {
  box-shadow: 0 0 24px rgba(108,99,255,0.35), 0 4px 24px rgba(0,0,0,0.4);
  transform: translateY(-1px);
}
.glow-btn:active { transform: translateY(0); }

.typing-dot { animation: blink 1.4s infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
