# Auction Legacy

Internal studio operations platform for NM Estate Auctions. Manages the full lifecycle of consigned items — from home visit intake through photography, prep, and pickup — with AI-assisted descriptions, QR scanning, and real-time workflow tracking.

Deployed on Render. Built mobile-first as a PWA (installable on home screen).

> Product scope: this system is intentionally focused on internal inventory/workflow operations and is not coupled to external auction-site or post-sale systems.

---

## Tech Stack

- **Backend:** Node.js + Express
- **Storage:** JSON flat files (items, users, reports)
- **Frontend:** Vanilla JS, mobile-first CSS
- **AI:** OpenAI GPT-4o-mini (photo analysis, auction descriptions, voice intake)
- **QR:** jsQR + QRCode.js
- **Hosting:** Render (auto-deploy from `main`)

---

## Item Workflow

Every item moves through these stages in order:

| Stage | Triggered by |
|---|---|
| **Home Visit** | Item created during initial visit intake |
| **Received at Studio** | Employee scans item in at the scanner |
| **Review & Cleaning** | Employee advances on item detail page |
| **Photograph** | Employee advances on item detail page |
| **Prep for Pick Up** | Employee advances on item detail page |
| **Ready for Pick Up** | Employee advances on item detail page |
| **Picked Up** | Employee advances on item detail page |

Special flags: **Missing at Drop Off**, **Needs Repair**

Every stage change logs the timestamp and the employee who made it.

---

## Features

### Initial Visit (Home Visit Intake)
- Enter consigner first + last name to generate a consigner code (e.g. `FABMAL`)
- Add items one at a time with name, description, category, condition
- **AI photo analysis** — take or upload a photo, GPT identifies the item and fills all fields
- **Voice-to-item** — tap the mic, speak a description, AI fills the fields
- **Estimated value range** — AI suggests a USD auction value range from the photo
- **AI tags** — 4–8 keyword tags generated automatically for search and filtering
- **Duplicate detection** — warns if a similar item already exists in the system
- Print Avery 1" × 2⅝" labels (30-up sheet) for all items in the session
- Any employee can delete an item during the visit

### Scanner
- Scan QR codes with the device camera or a hardware barcode scanner
- **Name search fallback** — type any keyword to search items by name, lot, or consigner
- Items at "Home Visit" show a **Check In to Studio** button to advance to Received at Studio
- All scans are logged with the employee's name and timestamp

### Item Detail
- Full item info: photo, lot number, consigner, stage, location, description
- **Advance Stage** button — any employee can move the item to the next stage
- **Location field** — record physical shelf/rack location (e.g. Rack A1, Shelf 3)
- **Repair flag** — mark an item as needing repair with a note; shows orange warning banner; prompts confirmation before stage advance
- **Auction Description Generator** — enter dimensions, condition update, and notes; AI produces a professional estate-auction listing description (80–150 words)
- **Description feedback** — thumbs up/down on generated descriptions
- **Copy Description** — one tap to copy to clipboard
- **AI Tags + Estimated Value** — displayed as colored pills and a green value badge
- **Print Label** — reprint an Avery label for any item
- **Flag as Missing** — marks item Missing at Drop Off with a red alert
- **Stage History** — full log of every action, employee, and timestamp
- **Admin only:** Delete item permanently

### Item Library
- Browse all items grouped by consigner
- Search by name, lot number, or consigner code
- **Batch Stage Advance** — switch to Batch mode, select multiple items with checkboxes, pick a stage, advance all at once (ideal after a photo session)
- **Export Auction Listings CSV** — downloads all items in Photograph or Prep for Pick Up stage, including AI description, tags, and estimated value

### Dashboard
- Welcome card with logged-in employee name
- Live stats: Total in Inventory / Ready to Photograph / Photographed Today
- Quick-launch tiles: Initial Visit, Scanner, Item Library, Reports

### Reports & Analytics
- Daily summary: items photographed today, total moved
- Analytics overview: stage breakdown, category counts, revenue totals
- Closeout reports

### Employee & Admin
- Name + 4-digit PIN login
- Role-based access: admin vs. employee
- Admin panel: add/remove employees, set PINs, upload profile photos
- Profile page: view your own activity
- Admins can delete items from the Item Library

---

## Project Structure

```
/
├── server.js              # Express API + all endpoints
├── package.json
├── users.json             # Employee accounts + PINs
├── items.json             # All consigned items
├── reports.json           # Generated closeout reports
└── public/
    ├── index.html         # Login page
    ├── dashboard.html
    ├── initial-visit.html # Home visit intake
    ├── scanner.html
    ├── items.html         # Item library + batch advance
    ├── consigner.html     # Items by consigner
    ├── item.html          # Item detail + all actions
    ├── reports.html
    ├── analytics.html
    ├── admin.html
    ├── profile.html
    ├── manifest.json      # PWA manifest
    ├── icon-192.png
    ├── icon-512.png
    ├── styles.css
    ├── nav.js
    └── service-worker.js
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes (for AI features) | GPT-4o-mini for photo analysis, descriptions, voice |
| `PORT` | No | Defaults to 10000 |

---

## Deploying on Render

1. Connect the `Anthro309/nm-auctions-v5-render-ready` repo
2. Build command: *(none)*
3. Start command: `node server.js`
4. Add `OPENAI_API_KEY` as an environment variable
5. Render auto-deploys on every push to `main`

---

## PWA / Home Screen Install

The app is installable as a PWA on Android and iOS.

- **Android:** Open in Chrome → browser menu → "Add to Home Screen"
- **iOS:** Open in Safari → Share → "Add to Home Screen"

The app icon shows the **AL** monogram on a dark navy background.
