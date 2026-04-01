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

function addNotification(message, itemId = null, code = null) {
  const notifications = readJSON(NOTIFICATIONS_FILE);
  notifications.unshift({
    id: Date.now(),
    message,
    itemId,
    code,
    createdAt: new Date().toISOString(),
    read: false
  });
  writeJSON(NOTIFICATIONS_FILE, notifications);
}

// =========================
// ENSURE FILES/FOLDERS
// =========================
ensureArrayFile(ITEMS_FILE);
ensureArrayFile(REPORTS_FILE);
ensureArrayFile(NOTIFICATIONS_FILE);
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
    location: null,
    lotNumber: null,
    photographedAt: null,
    lotAssignedAt: null,
    lotAssignedBy: null,
    pendingHandoff: null,
    createdAt: new Date().toISOString(),
    logs: []
  };

  addLog(newItem, {
    employee: req.body.employee || 'system',
    action: 'item created',
    toStage: 'Initial Visit'
  });

  items.push(newItem);
  writeJSON(ITEMS_FILE, items);

  res.json(newItem);
});

app.post('/items/:id', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const index = items.findIndex(i => String(i.id) === String(req.params.id));

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }

  const existing = items[index];
  const updated = {
    ...existing,
    ...req.body,
    id: existing.id
  };

  items[index] = updated;
  writeJSON(ITEMS_FILE, items);

  res.json(updated);
});

// =========================
// REQUEST HANDOFF
// =========================
app.post('/items/:id/request-handoff', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));

  if (!item) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }

  const requestedStage = req.body.stage;
  const employee = req.body.employee || 'system';
  const reason = req.body.reason || null;

  if (!requestedStage) {
    return res.status(400).json({ success: false, message: 'Requested stage is required' });
  }

  item.pendingHandoff = {
    requestedStage,
    fromStage: item.stage,
    requestedBy: employee,
    requestedAt: new Date().toISOString(),
    reason
  };

  addLog(item, {
    employee,
    action: 'handoff requested',
    fromStage: item.stage,
    toStage: requestedStage,
    reason
  });

  addNotification(
    `${employee} sent ${item.code}-${item.number} to ${requestedStage}`,
    item.id,
    item.code
  );

  writeJSON(ITEMS_FILE, items);

  res.json({
    success: true,
    item
  });
});

// =========================
// ACCEPT HANDOFF
// =========================
app.post('/items/:id/accept-handoff', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));

  if (!item) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }

  if (!item.pendingHandoff) {
    return res.status(400).json({ success: false, message: 'No pending handoff' });
  }

  const employee = req.body.employee || 'system';
  const fromStage = item.stage;
  const nextStage = item.pendingHandoff.requestedStage;

  item.stage = nextStage;

  if (nextStage === 'Photograph' && !item.lotNumber) {
    const lot = nextLotNumber(items, new Date());
    item.lotNumber = lot;
    item.photographedAt = new Date().toISOString();
    item.lotAssignedAt = new Date().toISOString();
    item.lotAssignedBy = employee;

    addLog(item, {
      employee,
      action: 'lot assigned',
      note: `Assigned lot ${lot}`
    });
  }

  addLog(item, {
    employee,
    action: 'handoff accepted',
    fromStage,
    toStage: nextStage
  });

  addNotification(
    `${employee} accepted ${item.code}-${item.number} into ${nextStage}`,
    item.id,
    item.code
  );

  item.pendingHandoff = null;

  writeJSON(ITEMS_FILE, items);

  res.json({
    success: true,
    item
  });
});

// =========================
// DIRECT STAGE UPDATE
// =========================
app.post('/items/:id/stage', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));

  if (!item) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }

  const employee = req.body.employee || 'system';
  const newStage = req.body.stage;
  const reason = req.body.reason || null;
  const fromStage = item.stage;

  if (!newStage) {
    return res.status(400).json({ success: false, message: 'Stage is required' });
  }

  item.stage = newStage;

  if (newStage === 'Photograph' && !item.lotNumber) {
    const lot = nextLotNumber(items, new Date());
    item.lotNumber = lot;
    item.photographedAt = new Date().toISOString();
    item.lotAssignedAt = new Date().toISOString();
    item.lotAssignedBy = employee;

    addLog(item, {
      employee,
      action: 'lot assigned',
      note: `Assigned lot ${lot}`
    });
  }

  addLog(item, {
    employee,
    action: 'stage changed',
    fromStage,
    toStage: newStage,
    reason
  });

  writeJSON(ITEMS_FILE, items);

  res.json({
    success: true,
    item
  });
});

// =========================
// LOCATION
// =========================
app.post('/items/:id/location', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));

  if (!item) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }

  const employee = req.body.employee || 'system';
  const location = req.body.location || null;

  item.location = location;

  addLog(item, {
    employee,
    action: 'location updated',
    note: `Location set to ${location || 'none'}`
  });

  writeJSON(ITEMS_FILE, items);

  res.json({
    success: true,
    item
  });
});

// =========================
// NOTIFICATIONS
// =========================
app.get('/notifications', (req, res) => {
  const notifications = readJSON(NOTIFICATIONS_FILE);
  res.json(notifications);
});

app.post('/notifications/clear', (req, res) => {
  writeJSON(NOTIFICATIONS_FILE, []);
  res.json({ success: true });
});

// =========================
// PERFORMANCE
// =========================
app.get('/performance', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const stats = {};

  for (const item of items) {
    const logs = Array.isArray(item.logs) ? item.logs : [];

    for (const log of logs) {
      const employee = log.employee || 'system';

      if (!stats[employee]) {
        stats[employee] = {
          employee,
          created: 0,
          handoffRequested: 0,
          handoffAccepted: 0,
          stageChanges: 0,
          lotsAssigned: 0,
          locationUpdates: 0
        };
      }

      if (log.action === 'item created') stats[employee].created += 1;
      if (log.action === 'handoff requested') stats[employee].handoffRequested += 1;
      if (log.action === 'handoff accepted') stats[employee].handoffAccepted += 1;
      if (log.action === 'stage changed') stats[employee].stageChanges += 1;
      if (log.action === 'lot assigned') stats[employee].lotsAssigned += 1;
      if (log.action === 'location updated') stats[employee].locationUpdates += 1;
    }
  }

  res.json(Object.values(stats));
});

// =========================
// REPORTS
// =========================
app.post('/closeout', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const reports = readJSON(REPORTS_FILE);
  const today = new Date().toDateString();

  const todaysItems = items
    .filter(i => i.photographedAt && new Date(i.photographedAt).toDateString() === today)
    .sort((a, b) => new Date(a.photographedAt) - new Date(b.photographedAt));

  const report = {
    id: Date.now(),
    date: today,
    createdAt: new Date().toISOString(),
    items: todaysItems.map(i => ({
      id: i.id,
      lotNumber: i.lotNumber,
      name: i.name
    }))
  };

  reports.push(report);
  writeJSON(REPORTS_FILE, reports);

  res.json({
    success: true,
    report
  });
});

app.get('/reports', (req, res) => {
  const reports = readJSON(REPORTS_FILE);
  res.json(reports);
});

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});