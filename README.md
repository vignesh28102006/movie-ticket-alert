# 🎬 TicketDrop - Movie Ticket Release Alert Application

A complete, production-ready, full-stack web application that monitors **BookMyShow** and **Zomato District** to instantly notify users the second movie tickets are released for their chosen film, date, city, and cinema.

Designed for **zero-cost operation** using free tiers (Next.js, Supabase PostgreSQL with Row Level Security, pluggable Telegram/In-App/Webhook notifications, and modular voice-call architecture).

---

## 🌟 Key Features

- **Multi-Platform Ticket Tracking**: Monitors BookMyShow and Zomato District simultaneously or individually.
- **Smart City & Theatre Filtering**: Select movie (*Paradise*, *Coolie*, *Thug Life*, *Dragon*, etc.), date (*24 September 2026*), city (Coimbatore, Chennai, Bangalore, Hyderabad), and cinema screen (*KG Cinemas, Broadway, PVR INOX*).
- **Live Status Badges**:
  - `🟡 Waiting for tickets` (WAITING)
  - `🔄 Checking...` (CHECKING)
  - `🟢 Tickets Released` (RELEASED)
  - `🟢 Tickets Released & Notified` (NOTIFIED)
  - `🔴 Retrying / Warning` (ERROR with exponential backoff)
  - `⚪ Cancelled` (CANCELLED)
- **Pluggable Notification System**:
  - **In-App Notification Audit History** (100% Free, zero external setup)
  - **Telegram Bot** (100% Free real-time phone push alerts)
  - **n8n / Webhook Dispatcher** (100% Free automation triggers)
  - **Voice Call Service** (Pre-wired Twilio / Exotel telephony interface for voice call alerts)
- **Automated Monitoring Worker & Cron API**:
  - Standalone Node/TypeScript background worker daemon (`npm run worker`)
  - Secured Cron Endpoint (`/api/cron/check-alerts`) for Vercel Cron, GitHub Actions, or n8n
- **Deterministic Simulation Engine**: In-dashboard **Simulate Drop** trigger to test end-to-end alert transitions without waiting for live movie releases.
- **Strict Row Level Security (RLS)**: PostgreSQL policies ensuring complete user data isolation.

---

## 🏗️ Architecture

```
                                  +---------------------------------------+
                                  |         Next.js App Router UI         |
                                  | (Dashboard / Alert Cards / Form / Log)|
                                  +-------------------+-------------------+
                                                      |
                         +----------------------------+----------------------------+
                         |                                                         |
                         v                                                         v
             +-----------------------+                                 +-----------------------+
             |   Supabase Postgres   |                                 |   Monitoring Engine   |
             |  (Auth, Alerts, RLS)  | <------------------------------ |   (Worker / Cron API) |
             +-----------------------+                                 +-----------+-----------+
                                                                                   |
                                      +--------------------------------------------+
                                      |
                         +------------+------------+
                         |                         |
                         v                         v
            +-------------------------+   +-------------------------+
            |    Ticket Providers     |   |  Notification Dispatcher|
            | - BookMyShow (Public)   |   | - In-App Audit Trail    |
            | - District (Public)     |   | - Telegram Bot (Free)   |
            | - Mock Simulator (Dev)  |   | - n8n Webhooks (Free)   |
            +-------------------------+   | - Voice Call Interface  |
                                          +-------------------------+
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14+ (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend & Database** | Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS) |
| **Validation** | Zod schema validation |
| **Testing** | Node native test runner via `tsx --test` (zero heavy dependencies) |
| **Automation** | n8n workflow integration & standalone worker loop |

---

## 🗄️ Database Schema & RLS

The database schema is located at [`supabase/migrations/20260922_init.sql`](supabase/migrations/20260922_init.sql).

### Key Tables:
1. `movies`: Catalog of movies (id, title, slug, language, release_date, poster_url).
2. `theatres`: Venues by city and platform mapping (id, name, city, address, chain).
3. `alerts`: User ticket alerts (id, user_id, movie_id, theatre_id, city, watch_date, platform, phone_number, status, alert_sent, check_count).
4. `ticket_availability_checks`: Historical check audit trail.
5. `notifications`: Delivered alerts log with recipient details.

### Security:
- RLS enabled on all tables.
- `alerts` and `notifications` are locked to `auth.uid() = user_id`.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js >= 20
- npm >= 10

### 2. Clone & Install
```bash
cd scratch/movie-ticket-alert
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Key variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=super_secret_cron_key_for_ticket_checker_2026
DEFAULT_TICKET_PROVIDER=mock
DEFAULT_NOTIFICATION_CHANNEL=in_app
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

