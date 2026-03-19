# Gravity Portal — Conversational BI Dashboard

> Ask any business question in plain English. Get interactive dashboards instantly.

Built by **Gravity Labs** · Powered by **Google Gemini**

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure your API key
Create a `.env.local` file in the project root:
```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```
Get your key at: https://aistudio.google.com/app/apikey

### 3. Run locally
```bash
npm run dev
```

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to vercel.com → New Project → Import your repo
3. Add environment variable: `VITE_GEMINI_API_KEY` = your key
4. Deploy

---

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Data**: AlaSQL (in-browser SQL on CSV)
- **AI**: Google Gemini 2.0 Flash via @google/genai
- **Deploy**: Vercel
