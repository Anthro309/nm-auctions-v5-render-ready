const express = require("express");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();

const DATA_DIR = process.env.DATA_DIR || "./data";
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// 🔥 FORCE RESET (this guarantees login works)
console.log("🔥 Resetting DB with default user...");

fs.writeFileSync(DB_FILE, JSON.stringify({
  employees: [
    { id: "1", name: "Fabian", pin: "1234", mustChangePin: true, isAdmin: true }
  ],
  items: [],
  reports: []
}, null, 2));

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 🔐 LOGIN (case-insensitive name)
app.post("/api/login", (req, res) => {
  const { name, pin } = req.body;
  const db = readDB();

  console.log("LOGIN ATTEMPT:", name, pin);

  const user = db.employees.find(
    e => e.name.toLowerCase() === (name || "").toLowerCase() && e.pin === pin
  );

  if (!user) {
    console.log("❌ LOGIN FAILED");
    return res.status(401).json({ error: "Invalid login" });
  }

  console.log("✅ LOGIN SUCCESS");
  res.json(user);
});

// Add Item
app.post("/api/items", (req, res) => {
  const db = readDB();

  const item = {
    id: uuidv4(),
    name: req.body.name,
    status: "drop_off",
    createdAt: new Date().toISOString()
  };

  db.items.push(item);
  writeDB(db);

  res.json(item);
});

// Close Day
app.post("/api/close-day", (req, res) => {
  const db = readDB();

  const report = {
    id: uuidv4(),
    date: new Date().toLocaleDateString(),
    items: db.items
  };

  db.reports.push(report);
  db.items = [];

  writeDB(db);

  res.json(report);
});

// Get Reports
app.get("/api/reports", (req, res) => {
  const db = readDB();
  res.json(db.reports);
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Running on port " + PORT));