const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple ID generator
function id() {
  return Math.random().toString(36).substring(2, 12);
}

// Load DB
function loadDb() {
  if (fs.existsSync(DB_PATH)) {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  }
  return { employees: [], items: [], reports: [] };
}

// Save DB
function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let db = loadDb();


// 🔥 AUTO FIX USERS (IMPORTANT)
function ensureUser() {
  if (!db.employees || db.employees.length === 0) {
    db.employees = [
      { id: id(), firstName: "Fabian", pin: "1234", isAdmin: true }
    ];
    saveDb();
    return;
  }

  // Convert old bcrypt users to simple PIN
  db.employees = db.employees.map(user => ({
    id: user.id || id(),
    firstName: user.firstName || "User",
    pin: "1234", // reset pin
    isAdmin: user.isAdmin ?? true
  }));

  saveDb();
}

ensureUser();


// ------------------- AUTH -------------------

app.post('/api/login', (req, res) => {
  const { firstName, pin } = req.body;

  const user = db.employees.find(
    e => e.firstName.toLowerCase() === String(firstName).toLowerCase()
  );

  if (!user || user.pin !== String(pin)) {
    return res.status(401).json({ error: "Invalid login" });
  }

  res.json({ user });
});


// ------------------- ITEMS -------------------

app.post('/api/items', (req, res) => {
  const { name } = req.body;

  const item = {
    id: id(),
    name,
    status: "drop_off",
    createdAt: new Date().toISOString()
  };

  db.items.push(item);
  saveDb();

  res.json(item);
});

app.get('/api/items', (req, res) => {
  res.json(db.items);
});


// ------------------- DAILY CLOSE -------------------

app.post('/api/close-day', (req, res) => {
  const report = {
    id: id(),
    date: new Date().toLocaleDateString(),
    items: db.items
  };

  db.reports.push(report);
  db.items = [];
  saveDb();

  res.json(report);
});

app.get('/api/reports', (req, res) => {
  res.json(db.reports);
});


// ------------------- HEALTH -------------------

app.get('/api/health', (_req, res) => {
  res.json({ status: "OK" });
});


// ------------------- FRONTEND -------------------

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
  console.log(`NM Auctions V5 running on port ${PORT}`);
});
