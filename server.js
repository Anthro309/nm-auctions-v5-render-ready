const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static('public'));

// =========================
// FILE PATHS
// =========================
const USERS_FILE = 'users.json';
const ITEMS_FILE = 'items.json';
const REPORTS_FILE = 'reports.json';
const NOTIFICATIONS_FILE = 'notifications.json';
const INTAKE_FILE = 'intake.json'; // ✅ ADDED

// =========================
// HELPERS
// =========================
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('READ ERROR:', err);
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function ensureArrayFile(file) {
  if (!fs.existsSync(file)) {
    writeJSON(file, []);
  }
}

function ensureUsersExist() {
  const users = readJSON(USERS_FILE);

  if (!users.length) {
    const defaultUsers = [
      { name: 'Fabian', pin: '1234', isAdmin: true },
      { name: 'James', pin: '1234', isAdmin: true },
      { name: 'Steven', pin: '1234', isAdmin: true },
      { name: 'Mike', pin: '1234', isAdmin: false },
      { name: 'Gio', pin: '1234', isAdmin: false },
      { name: 'Hector', pin: '1234', isAdmin: false },
      { name: 'Michelle', pin: '1234', isAdmin: false },
      { name: 'Sara', pin: '1234', isAdmin: false }
    ];

    writeJSON(USERS_FILE, defaultUsers);
    console.log('🔥 Users seeded');
  }
}

function monthLetterForDate(date = new Date()) {
  return 'ABCDEFGHIJKL'[date.getMonth()];
}

function nextLotNumber(items, date = new Date()) {
  const letter = monthLetterForDate(date);

  const usedNumbers = items
    .map(item => item.lotNumber)
    .filter(Boolean)
    .filter(lot => typeof lot === 'string' && lot.startsWith(letter))
    .map(lot => parseInt(lot.slice(1), 10))
    .filter(num => !Number.isNaN(num));

  const next = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
  return `${letter}${String(next).padStart(3, '0')}`;
}

function addLog(item, entry) {
  if (!Array.isArray(item.logs)) item.logs = [];

  item.logs.push({
    timestamp: new Date().toISOString(),
    employee: entry.employee || 'system',
    action: entry.action || '',
    fromStage: entry.fromStage || null,
    toStage: entry.toStage || null,
    reason: entry.reason || null,
    note: entry.note || null
  });
}

function addNotification(message, itemId = null, code = null, type = 'general') {
  const notifications = readJSON(NOTIFICATIONS_FILE);

  notifications.unshift({
    id: Date.now(),
    message,
    itemId,
    code,
    type,
    createdAt: new Date().toISOString(),
    read: false
  });

  writeJSON(NOTIFICATIONS_FILE, notifications);
}

function validStage(stage) {
  return [
    'Initial Visit',
    'Received at Studio',
    'Missing at Drop Off',
    'Review & Cleaning',
    'Photograph',
    'Prep for Pickup',
    'Picked Up'
  ].includes(stage);
}

// =========================
// ENSURE FILES/FOLDERS
// =========================
ensureArrayFile(ITEMS_FILE);
ensureArrayFile(REPORTS_FILE);
ensureArrayFile(NOTIFICATIONS_FILE);
ensureArrayFile(INTAKE_FILE); // ✅ ADDED
ensureUsersExist();

if (!fs.existsSync('public/uploads')) {
  fs.mkdirSync('public/uploads', { recursive: true });
}

// =========================
// MULTER
// =========================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// =========================
// LOGIN
// =========================
app.post('/login', (req, res) => {
  const { name, pin } = req.body;
  const users = readJSON(USERS_FILE);

  const user = users.find(
    u =>
      u.name.toLowerCase().trim() === String(name || '').toLowerCase().trim() &&
      u.pin === String(pin || '')
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid login' });
  }

  res.json({
    success: true,
    user: {
      name: user.name,
      isAdmin: user.isAdmin
    }
  });
});

// =========================
// UPLOAD
// =========================
app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  res.json({
    success: true,
    path: `/uploads/${req.file.filename}`
  });
});

// =========================
// ITEMS
// =========================
app.get('/items', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  res.json(items);
});

app.post('/items', (req, res) => {
  const items = readJSON(ITEMS_FILE);

  const newItem = {
    id: Date.now(),
    name: req.body.name || '',
    consigner: req.body.consigner || '',
    code: req.body.code || '',
    number: req.body.number || 1,
    photos: Array.isArray(req.body.photos) ? req.body.photos : [],
    stage: 'Initial Visit',
    createdAt: new Date().toISOString(),
    logs: []
  };

  addLog(newItem, {
    employee: req.body.employee || 'system',
    action: 'item created'
  });

  items.push(newItem);
  writeJSON(ITEMS_FILE, items);

  res.json(newItem);
});

// =========================
// INTAKE REPORTS (ADDED)
// =========================
app.post('/intake', (req, res) => {
  const intake = readJSON(INTAKE_FILE);

  const report = {
    id: Date.now(),
    code: req.body.code,
    consigner: req.body.consigner,
    items: req.body.items,
    createdAt: new Date().toISOString()
  };

  intake.push(report);
  writeJSON(INTAKE_FILE, intake);

  res.json({ success: true, report });
});

app.get('/intake', (req, res) => {
  const intake = readJSON(INTAKE_FILE);
  res.json(intake);
});

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});