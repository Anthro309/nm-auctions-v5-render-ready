const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 10000;

// =========================
// SAFE OPENAI INIT
// =========================
let client = null;
if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log('✅ OpenAI initialized');
} else {
  console.log('⚠️ OPENAI_API_KEY missing - AI disabled');
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// =========================
// FILE PATHS
// =========================
const USERS_FILE         = 'users.json';
const ITEMS_FILE         = 'items.json';
const REPORTS_FILE       = 'reports.json';
const NOTIFICATIONS_FILE = 'notifications.json';
const INTAKE_FILE        = 'intake.json';

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
  if (!fs.existsSync(file)) writeJSON(file, []);
}

function ensureUsersExist() {
  const users = readJSON(USERS_FILE);
  if (!users.length) {
    const defaultUsers = [
      { name: 'Fabian',   pin: '1234', isAdmin: true  },
      { name: 'James',    pin: '1234', isAdmin: true  },
      { name: 'Steven',   pin: '1234', isAdmin: true  },
      { name: 'Mike',     pin: '1234', isAdmin: false },
      { name: 'Gio',      pin: '1234', isAdmin: false },
      { name: 'Michelle', pin: '1234', isAdmin: false },
      { name: 'Sara',     pin: '1234', isAdmin: false }
    ];
    writeJSON(USERS_FILE, defaultUsers);
    console.log('🔥 Users seeded');
  }
}

function monthLetterForDate(date = new Date()) {
  return 'ABCDEFGHIJKL'[date.getMonth()];
}

function addLog(item, entry) {
  if (!Array.isArray(item.logs)) item.logs = [];
  item.logs.push({
    timestamp: new Date().toISOString(),
    employee:  entry.employee  || 'system',
    action:    entry.action    || '',
    fromStage: entry.fromStage || null,
    toStage:   entry.toStage   || null,
    reason:    entry.reason    || null,
    note:      entry.note      || null
  });
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

function cleanAIText(value, fallback = '') {
  return String(value || fallback).trim();
}

function safeJsonParse(text, fallback = null) {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

// =========================
// ENSURE FILES
// =========================
ensureArrayFile(ITEMS_FILE);
ensureArrayFile(REPORTS_FILE);
ensureArrayFile(NOTIFICATIONS_FILE);
ensureArrayFile(INTAKE_FILE);
ensureUsersExist();

// =========================
// ENSURE UPLOADS FOLDER
// =========================
const uploadsPath = path.join(__dirname, 'public/uploads');
try {
  if (fs.existsSync(uploadsPath)) {
    const stat = fs.statSync(uploadsPath);
    if (!stat.isDirectory()) {
      fs.unlinkSync(uploadsPath);
      fs.mkdirSync(uploadsPath, { recursive: true });
      console.log('⚠️ uploads was file → fixed to folder');
    }
  } else {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log('📁 uploads folder created');
  }
} catch (err) {
  console.error('UPLOAD DIR ERROR:', err);
}

// =========================
// MULTER
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

// =========================
// LOGIN
// =========================
app.post('/login', (req, res) => {
  const { name, pin } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(
    u => u.name.toLowerCase().trim() === String(name || '').toLowerCase().trim() &&
         u.pin === String(pin || '')
  );
  if (!user) return res.status(401).json({ success: false, message: 'Invalid login' });
  res.json({ success: true, user: { name: user.name, isAdmin: user.isAdmin } });
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
    .filter(l => typeof l === 'string' && l.startsWith(month))
    .map(l => parseInt(l.slice(1), 10))
    .filter(n => !isNaN(n));
  const next = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
  const lotCode = `${month}${String(next).padStart(3, '0')}`;
  res.json({ success: true, lotCode });
});

// =========================
// ADD ITEMS (INTAKE)
// =========================
app.post('/addItems', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const incoming = Array.isArray(req.body.items) ? req.body.items : [];
  if (!incoming.length) return res.status(400).json({ success: false, message: 'No items provided' });

  const existingCodes = new Set(items.map(i => i.lotNumber).filter(Boolean));
  const newItems = [];

  for (const i of incoming) {
    if (!i.lotCode) return res.status(400).json({ success: false, message: 'Missing lotCode' });
    if (existingCodes.has(i.lotCode)) {
      return res.status(400).json({ success: false, message: `Duplicate lot code: ${i.lotCode}` });
    }
    const item = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      name: i.title || '',
      description: i.description || '',
      category: i.category || '',
      condition: i.condition || '',
      consigner: `${i.consignerFirstName || ''} ${i.consignerLastName || ''}`.trim(),
      code: i.consignerCode || '',
      number: i.itemNumber || 1,
      part: i.partCount || 1,
      photos: i.photo ? [i.photo] : [],
      stage: 'Received at Studio',
      location: null,
      lotNumber: i.lotCode,
      photographedAt: null,
      lotAssignedAt: new Date().toISOString(),
      lotAssignedBy: i.createdBy || 'system',
      pendingHandoff: {
        requestedStage: 'Review & Cleaning',
        fromStage: 'Received at Studio',
        requestedBy: i.createdBy || 'system',
        requestedAt: new Date().toISOString(),
        reason: 'Initial Visit intake'
      },
      createdAt: i.createdAt || new Date().toISOString(),
      logs: []
    };
    addLog(item, { employee: i.createdBy || 'system', action: 'item received', toStage: 'Received at Studio' });
    addLog(item, { employee: i.createdBy || 'system', action: 'handoff requested', fromStage: 'Received at Studio', toStage: 'Review & Cleaning', reason: 'Initial Visit intake' });
    newItems.push(item);
  }

  writeJSON(ITEMS_FILE, [...items, ...newItems]);
  res.json({ success: true, count: newItems.length });
});

