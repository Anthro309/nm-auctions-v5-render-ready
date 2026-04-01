function ensureUsersExist() {
  if (!fs.existsSync('./users.json')) {
    const defaultUsers = [
      { name: "Fabian", pin: "1234", isAdmin: true },
      { name: "James", pin: "1234", isAdmin: true },
      { name: "Steven", pin: "1234", isAdmin: true },
      { name: "Mike", pin: "1234", isAdmin: false },
      { name: "Gio", pin: "1234", isAdmin: false },
      { name: "Hector", pin: "1234", isAdmin: false },
      { name: "Michelle", pin: "1234", isAdmin: false },
      { name: "Sara", pin: "1234", isAdmin: false }
    ];

    fs.writeFileSync('./users.json', JSON.stringify(defaultUsers, null, 2));
    console.log("🔥 Users seeded");
  }
}

ensureUsersExist();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// ===== FILE PATHS =====
const USERS_FILE = './users.json';
const ITEMS_FILE = './items.json';
const REPORTS_FILE = './reports.json';

// ===== HELPERS =====
function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getMonthLetter() {
  const months = "ABCDEFGHIJKL";
  return months[new Date().getMonth()];
}

function generateLotNumber(items) {
  const letter = getMonthLetter();
  const existing = items
    .filter(i => i.lotNumber)
    .map(i => parseInt(i.lotNumber.slice(1)) || 0);

  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `${letter}${String(next).padStart(3, '0')}`;
}

// ===== LOGIN =====
app.post('/login', (req, res) => {
  const { name, pin } = req.body;
  const users = readJSON(USERS_FILE);

  const user = users.find(
    u =>
      u.name.toLowerCase().trim() === name.toLowerCase().trim() &&
      u.pin === pin
  );

  if (!user) {
    return res.status(401).json({ success: false });
  }

  res.json({ success: true, user });
});

// ===== CREATE ITEM =====
app.post('/items', (req, res) => {
  const items = readJSON(ITEMS_FILE);

  const newItem = {
    id: Date.now(),
    name: req.body.name,
    consigner: req.body.consigner,
    stage: "Drop off",
    createdAt: new Date(),
    logs: []
  };

  items.push(newItem);
  writeJSON(ITEMS_FILE, items);

  res.json(newItem);
});

// ===== UPDATE STAGE =====
app.post('/items/:id/stage', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => i.id == req.params.id);

  if (!item) return res.status(404).send("Item not found");

  const { stage, employee, reason } = req.body;

  if (req.body.skipped && !reason) {
    return res.status(400).json({ error: "Reason required" });
  }

  if (stage === "Photograph" && !item.lotNumber) {
    item.lotNumber = generateLotNumber(items);
    item.photographedAt = new Date();
  }

  item.stage = stage;

  item.logs.push({
    stage,
    employee,
    reason: reason || null,
    timestamp: new Date()
  });

  writeJSON(ITEMS_FILE, items);

  res.json(item);
});

// ===== DAILY CLOSEOUT =====
app.post('/closeout', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const reports = readJSON(REPORTS_FILE);

  const today = new Date().toDateString();

  const todaysItems = items.filter(
    i =>
      i.photographedAt &&
      new Date(i.photographedAt).toDateString() === today
  );

  const report = {
    date: today,
    items: todaysItems
  };

  reports.push(report);
  writeJSON(REPORTS_FILE, reports);

  res.json(report);
});

// ===== GET REPORTS =====
app.get('/reports', (req, res) => {
  const reports = readJSON(REPORTS_FILE);
  res.json(reports);
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🔥 NM Auctions running at http://localhost:${PORT}`);
});