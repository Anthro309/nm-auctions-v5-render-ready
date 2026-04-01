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

// ===== SAFE READ =====
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '[]');
      return [];
    }
    return JSON.parse(fs.readFileSync(file));
  } catch (err) {
    console.error("READ ERROR:", err);
    return [];
  }
}

// ===== SAFE WRITE =====
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ===== SEED USERS =====
function ensureUsersExist() {
  let users = readJSON(USERS_FILE);

  if (users.length === 0) {
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

    writeJSON(USERS_FILE, defaultUsers);
    console.log("🔥 Users seeded");
  }
}

// ===== INIT FILES =====
function ensureFilesExist() {
  if (!fs.existsSync(ITEMS_FILE)) writeJSON(ITEMS_FILE, []);
  if (!fs.existsSync(REPORTS_FILE)) writeJSON(REPORTS_FILE, []);
}

ensureUsersExist();
ensureFilesExist();

// ===== HELPERS =====
function getMonthLetter() {
  return "ABCDEFGHIJKL"[new Date().getMonth()];
}

function generateLotNumber(items) {
  const letter = getMonthLetter();
  const nums = items
    .map(i => parseInt((i.lotNumber || '').slice(1)) || 0);

  const next = nums.length ? Math.max(...nums) + 1 : 1;

  return `${letter}${String(next).padStart(3, '0')}`;
}

// ===== LOGIN =====
app.post('/login', (req, res) => {
  try {
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

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ success: false });
  }
});

// ===== CREATE ITEM =====
app.post('/items', (req, res) => {
  try {
    const items = readJSON(ITEMS_FILE);

    const item = {
      id: Date.now(),
      name: req.body.name,
      consigner: req.body.consigner,
      stage: "Drop off",
      logs: [],
      createdAt: new Date()
    };

    items.push(item);
    writeJSON(ITEMS_FILE, items);

    res.json(item);

  } catch (err) {
    console.error("CREATE ITEM ERROR:", err);
    res.status(500).send("Error");
  }
});

// ===== UPDATE STAGE =====
app.post('/items/:id/stage', (req, res) => {
  try {
    const items = readJSON(ITEMS_FILE);
    const item = items.find(i => i.id == req.params.id);

    if (!item) return res.status(404).send("Not found");

    const { stage, employee, reason, skipped } = req.body;

    if (skipped && !reason) {
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
      time: new Date()
    });

    writeJSON(ITEMS_FILE, items);

    res.json(item);

  } catch (err) {
    console.error("STAGE ERROR:", err);
    res.status(500).send("Error");
  }
});

// ===== CLOSEOUT =====
app.post('/closeout', (req, res) => {
  try {
    const items = readJSON(ITEMS_FILE);
    const reports = readJSON(REPORTS_FILE);

    const today = new Date().toDateString();

    const todaysItems = items.filter(
      i =>
        i.photographedAt &&
        new Date(i.photographedAt).toDateString() === today
    );

    const report = { date: today, items: todaysItems };

    reports.push(report);
    writeJSON(REPORTS_FILE, reports);

    res.json(report);

  } catch (err) {
    console.error("CLOSEOUT ERROR:", err);
    res.status(500).send("Error");
  }
});

// ===== GET REPORTS =====
app.get('/reports', (req, res) => {
  try {
    res.json(readJSON(REPORTS_FILE));
  } catch (err) {
    console.error("REPORT ERROR:", err);
    res.status(500).send("Error");
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🔥 NM Auctions running at http://localhost:${PORT}`);
});