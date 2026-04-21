# Stock Trading Dashboard

A comprehensive web-based trading and portfolio management platform that helps investors track stocks, analyze market trends, and manage their portfolio with intelligent automation. The application combines real-time market data, technical analysis, sector rotation insights, and AI-powered stock evaluation in one unified dashboard.

## What This Project Does

This is an all-in-one **stock market analysis and portfolio tracking application** designed for active investors and traders. It pulls live market data from multiple financial APIs and presents it through interactive dashboards, automated email reports, and intelligent alerts.

### Key Features

- **📊 Portfolio Tracker** — Track open positions with live prices, P&L, stop-loss automation, and benchmark comparison against any index (SPY, QQQ, sector ETFs, etc.). Positions automatically marked as "SOLD" when stop-loss is triggered.
- **👁️ Watchlist Manager** — Monitor stocks and ETFs you're interested in, with sector classification, RRG (Relative Rotation Graph) quadrant placement, and upcoming earnings dates.
- **📈 Weekly Technical Matrix** — Multi-indicator technical analysis grid showing trend strength, momentum, and key levels across your entire watchlist.
- **🎯 Sector RRG Analysis** — Visualize sector rotation using Relative Rotation Graphs to identify Leading, Weakening, Lagging, and Improving sectors versus the S&P 500.
- **🤖 AI Stock Analysis** — On-demand fundamental and technical analysis powered by Lovable AI, generating concise buy/hold/sell insights.
- **📰 Company News Feed** — Latest news headlines for any ticker pulled from financial news APIs.
- **📅 Earnings Calendar** — Automatic tracking of upcoming earnings dates for all watchlist tickers, with cache-aware refresh logic.
- **📧 Daily Market Email** — Automated daily report sent to your inbox covering VIX levels, market direction, sector performance, portfolio status, and upcoming earnings.
- **🔔 Smart Alerts** — Email notifications when stop-losses trigger or custom criteria are met.
- **🔐 Authentication** — Secure email/password and Google OAuth login with password recovery.

## Tech Stack

### Frontend
- **React 18** + **TypeScript** + **Vite** — Fast, type-safe SPA framework
- **Tailwind CSS** + **shadcn/ui** — Design system with semantic tokens and accessible components
- **Recharts** — Interactive financial charts and RRG visualizations
- **TanStack Query** — Server state management and caching

### Backend (Lovable Cloud / Supabase)
- **PostgreSQL** — Stores portfolio positions, watchlists, user settings, and earnings cache
- **Edge Functions (Deno)** — Serverless functions for market data fetching, AI analysis, and email automation
- **Row-Level Security** — All user data isolated and protected at the database level
- **Authentication** — Built-in auth with email and Google OAuth providers
- **Scheduled Jobs (pg_cron)** — Daily automated market emails and analysis runs

### External Integrations
- **Polygon.io** — Real-time and historical stock prices, sector ETF data
- **Finnhub** — Earnings calendar data
- **FRED (St. Louis Fed)** — Macroeconomic indicators (VIX fallback source)
- **Yahoo Finance** — Sector classification and supplementary market data
- **Resend** — Transactional email delivery
- **Lovable AI Gateway** — AI-powered stock analysis (Gemini / GPT models)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or bun

### Installation

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

The dev server starts on `http://localhost:8080` with hot reload.

### Environment Variables

The `.env` file is auto-managed by Lovable Cloud and contains:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Backend secrets (Polygon, Finnhub, FRED, Resend API keys) are configured in the Lovable Cloud settings, not in `.env`.

## Build for Production

```bash
npm run build      # Create production build
npm run preview    # Preview production build locally
```

## Deployment

This project is deployed on **Fly.io**.

A `Dockerfile`, `nginx.conf`, and `fly.toml` are included for containerized deployment. To redeploy:

```bash
fly deploy
```

The app can also be deployed to any static host (Vercel, Netlify, Cloudflare Pages) since the frontend is a static SPA — the backend runs entirely on Lovable Cloud.

## Project Structure

```
src/
├── components/          # React components (TradingDashboard, PortfolioTracker, etc.)
├── hooks/               # Custom hooks (usePortfolio, useWatchlist, useAuth)
├── integrations/        # Auto-generated Supabase client & types
├── pages/               # Route-level pages (Index, Auth, NotFound)
└── lib/                 # Utilities

supabase/
└── functions/           # Edge functions
    ├── stock-analysis/         # AI-powered analysis
    ├── stock-metadata/         # Sector + RRG quadrant lookup
    ├── get-current-prices/     # Live price fetching
    ├── fetch-earnings/         # Earnings calendar w/ caching
    ├── sector-rrg/             # Sector rotation graph data
    ├── weekly-technical-matrix/# Technical indicators
    ├── company-news/           # News feed
    ├── daily-market-email/     # Scheduled daily report
    ├── send-alert-email/       # Stop-loss / criteria alerts
    └── scheduled-analysis/     # Background analysis jobs
```

## License

Private project — all rights reserved.
