# 🎬 TicketDrop - Movie Ticket Release Alert Application

A complete, production-ready, full-stack web application that monitors **BookMyShow** and **Zomato District** to instantly notify users the second movie tickets are released for their chosen film, language version, date, city, and cinema.

Designed for **zero-cost operation** using free tiers (Next.js, Supabase PostgreSQL with Row Level Security, pluggable Telegram/In-App/Webhook notifications, and modular userscript browser assistance).

---

## 🌟 Key Features

- **First-Class Movie Language Support**: Specifically track distinct audio/language versions of a movie:
  - **Tamil**, **Telugu**, **Hindi**, **Malayalam**, **Kannada**, **English**.
  - Example: Track *Paradise* in **Telugu** at *KG Cinemas, Coimbatore* without false triggering on *Paradise* in **Tamil**.
- **Multi-Platform Ticket Tracking**: Monitors BookMyShow and Zomato District simultaneously or individually.
- **Smart City & Cinema Filtering**: Select movie, language, date (*24 September 2026*), city (*Coimbatore, Chennai, Bangalore, Hyderabad*), and theatre screen (*KG Cinemas, Broadway, PVR INOX*).
- **Live Status Badges**:
  - `🟡 Waiting for tickets` (WAITING)
  - `🔄 Checking...` (CHECKING)
  - `🟢 Tickets Released` (RELEASED)
  - `🟢 Tickets Released & Notified` (NOTIFIED)
  - `🔴 Retrying / Warning` (ERROR with retry handling)
  - `⚪ Cancelled` (CANCELLED)
- **Pluggable Notification System**:
  - **In-App Notification Audit History** (100% Free, zero external setup)
  - **Telegram Bot** (100% Free real-time phone push alerts with language and deep showtime links)
  - **n8n / Webhook Dispatcher** (100% Free automation triggers)
  - **Voice Call Service** (Pre-wired Twilio / Exotel telephony interface for voice alerts)
- **Automated Monitoring Worker & Cron API**:
  - Standalone Node/TypeScript background worker daemon (`npm run worker`)
  - Secured Cron Endpoint (`/api/cron/check-alerts`) for Vercel Cron, GitHub Actions, or n8n
- **Browser-Assisted Zero-Cost Userscript**:
  - Detects live tickets from authenticated browser sessions (bypassing Cloudflare/SPA restrictions without breaking any security or terms).
  - Contains **zero privileged server secrets**.
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

## 🌐 Real-World Example Alert

To monitor the newly opened **Paradise Telugu** release:

```text
Movie:     Paradise
Language:  Telugu
City:      Coimbatore
Theatre:   KG Cinemas
Date:      24 September 2026
Platform:  BookMyShow
```

When tickets are detected:
- The alert transitions: `WAITING` ➔ `RELEASED` ➔ `NOTIFIED`.
- Notification dispatched:
  > *"🎬 Tickets Released! Shows for 'Paradise' (Telugu) at KG Cinemas, Coimbatore on 2026-09-24 are now open for booking via BookMyShow."*

---

## 🗄️ Database Schema & Migrations

Database schema files are located in `supabase/migrations/`:
- `20260922_init.sql`: Core schema, indexes, and Row Level Security policies.
- `20260923_add_alert_language.sql`: Adds `language TEXT NOT NULL DEFAULT 'Tamil'` to `alerts` table and updates the composite index.

### Backward Compatibility:
Existing alerts without an explicit language automatically default to `'Tamil'` ensuring zero downtime or data loss.

---

## 🧩 Browser Userscript (BookMyShow + District)

Because BookMyShow uses Cloudflare bot protection and District renders showtimes client-side via React SPA, the included Tampermonkey userscript monitors showtimes directly from your own browser.

### How Userscript Language Detection Works:
1. **JSON-LD Schema Inspection**: Checks structured `ScreeningEvent` objects for `inLanguage` and `name` tags.
2. **Dimension Pills & Format Badges**: Scans BMS DOM elements (`[class*="dimension-pill"]`, `[class*="language"]`, `span.pill`) for exact language badges.
3. **Document Title & URL Parsing**: Detects language suffixes in URLs (`/paradise-telugu-cinemas-...`) and title headers.
4. **Safety & False Positive Prevention**: If language cannot be determined from the page, the script logs `[MTA] Language could not be determined` and **does NOT** report a false release.
5. **Debug Telemetry**: Outputs clear diagnostic logging in the browser console:
   ```text
   [MTA DEBUG] Page movie: Paradise
   [MTA DEBUG] Page language: Telugu
   [MTA DEBUG] Alert movie: Paradise
   [MTA DEBUG] Alert language: Telugu
   [MTA DEBUG] Movie match: true
   [MTA DEBUG] Language match: true
   [MTA DEBUG] Date match: true
   [MTA DEBUG] Theatre match: true
   [MTA DEBUG] Final alert match: true
   ```

### 🔒 Security Guarantee:
The userscript contains **NO privileged server secrets**:
- ❌ No `CRON_SECRET`
- ❌ No `SUPABASE_SERVICE_ROLE_KEY`
- ❌ No database credentials
- ❌ No Telegram Bot tokens
The script interacts strictly through user-scoped API headers (`x-user-id`) verifying alert ownership.

---

## 🧪 Automated Testing

Run the comprehensive test suite (37+ tests covering all false-positive and matching cases):

```bash
npm run test
```

### Verified Test Cases:
1. ✅ Existing alerts without explicit language default safely to `Tamil`.
2. ✅ `Paradise Telugu` matches `Paradise Telugu`.
3. ✅ `Paradise Telugu` does NOT match `Paradise Tamil` (rejected with 400).
4. ✅ `Paradise Tamil` does NOT match `Paradise Telugu` (rejected with 400).
5. ✅ Full composite match: Movie + Language + Theatre + City + Date.
6. ✅ Wrong movie rejection.
7. ✅ Wrong theatre rejection.
8. ✅ Wrong city rejection.
9. ✅ Wrong date rejection.
10. ✅ External-check user ownership and security isolation.
11. ✅ Duplicate notification deduplication guard.
12. ✅ State machine transitions and terminal protection.

---

## 🚀 Building for Production

```bash
npm run build
```

---

## 📝 Limitations & Notes

- **Language Visibility**: If a ticketing website does not display the movie language anywhere on the showtimes page, the userscript will not guess the language and will avoid false releases.
- **Provider Restrictions**: Direct server-side fetches to BookMyShow return HTTP 403 (Cloudflare) and District is an SPA; live real-world monitoring is executed via the zero-cost browser userscript.

---

## 📜 License
MIT License. Built for accurate, zero-cost movie ticket release alerts.