// =========================
// GET ALL ITEMS
// =========================
app.get('/items', (req, res) => {
  res.json(readJSON(ITEMS_FILE));
});

// =========================
// GET ITEM BY LOT (SCANNER)
// =========================
app.get('/items/by-lot/:lot', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => i.lotNumber === req.params.lot);
  if (!item) return res.json(null);
  res.json(item);
});

// =========================
// GET SINGLE ITEM BY ID
// =========================
app.get('/items/:id', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json(null);
  res.json(item);
});

// =========================
// UPDATE STAGE
// =========================
app.post('/items/:id/stage', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  const newStage = req.body.stage;
  const employee = req.body.employee || 'system';
  if (!validStage(newStage)) return res.status(400).json({ success: false, message: 'Invalid stage' });

  const fromStage = item.stage;
  item.stage = newStage;
  addLog(item, { employee, action: 'stage changed', fromStage, toStage: newStage });
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item });
});

// =========================
// SAVE LOCATION
// =========================
app.post('/items/:id/location', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  item.location = req.body.location || null;
  addLog(item, {
    employee: req.body.employee || 'system',
    action: 'location saved',
    note: item.location
  });
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item });
});

// =========================
// REQUEST HANDOFF
// =========================
app.post('/items/:id/request-handoff', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  const requestedStage = req.body.stage;
  const employee = req.body.employee || 'system';
  const reason = req.body.reason || '';

  if (!validStage(requestedStage)) {
    return res.status(400).json({ success: false, message: 'Invalid stage' });
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

  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item });
});

// =========================
// UPLOAD
// =========================
app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  res.json({ success: true, path: `/uploads/${req.file.filename}` });
});

