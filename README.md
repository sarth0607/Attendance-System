# GPS-Based Dynamic Attendance & Anti-Proxy System

A complete, mobile-first college event attendance web application that makes **proxy attendance substantially harder** using GPS geofencing + dynamic forms + duplicate prevention + server-generated device/session tokens + IP/session analysis + suspicious-activity detection — while keeping the student experience dead simple:

```
Open attendance link → Fill form → Allow GPS → Submit → Attendance recorded
```

No college Wi-Fi, no college accounts, no OTP, no 4-digit codes, no app.

---

## Quick start

```bash
npm install
npm start
```

- **Student page:** students only ever see the single form behind the link the coordinator shares — `http://<host>/f/<formId>` (Admin Panel → **🔗 Copy Link**). The root page `/` shows no form list.
- **Admin panel:** http://localhost:3000/admin — default credentials `admin` / `admin123` (**change the password immediately** from the panel's top-right menu)

Without configuration the server boots an **embedded in-memory MongoDB** (zero setup, data resets on restart). For a real deployment set `MONGODB_URI` in `.env` (copy `.env.example`):

```bash
cp .env.example .env   # set MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD, COOKIE_SECURE=true
npm start
```

Demo forms are seeded on first boot (Freshers Orientation 2026 — open, Technical Workshop — closed, Cultural Event — draft) with the venue fence near Mandoli, Delhi. Adjust coordinates from **Admin → form → Settings** ("Use my current location" captures them in one click).

## Tech stack

- **Frontend:** plain HTML/CSS/JS, mobile-first, no build step
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose (collections: `admins`, `forms`, `form_versions`, `attendance`, `security_events`, `devices`; questions are embedded in form versions, forms double as events)
- **Excel export:** ExcelJS (`.xlsx`)

## Architecture

```
server.js                     HTTP server, static pages, route mounting
src/
  config/db.js                MONGODB_URI or embedded in-memory MongoDB
  models/                     Mongoose schemas
  middleware/
    auth.js                   JWT admin authentication (Bearer token)
    device.js                 server-generated crypto device/session token (HttpOnly cookie)
  services/
    attendanceService.js      submission pipeline: schedule → validation → duplicate → GPS → proxy
    securityService.js        per-device sliding-window analysis, security summary
    queryService.js           dynamic response filters/search/facets
    exportService.js          dynamic .xlsx generation
  routes/
    public.routes.js          student endpoints (no admin capability exposed)
    admin.routes.js           all admin capability (JWT-protected)
  utils/                      Haversine, question schema/validation, ids, rate limiting
public/                       student pages + admin SPA (vanilla JS)
scripts/seed.js               seed CLI (node scripts/seed.js [--reset])
```

## How the anti-proxy stack works

1. **GPS geofence (primary):** the browser requests location **once, only at submit**. The **server** computes Haversine distance to the configured venue and rejects anything beyond the radius or with accuracy worse than the threshold. A client-sent “verified” flag is never trusted — distance is always recomputed server-side.
2. **Duplicate prevention (optional):** the admin may designate any question as the **Unique Identifier**. When set, only one successful submission per identifier per form. When left as *none*, there is no publishing restriction — every response automatically gets an **auto-incrementing serial number (S.No)** that appears in the response tables and as the first column of the Excel export. Proxy detection then counts each submission as a separate identity.
3. **Device/session token:** on first page open the **server** generates a 192-bit crypto-random opaque token in an HttpOnly cookie. It carries no personal data and is attached automatically to submissions.
4. **Proxy detection:** if more than *N* different student identities submit from one device token within *M* minutes (both configurable, per form), submissions are **flagged** or **blocked** (admin chooses the mode). Existing submissions keep their flags until an admin marks them legitimate or rejects them.
5. **IP tracking:** the server-observed IP is stored per attempt and shown as a **supporting signal only** — carrier NAT / college Wi-Fi / hotspots legitimately share IPs, so *same IP ≠ same device*.
6. **Security dashboard:** per-device stats (identities, peak identities in any sliding window, time span, IPs), per-IP stats, security events with one-click *Mark legitimate* / *Reject*.
7. **Clubbed responses:** the Responses tab has a *Club by device* toggle that groups all submissions by device/session token (each device gets a consistent colour dot), showing submission count, distinct identities, IPs and flags per device — same-colour dots also appear in the flat table so same-device rows are always visually linked.

## Draft → Publish versioning

Students only ever see the latest **published** version. Admins edit the **draft** freely (questions, order, options) without affecting the live form. Publishing snapshots the draft into an immutable **v1, v2, v3…** with its settings. Every attendance record stores the form version used at submission time, so history is never rewritten when a new version is published.

## Excel export

**Responses → Export .xlsx** — dynamic columns (one per question, across all versions or filtered to one) plus Timestamp, Lat, Lng, Accuracy, Distance, Status, Proxy Flag, Device Token, IP, User Agent, Version. Exports **All** or **Filtered** (whatever filters are currently applied). Flagged rows are highlighted, and a Summary sheet is included.

## Notes

- Geolocation requires HTTPS (or `localhost`). Browsers may block location inside embedded previews/iframes — open the student link in a normal browser tab.
- `MAX.body` is rate-limited per device token (20 submissions / 5 min) and admin login is rate-limited.
- Student endpoints expose zero administrative functionality; everything under `/api/admin/*` requires a valid admin JWT.
- Privacy: location is requested only at submission, never tracked continuously; device tokens are opaque; IP/UA are retained only for attendance security.
