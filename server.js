const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// ===== FILE PATHS =====
const USERS_FILE = './users.json';
const ITEMS_FILE = './items.json';
const REPORTS_FILE = './reports.json';

// ===== ENSURE UPLOADS FOLDER =====
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// ===== FILE STORAGE (PHOTO UPLOAD) =====
const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// serve uploaded images
app.use('/uploads', express.static('uploads'));

// ===== SAFE JSON READ =====
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file));
  } catch (err) {
    console.error("READ ERROR:", err);
    return [];
  }
}

// ===== WRITE JSON =====
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ===== SEED USERS =====
function ensureUsersExist() {
  let users = readJSON(USERS_FILE);

  if (!users || users.length === 0) {
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

ensureUsersExist();

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

// ===== PHOTO UPLOAD =====
app.post('/upload', upload.single('photo'), (req, res) => {
  res.json({
    path: `/uploads/${req.file.filename}`
  });
});

// ===== CREATE ITEM =====
app.post('/items', (req, res) => {
  const items = readJSON(ITEMS_FILE);

  const item = {
    id: Date.now(),
    name: req.body.name,
    consigner: req.body.consigner,
    code: req.body.code,
    number: req.body.number,
    stage: "Initial Visit",
    photos: req.body.photos || [],
    createdAt: new Date(),
    logs: []
  };

  items.push(item);
  writeJSON(ITEMS_FILE, items);

  res.json(item);
});

// ===== GET ALL ITEMS =====
app.get('/items', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  res.json(items);
});

// ===== UPDATE ITEM (DETAIL PAGE USES THIS) =====
app.post('/items/:id', (req, res) => {
  const items = readJSON(ITEMS_FILE);

  const index = items.findIndex(i => i.id == req.params.id);

  if (index === -1) {
    return res.status(404).send("Item not found");
  }

  items[index] = req.body;

  writeJSON(ITEMS_FILE, items);

  res.json(items[index]);
});

// ===== UPDATE ITEM STAGE =====
app.post('/items/:id/stage', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => i.id == req.params.id);

  if (!item) return res.status(404).send("Item not found");

  const { stage, employee, reason, skipped } = req.body;

  if (skipped && !reason) {
    return res.status(400).json({ error: "Reason required" });
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
});

// ===== DAILY CLOSEOUT =====
app.post('/closeout', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const reports = readJSON(REPORTS_FILE);

  const today = new Date().toDateString();

  const todaysItems = items.filter(
    i =>
      i.stage === "Photograph" &&
      new Date(i.createdAt).toDateString() === today
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