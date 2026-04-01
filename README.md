# NM Auctions V5

A deployment-ready Node.js app for NM Auctions with:
- employee PIN login
- consigner drop offs
- lot/item intake
- workflow handoffs with acceptance
- required reason when skipping a step
- notification center for incoming approvals
- daily close out with printable photographed-item report
- stored daily reports visible to all employees

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:3000`

## Default logins

On first run the app seeds these users. Every user starts with PIN `1234` and is forced to change it at first login.

- James (admin)
- Fabian (admin)
- Steven (admin)
- Mike
- Gio
- Hector
- Michelle
- Sara

## Render deployment

### 1. Push this project to GitHub

### 2. Create a new Web Service on Render
- Environment: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

### 3. Optional persistent disk
This app uses SQLite by default. To keep data across restarts on Render, attach a persistent disk and set:

- Mount path: `/var/data`
- Environment variable: `DATA_DIR=/var/data`

If you do not attach a disk, the app will still run, but data may reset when the service restarts.

## Printing
Use the built-in print button on the daily report page. Reports are formatted for regular letter paper.

## Notes
- This is a strong MVP, built to be stable and deployable.
- For production at larger scale, move to PostgreSQL and durable session storage.