// =========================
// AI IMAGE ANALYSIS
// =========================
app.post('/analyze-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ success: false, message: 'Missing imageUrl' });

    if (!client) {
      return res.json({ success: true, title: 'Item', description: 'AI not configured.', category: 'misc', condition: 'unknown' });
    }

    console.log('🤖 Analyzing image:', imageUrl);

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Look at this item photo from an estate-sale intake workflow. Return valid JSON only in this exact shape: {"title":"","description":"","category":"","condition":""}. Make title short and auction-friendly (max 60 chars). Make description one plain useful sentence. Category must be one of: furniture, decor, tools, art, electronics, glassware, kitchenware, books, jewelry, outdoor, collectibles, clothing, toys, misc. Condition must be one of: excellent, good, fair, worn, vintage wear, unknown. Return JSON only, no markdown.'
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl, detail: 'low' }
          }
        ]
      }]
    });

    const raw = response.choices[0].message.content || '';
    console.log('🤖 AI raw response:', raw);
    const parsed = safeJsonParse(raw, null);

    if (!parsed) {
      return res.json({ success: true, title: 'Item', description: cleanAIText(raw, 'No description available'), category: 'misc', condition: 'unknown' });
    }

    res.json({
      success: true,
      title:       cleanAIText(parsed.title,       'Item'),
      description: cleanAIText(parsed.description, 'No description available'),
      category:    cleanAIText(parsed.category,    'misc'),
      condition:   cleanAIText(parsed.condition,   'unknown')
    });

  } catch (err) {
    console.error('AI ERROR:', err.message);
    res.json({ success: true, title: 'Item', description: 'AI analysis failed — please fill in manually.', category: 'misc', condition: 'unknown' });
  }
});

// =========================
// REPORTS — DAILY SUMMARY
// =========================
app.get('/reports/daily-summary', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const today = new Date().toLocaleDateString('en-US');

  const photographedToday = [];
  const stagedToday = [];

  items.forEach(item => {
    if (!Array.isArray(item.logs)) return;
    item.logs.forEach(log => {
      const logDate = new Date(log.timestamp).toLocaleDateString('en-US');
      if (logDate !== today) return;
      const entry = {
        lotNumber: item.lotNumber || '—',
        name: item.name || 'Unnamed',
        consigner: item.consigner || '—',
        toStage: log.toStage,
        employee: log.employee,
        timestamp: log.timestamp
      };
      if (log.toStage === 'Photograph') photographedToday.push(entry);
      if (log.toStage) stagedToday.push(entry);
    });
  });

  res.json({
    date: today,
    photographedCount: photographedToday.length,
    photographedItems: photographedToday.sort((a, b) => a.lotNumber.localeCompare(b.lotNumber)),
    totalMoved: stagedToday.length
  });
});

// =========================
// REPORTS — GET ALL
// =========================
app.get('/reports', (req, res) => {
  res.json(readJSON(REPORTS_FILE));
});

// =========================
// REPORTS — GENERATE TODAY
// =========================
app.post('/closeout', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const reports = readJSON(REPORTS_FILE);
  const today = new Date().toLocaleDateString('en-US');

  const photographedToday = [];
  items.forEach(item => {
    if (!Array.isArray(item.logs)) return;
    item.logs.forEach(log => {
      const logDate = new Date(log.timestamp).toLocaleDateString('en-US');
      if (logDate === today && log.toStage === 'Photograph') {
        photographedToday.push({
          lotNumber: item.lotNumber || '—',
          name: item.name || 'Unnamed',
          consigner: item.consigner || '—'
        });
      }
    });
  });

  const report = {
    id: Date.now(),
    date: today,
    photographedCount: photographedToday.length,
    photographedItems: photographedToday.sort((a, b) => a.lotNumber.localeCompare(b.lotNumber)),
    items: items.map(i => ({
      lotNumber: i.lotNumber,
      name: i.name,
      consigner: i.consigner,
      stage: i.stage,
      category: i.category,
      condition: i.condition
    }))
  };
  reports.push(report);
  writeJSON(REPORTS_FILE, reports);
  res.json({ success: true, report });
});

// =========================
// INTAKE — GET ALL
// =========================
app.get('/intake', (req, res) => {
  res.json(readJSON(INTAKE_FILE));
});

// =========================
// ERROR HANDLER
// =========================
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({ success: false, message: err.message || 'Server error' });
});

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});