Run the automated unit, integration, and end-to-end test suite:

```bash
npm run test
```

### Test Coverage:
- `tests/external-check.test.ts`: User-scoped auth, cross-user authorization rejection, multi-alert isolation, and Cases A–J.
- `tests/e2e-flow.test.ts`: Complete end-to-end lifecycle (`WAITING` -> ticket release detection -> `NOTIFIED` -> duplicate notification prevention).
- `tests/state-machine.test.ts`: Valid/invalid state transitions, terminal state protection, and error recovery.
- `tests/ticket-providers.test.ts`: Mock provider simulation, showtime parsing, and transient error safety.
- `tests/notification-service.test.ts`: In-app audit log persistence, payload formatting, and voice call simulation.

---

## 🧩 Browser Userscript Setup (Zero-Cost Live Detection)

Because BookMyShow blocks direct server-side requests with Cloudflare 403 and District is a client-side React SPA, the included Tampermonkey userscript allows monitoring tickets directly from your authenticated browser session with **zero server secrets** exposed.

### 1. Installation:
1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) in your browser (Chrome, Brave, Firefox, or Edge).
2. Open Tampermonkey dashboard -> **Create a new script**.
3. Copy and paste the contents of [`userscript/movie-ticket-alert.user.js`](userscript/movie-ticket-alert.user.js).
4. Save the script (Ctrl+S).

### 2. Configuration:
- By default, the script connects to `http://localhost:3000` with user ID `default-user-id`.
- If you change your user ID or deploy to Vercel, click Tampermonkey -> script storage -> update `mta_app_url` and `mta_user_id`.
- **Security Guarantee**: The userscript contains **NO** database credentials, **NO** service-role keys, and **NO** server cron secrets. It only reports on alerts belonging to your own user account.

### 3. Live Browser Verification Steps:
1. Start the Next.js dev server: `npm run dev`
2. Create an alert in the dashboard (e.g., Movie: *Paradise*, City: *Coimbatore*, Theatre: *KG Cinemas*, Date: *2026-09-24*).
3. In your browser, open the target showtimes page on BookMyShow or District.
4. Open Developer Tools (F12) -> **Console**.
5. You will see:
   ```text
   [MTA] Movie Ticket Alert userscript loaded. App URL: http://localhost:3000
   [MTA] Loaded 1 active alerts
   [MTA] BMS/District detection result for alert ...
   ```
6. When showtimes are detected, the script POSTs to `/api/external-check` and triggers your configured notifications (Telegram and In-App).

---

## 🤖 Running the Background Monitoring Worker

You can run the background monitoring worker in two modes:

### 1. Daemon Mode (Polls every 30s)
```bash
npm run worker
```

### 2. One-Shot Mode (Single check cycle)
```bash
npm run worker -- --once
```

### 3. Triggering via HTTP Cron Endpoint
```bash
curl -X POST http://localhost:3000/api/cron/check-alerts \
  -H "Authorization: Bearer super_secret_cron_key_for_ticket_checker_2026"
```

---

## 🔄 n8n Automation Setup

A pre-built n8n workflow is included in [`n8n/movie-ticket-alert-workflow.json`](n8n/movie-ticket-alert-workflow.json).

1. Open your n8n instance (`http://localhost:5678`).
2. Go to **Workflows** -> **Import from File**.
3. Select `n8n/movie-ticket-alert-workflow.json`.
4. Update the endpoint URL and `CRON_SECRET` if needed.
5. Activate the workflow to schedule periodic checks automatically without keeping a custom script running.

---

## 🌐 Zero-Cost Cloud Deployment

| Component | Free-Tier Host | Setup Notes |
|---|---|---|
| **Frontend & API Routes** | **Vercel** (Hobby Tier) | Connect GitHub repository, set environment variables, automatic deployment. |
| **Database & Auth** | **Supabase** (Free Tier) | Create free project, paste SQL migration from `supabase/migrations/20260922_init.sql`. |
| **Scheduled Monitoring** | **Vercel Cron** or **GitHub Actions** | Set cron schedule to invoke `/api/cron/check-alerts` every 2 minutes. |
| **Instant Notifications** | **Telegram Bot API** (Free) | Free push alerts directly to your phone via Telegram Bot Father. |

---

## 📝 License
MIT License. Built for efficient, cost-effective movie ticket monitoring.
