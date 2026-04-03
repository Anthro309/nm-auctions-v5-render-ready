const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// =========================
// FILE PATHS
// =========================
const USERS_FILE = 'users.json';
const ITEMS_FILE = 'items.json';
const REPORTS_FILE = 'reports.json';
const NOTIFICATIONS_FILE = 'notifications.json';
const INTAKE_FILE = 'intake.json';

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
    console.error('READ ERROR:', file, err);
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
// ENSURE FILES
// =========================
ensureArrayFile(ITEMS_FILE);
ensureArrayFile(REPORTS_FILE);
ensureArrayFile(NOTIFICATIONS_FILE);
ensureArrayFile(INTAKE_FILE);
ensureUsersExist();

if (!fs.existsSync(path.join(__dirname, 'public/uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'public/uploads'), { recursive: true });
}

// =========================
// MULTER
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
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
// NEXT LOT CODE
// =========================
app.get('/next-lot-code', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const month = req.query.month || monthLetterForDate(new Date());

  const usedNumbers = items
    .map(i => i.lotNumber)
    .filter(Boolean)
    .filter(l => l.startsWith(month))
    .map(l => parseInt(l.slice(1)))
    .filter(n => !isNaN(n));

  const next = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
  const lotCode = `${month}${String(next).padStart(3, '0')}`;

  res.json({ lotCode });
});

// =========================
// ADD ITEMS (INTAKE)
// =========================
app.post('/addItems', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const incoming = req.body.items || [];

  const existingCodes = new Set(items.map(i => i.lotNumber));

  for (let i of incoming) {
    if (existingCodes.has(i.lotCode)) {
      return res.status(400).json({
        success: false,
        message: `Duplicate lot code: ${i.lotCode}`
      });
    }
  }

  const newItems = incoming.map(i => {
    const item = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: i.title,
      consigner: `${i.consignerFirstName} ${i.consignerLastName}`,
      code: i.consignerCode,
      number: i.itemNumber,
      part: i.partCount,
      photos: [],
      stage: 'Received at Studio',
      lotNumber: i.lotCode,
      createdAt: i.createdAt,
      logs: []
    };

    addLog(item, {
      employee: i.createdBy,
      action: 'item received',
      toStage: 'Received at Studio'
    });

    addLog(item, {
      employee: i.createdBy,
      action: 'handoff requested',
      fromStage: 'Received at Studio',
      toStage: 'Review & Cleaning'
    });

    return item;
  });

  writeJSON(ITEMS_FILE, [...items, ...newItems]);

  res.json({ success: true });
});

// =========================
// ITEMS
// =========================
app.get('/items', (req, res) => {
  res.json(readJSON(ITEMS_FILE));
});

// =========================
// UPLOAD
// =========================
app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false });
  }

  res.json({
    success: true,
    path: `/uploads/${req.file.filename}`
  });
});

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});