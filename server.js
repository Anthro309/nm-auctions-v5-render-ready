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
const WOTD_FILE          = 'wotd.json';
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
      { name: 'Fabian',    pin: '1234', isAdmin: true,  photo: null },
      { name: 'James',     pin: '1234', isAdmin: true,  photo: null },
      { name: 'Steven',    pin: '1234', isAdmin: true,  photo: null },
      { name: 'Mike',      pin: '1234', isAdmin: false, photo: null },
      { name: 'Gio',       pin: '1234', isAdmin: false, photo: null },
      { name: 'Michelle',  pin: '1234', isAdmin: false, photo: null },
      { name: 'Sara',      pin: '1234', isAdmin: false, photo: null },
      { name: 'Alejandro', pin: '1234', isAdmin: false, photo: null },
      { name: 'Christian', pin: '1234', isAdmin: false, photo: null },
      { name: 'Hector',    pin: '1234', isAdmin: false, photo: null }
    ];
    writeJSON(USERS_FILE, defaultUsers);
    console.log('🔥 Users seeded');
  }
}

function requireAdmin(reqBody) {
  const users = readJSON(USERS_FILE);
  const u = users.find(u => u.name === reqBody.requestedBy);
  return u && u.isAdmin;
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
    'Home Visit',
    'Received at Studio',
    'Missing at Drop Off',
    'Review & Cleaning',
    'Photograph',
    'Prep for Pick Up',
    'Ready for Pick Up',
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
  res.json({ success: true, user: { name: user.name, isAdmin: !!user.isAdmin, photo: user.photo || null } });
});

// =========================
// EMPLOYEES — LIST
// =========================
app.get('/employees', (req, res) => {
  const users = readJSON(USERS_FILE);
  res.json(users.map(u => ({ name: u.name, isAdmin: !!u.isAdmin, photo: u.photo || null })));
});

// =========================
// EMPLOYEES — ADD
// =========================
app.post('/employees', (req, res) => {
  if (!requireAdmin(req.body)) return res.status(403).json({ success: false, message: 'Admin only' });
  const { name, pin, isAdmin } = req.body;
  if (!name || !pin) return res.status(400).json({ success: false, message: 'Name and PIN required' });
  const users = readJSON(USERS_FILE);
  if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Employee already exists' });
  }
  users.push({ name: name.trim(), pin: String(pin), isAdmin: !!isAdmin, photo: null });
  writeJSON(USERS_FILE, users);
  res.json({ success: true });
});

// =========================
// EMPLOYEES — REMOVE
// =========================
app.delete('/employees/:name', (req, res) => {
  if (!requireAdmin(req.body)) return res.status(403).json({ success: false, message: 'Admin only' });
  let users = readJSON(USERS_FILE);
  const target = users.find(u => u.name === req.params.name);
  if (!target) return res.status(404).json({ success: false, message: 'Not found' });
  if (target.isAdmin) return res.status(400).json({ success: false, message: 'Cannot remove an admin' });
  users = users.filter(u => u.name !== req.params.name);
  writeJSON(USERS_FILE, users);
  res.json({ success: true });
});

// =========================
// EMPLOYEES — CHANGE PIN
// =========================
app.post('/employees/:name/pin', (req, res) => {
  // Allow if requester is admin OR changing their own PIN
  const isSelf = req.body.requestedBy === req.params.name;
  if (!isSelf && !requireAdmin(req.body)) return res.status(403).json({ success: false, message: 'Admin only' });
  const { newPin } = req.body;
  if (!newPin || String(newPin).length < 4) return res.status(400).json({ success: false, message: 'PIN must be at least 4 digits' });
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.name === req.params.name);
  if (!user) return res.status(404).json({ success: false, message: 'Not found' });
  user.pin = String(newPin);
  writeJSON(USERS_FILE, users);
  res.json({ success: true });
});

// =========================
// EMPLOYEES — UPLOAD PHOTO (self or admin)
// =========================
app.post('/employees/:name/photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  // Anyone can upload their own photo; only admin can upload for others
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.name === req.params.name);
  if (!user) return res.status(404).json({ success: false, message: 'Not found' });
  user.photo = `/uploads/${req.file.filename}`;
  writeJSON(USERS_FILE, users);
  res.json({ success: true, photo: user.photo });
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
      stage: 'Home Visit',
      location: null,
      lotNumber: i.lotCode,
      tags: Array.isArray(i.tags) ? i.tags : [],
      estimatedValueLow:  i.estimatedValueLow  || 0,
      estimatedValueHigh: i.estimatedValueHigh || 0,
      photographedAt: null,
      lotAssignedAt: new Date().toISOString(),
      lotAssignedBy: i.createdBy || 'system',
      createdAt: i.createdAt || new Date().toISOString(),
      logs: []
    };
    addLog(item, { employee: i.createdBy || 'system', action: 'item created', toStage: 'Home Visit' });
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
// SEARCH ITEMS BY NAME/LOT/CONSIGNER
// =========================
app.get('/items/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);
  const items = readJSON(ITEMS_FILE);
  const results = items.filter(i =>
    (i.name || '').toLowerCase().includes(q) ||
    (i.lotNumber || '').toLowerCase().includes(q) ||
    (i.consigner || '').toLowerCase().includes(q)
  ).slice(0, 8);
  res.json(results);
});

// =========================
// BATCH STAGE ADVANCE
// =========================
app.post('/items/batch-stage', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const { ids, stage, employee } = req.body;
  if (!validStage(stage)) return res.status(400).json({ success: false, message: 'Invalid stage' });
  let count = 0;
  ids.forEach(id => {
    const item = items.find(i => String(i.id) === String(id));
    if (item) {
      const fromStage = item.stage;
      item.stage = stage;
      addLog(item, { employee: employee || 'system', action: 'stage changed', fromStage, toStage: stage });
      count++;
    }
  });
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, count });
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
// EDIT ITEM
// =========================
app.put('/items/:id', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
  const { name, description, category, condition, employee } = req.body;
  if (name !== undefined) item.name = name;
  if (description !== undefined) item.description = description;
  if (category !== undefined) item.category = category;
  if (condition !== undefined) item.condition = condition;
  addLog(item, { employee: employee || 'system', action: 'item edited' });
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item });
});

// =========================
// DELETE ITEM
// =========================
app.delete('/items/:id', (req, res) => {
  let items = readJSON(ITEMS_FILE);
  const idx = items.findIndex(i => String(i.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: 'Item not found' });
  items.splice(idx, 1);
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true });
});

// =========================
// ADD NOTE
// =========================
app.post('/items/:id/note', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
  const { note, employee } = req.body;
  if (!note) return res.status(400).json({ success: false, message: 'Note required' });
  if (!Array.isArray(item.notes)) item.notes = [];
  item.notes.push({ text: note, employee: employee || 'system', at: new Date().toISOString() });
  addLog(item, { employee: employee || 'system', action: 'note added', note });
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item });
});

// =========================
// RECORD SALE
// =========================
app.post('/items/:id/sell', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
  const { soldPrice, commission, employee } = req.body;
  if (!soldPrice || isNaN(soldPrice)) return res.status(400).json({ success: false, message: 'Valid sold price required' });
  item.soldPrice  = parseFloat(parseFloat(soldPrice).toFixed(2));
  item.commission = parseFloat(commission) || 30;
  item.payout     = parseFloat((item.soldPrice * (1 - item.commission / 100)).toFixed(2));
  item.soldAt     = new Date().toISOString();
  addLog(item, { employee: employee || 'system', action: 'item sold', note: `$${item.soldPrice} · ${item.commission}% commission · $${item.payout} payout` });
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item });
});

// =========================
// ANALYTICS OVERVIEW
// =========================
app.get('/analytics/overview', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const stageCounts = { 'Home Visit': 0, 'Received at Studio': 0, 'Review & Cleaning': 0, 'Photograph': 0, 'Prep for Pick Up': 0, 'Ready for Pick Up': 0, 'Picked Up': 0, 'Missing at Drop Off': 0 };
  const categoryCounts = {};
  items.forEach(i => {
    if (stageCounts.hasOwnProperty(i.stage)) stageCounts[i.stage]++;
    const cat = (i.category || 'uncategorized').toLowerCase().trim();
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const soldItems = items.filter(i => i.soldPrice);
  res.json({
    totalItems: items.length,
    stageCounts,
    categoryCounts,
    totalRevenue: soldItems.reduce((s, i) => s + (i.soldPrice || 0), 0).toFixed(2),
    totalPayout:  soldItems.reduce((s, i) => s + (i.payout   || 0), 0).toFixed(2),
    totalSold:    soldItems.length
  });
});

// =========================
// CONSIGNER PORTAL
// =========================
app.get('/consigner-portal/:code', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const code  = req.params.code.toUpperCase();
  const list  = items.filter(i => i.code === code);
  if (!list.length) return res.status(404).json({ success: false, message: 'No items found for this code' });
  res.json({
    success: true,
    consigner: list[0].consigner,
    code,
    items: list.map(i => ({
      id: i.id, name: i.name, lotNumber: i.lotNumber,
      stage: i.stage, category: i.category, condition: i.condition,
      photos: i.photos, soldPrice: i.soldPrice || null, payout: i.payout || null,
      createdAt: i.createdAt
    }))
  });
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
// RECORD SCAN (employee touch log, no stage change)
// =========================
app.post('/items/:id/scan', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  const employee = req.body.employee || 'system';
  item.lastHandledBy = employee;
  item.lastHandledAt = new Date().toISOString();
  addLog(item, { employee, action: 'scanned', note: `Handled at ${item.stage}` });
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item });
});

// =========================
// REPAIR FLAG
// =========================
app.post('/items/:id/repair-flag', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  const { flagged, note, employee } = req.body;
  item.needsRepair = !!flagged;
  item.repairNote  = flagged ? (note || '') : '';
  addLog(item, {
    employee: employee || 'system',
    action: flagged ? 'flagged for repair' : 'repair flag cleared',
    note: item.repairNote || null
  });
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
// =========================
// WORD OF THE DAY
// =========================
function readWOTD() {
  try { if (fs.existsSync(WOTD_FILE)) return JSON.parse(fs.readFileSync(WOTD_FILE, 'utf8')); } catch (_) {}
  return { date: null, word: null, used: [] };
}
function writeWOTD(data) {
  try { fs.writeFileSync(WOTD_FILE, JSON.stringify(data, null, 2)); } catch (_) {}
}

app.get('/word-of-day', async (req, res) => {
  const today = new Date().toLocaleDateString('en-US');
  const cache = readWOTD();

  // Serve cached word if it's still today's
  if (cache.date === today && cache.word) {
    return res.json({ success: true, ...cache.word });
  }

  if (!client) {
    return res.json({ success: false, message: 'AI not configured' });
  }

  const usedWords = Array.isArray(cache.used) ? cache.used : [];
  const avoidList = usedWords.slice(-60).join(', ');

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 320,
      messages: [{
        role: 'user',
        content: `You are the Word of the Day generator for an estate auction studio operations team. Create ONE original made-up word (a portmanteau or pun) that is:
- Related to: auction house work, item handling, photography, consigners, QR scanning, staging, picking, cleaning, lot numbers, bidding, or studio operations
- Tone: silly, comical, mildly cheeky/PG-13 workplace humor — think irreverent but not offensive
- Style examples to match: Bidgasm, Furni-turd, Lot-nesia, Scan-demonium, Crapitalism, Turdtique, Stagefright, Assetsment, Priappraisal

Do NOT reuse any of these already used words: ${avoidList || 'none yet'}

Return ONLY valid JSON with no markdown fences:
{"word":"","pronunciation":"","definition":"","example":""}`
      }]
    });

    const raw = (response.choices[0].message.content || '').trim().replace(/^```json?|```$/g, '').trim();
    const parsed = safeJsonParse(raw, null);
    if (!parsed || !parsed.word) throw new Error('Invalid AI response');

    const wordData = {
      word:  parsed.word,
      pronun: parsed.pronunciation || '',
      def:   parsed.definition || '',
      ex:    parsed.example || ''
    };

    writeWOTD({ date: today, word: wordData, used: [...usedWords, parsed.word] });
    return res.json({ success: true, ...wordData });

  } catch (err) {
    console.error('WOTD generation error:', err.message);
    // Serve yesterday's word as fallback rather than nothing
    if (cache.word) return res.json({ success: true, ...cache.word, stale: true });
    return res.json({ success: false, message: err.message });
  }
});

// PHOTO STUDIO — BG REMOVAL + ITEM LINK
// =========================

// Process a photo: remove background via remove.bg if API key set, else return original
app.post('/photos/process-bg', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const originalPath = `/uploads/${req.file.filename}`;

  if (!process.env.REMOVE_BG_API_KEY) {
    return res.json({ success: true, path: originalPath, processed: false, message: 'No REMOVE_BG_API_KEY set — original saved' });
  }

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const blob = new Blob([fileBuffer], { type: req.file.mimetype });
    const form = new FormData();
    form.append('image_file', blob, req.file.filename);
    form.append('size', 'auto');
    form.append('format', 'png');
    form.append('bg_color', 'ffffff');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.REMOVE_BG_API_KEY },
      body: form
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`remove.bg ${response.status}: ${errText}`);
    }

    const processedBuffer = Buffer.from(await response.arrayBuffer());
    const processedFilename = `clean_${Date.now()}_${Math.floor(Math.random()*10000)}.png`;
    const processedFilePath = path.join(uploadsPath, processedFilename);
    fs.writeFileSync(processedFilePath, processedBuffer);

    // Remove original temp file
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    return res.json({ success: true, path: `/uploads/${processedFilename}`, processed: true });
  } catch (err) {
    console.error('BG removal error:', err.message);
    return res.json({ success: true, path: originalPath, processed: false, error: err.message });
  }
});

// Add a processed photo to an item's photo array
app.post('/items/:id/add-photo', (req, res) => {
  const { photoPath } = req.body;
  if (!photoPath) return res.status(400).json({ success: false, message: 'No photoPath provided' });

  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  if (!Array.isArray(item.photos)) item.photos = [];
  if (!item.photos.includes(photoPath)) item.photos.unshift(photoPath);

  addLog(item, { employee: req.body.employee || 'system', action: 'photo added', note: photoPath });
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item });
});

// =========================
// VOICE TO ITEM
// =========================
app.post('/voice-to-item', async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) return res.status(400).json({ success: false });
  if (!client) return res.json({ success: false, message: 'AI not configured' });
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Extract auction item details from this spoken description. Return valid JSON only: {"title":"","description":"","category":"","condition":""}. Category must be one of: furniture, decor, tools, art, electronics, glassware, kitchenware, books, jewelry, outdoor, collectibles, clothing, toys, misc. Condition: excellent, good, fair, worn, vintage wear, unknown. Spoken text: "${transcript}"`
      }]
    });
    const parsed = safeJsonParse(response.choices[0].message.content || '', null);
    if (!parsed) return res.json({ success: false });
    res.json({ success: true, title: cleanAIText(parsed.title, ''), description: cleanAIText(parsed.description, ''), category: cleanAIText(parsed.category, ''), condition: cleanAIText(parsed.condition, '') });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
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
            text: 'Look at this item photo from an estate-sale intake workflow. Return valid JSON only in this exact shape: {"title":"","description":"","category":"","condition":"","tags":[],"estimatedValueLow":0,"estimatedValueHigh":0}. Make title short and auction-friendly (max 60 chars). Make description one plain useful sentence. Category must be one of: furniture, decor, tools, art, electronics, glassware, kitchenware, books, jewelry, outdoor, collectibles, clothing, toys, misc. Condition must be one of: excellent, good, fair, worn, vintage wear, unknown. tags: array of 4-8 short searchable keyword strings describing the item. estimatedValueLow and estimatedValueHigh: realistic USD auction value range as integers (e.g. 25 and 75). Return JSON only, no markdown.'
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
      title:               cleanAIText(parsed.title,       'Item'),
      description:         cleanAIText(parsed.description, 'No description available'),
      category:            cleanAIText(parsed.category,    'misc'),
      condition:           cleanAIText(parsed.condition,   'unknown'),
      tags:                Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
      estimatedValueLow:   parseInt(parsed.estimatedValueLow)  || 0,
      estimatedValueHigh:  parseInt(parsed.estimatedValueHigh) || 0
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
// GENERATE AUCTION DESCRIPTION
// =========================
app.post('/items/:id/auction-description', async (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  if (!client) {
    return res.json({ success: false, message: 'AI not configured.' });
  }

  const { dimensions, condition, additionalNotes, employee } = req.body;

  if (dimensions)      item.dimensions = dimensions;
  if (condition)       item.condition  = condition;
  if (additionalNotes) item.additionalNotes = additionalNotes;

  const prompt = `You are writing a professional estate auction lot description for an online auction house.

Item details:
- Name: ${item.name || 'Unknown'}
- Category: ${item.category || 'Unknown'}
- Condition: ${condition || item.condition || 'Unknown'}
- Dimensions: ${dimensions || item.dimensions || 'Not provided'}
- Base description: ${item.description || 'None'}
- Additional notes: ${additionalNotes || 'None'}

Write a compelling, professional auction listing description. Include:
1. A brief evocative opening sentence about the piece
2. Material, style, and craftsmanship details
3. Dimensions (if provided)
4. Honest condition notes
5. A closing sentence about its appeal or use

Keep it between 80-150 words. Plain prose only — no bullet points, no markdown. Write in third person. Make it sound like a high-end estate auction house.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });

    const description = (response.choices[0].message.content || '').trim();
    item.auctionDescription = description;
    addLog(item, { employee: employee || 'system', action: 'auction description generated' });
    writeJSON(ITEMS_FILE, items);

    res.json({ success: true, description });
  } catch (err) {
    console.error('AI DESC ERROR:', err.message);
    res.json({ success: false, message: 'AI description failed: ' + err.message });
  }
});

// =========================
// DESCRIPTION FEEDBACK
// =========================
app.post('/items/:id/description-feedback', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false });
  item.descriptionFeedback = req.body.feedback;
  addLog(item, { employee: req.body.employee || 'system', action: 'description feedback: ' + req.body.feedback });
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true });
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
// EVENTS — AUCTION SALES
// =========================
const EVENTS_FILE = 'events.json';
ensureArrayFile(EVENTS_FILE);

app.get('/events', (req, res) => {
  res.json(readJSON(EVENTS_FILE));
});

app.post('/events', (req, res) => {
  const { name, date, description, category, commissionRate, createdBy } = req.body;
  if (!name || !date) return res.status(400).json({ success: false, message: 'name and date required' });
  const events = readJSON(EVENTS_FILE);
  const ev = {
    id: Date.now() + Math.floor(Math.random() * 10000),
    name, date,
    description: description || '',
    category: category || 'general',
    commissionRate: parseFloat(commissionRate) || 35,
    status: 'upcoming',
    lots: [],
    createdAt: new Date().toISOString(),
    createdBy: createdBy || 'system'
  };
  events.push(ev);
  writeJSON(EVENTS_FILE, events);
  res.json({ success: true, event: ev });
});

app.get('/events/:id', (req, res) => {
  const ev = readJSON(EVENTS_FILE).find(e => String(e.id) === String(req.params.id));
  if (!ev) return res.status(404).json({ success: false, message: 'Event not found' });
  const items = readJSON(ITEMS_FILE);
  const lots = ev.lots.map(lid => items.find(i => String(i.id) === String(lid))).filter(Boolean);
  res.json({ ...ev, lotItems: lots });
});

app.patch('/events/:id', (req, res) => {
  const events = readJSON(EVENTS_FILE);
  const ev = events.find(e => String(e.id) === String(req.params.id));
  if (!ev) return res.status(404).json({ success: false, message: 'Event not found' });
  const allowed = ['name','date','description','category','commissionRate','status'];
  allowed.forEach(k => { if (req.body[k] !== undefined) ev[k] = req.body[k]; });
  writeJSON(EVENTS_FILE, events);
  res.json({ success: true, event: ev });
});

app.delete('/events/:id', (req, res) => {
  let events = readJSON(EVENTS_FILE);
  events = events.filter(e => String(e.id) !== String(req.params.id));
  writeJSON(EVENTS_FILE, events);
  res.json({ success: true });
});

app.post('/events/:id/assign', (req, res) => {
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ success: false, message: 'itemId required' });
  const events = readJSON(EVENTS_FILE);
  const ev = events.find(e => String(e.id) === String(req.params.id));
  if (!ev) return res.status(404).json({ success: false, message: 'Event not found' });
  if (!ev.lots.map(String).includes(String(itemId))) ev.lots.push(String(itemId));
  // also save eventId on item
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(itemId));
  if (item) { item.eventId = String(ev.id); item.eventName = ev.name; writeJSON(ITEMS_FILE, items); }
  writeJSON(EVENTS_FILE, events);
  res.json({ success: true, event: ev });
});

app.delete('/events/:id/lots/:itemId', (req, res) => {
  const events = readJSON(EVENTS_FILE);
  const ev = events.find(e => String(e.id) === String(req.params.id));
  if (!ev) return res.status(404).json({ success: false, message: 'Event not found' });
  ev.lots = ev.lots.filter(l => String(l) !== String(req.params.itemId));
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.itemId));
  if (item) { item.eventId = null; item.eventName = null; writeJSON(ITEMS_FILE, items); }
  writeJSON(EVENTS_FILE, events);
  res.json({ success: true });
});

// Import auction results — CSV body: [{lotNumber, soldPrice}]
app.post('/events/:id/import-results', (req, res) => {
  const { results, employee } = req.body; // results: [{lotNumber, soldPrice}]
  if (!Array.isArray(results)) return res.status(400).json({ success: false, message: 'results array required' });
  const events = readJSON(EVENTS_FILE);
  const ev = events.find(e => String(e.id) === String(req.params.id));
  if (!ev) return res.status(404).json({ success: false, message: 'Event not found' });
  const items = readJSON(ITEMS_FILE);
  let matched = 0, unmatched = [];
  for (const r of results) {
    const sold = parseFloat(r.soldPrice) || 0;
    const item = items.find(i => (i.lotNumber || '').toLowerCase().trim() === (r.lotNumber || '').toLowerCase().trim());
    if (item) {
      item.soldPrice = sold;
      item.soldAt = new Date().toISOString();
      item.soldBy = employee || 'system';
      const rate = (ev.commissionRate || 35) / 100;
      item.payoutAmount = parseFloat((sold * (1 - rate)).toFixed(2));
      item.payoutStatus = 'pending';
      item.stage = 'Picked Up';
      addLog(item, { employee: employee || 'system', action: 'sold', note: `$${sold} — payout $${item.payoutAmount}`, toStage: 'Picked Up' });
      matched++;
    } else {
      unmatched.push(r.lotNumber);
    }
  }
  ev.status = 'completed';
  ev.completedAt = new Date().toISOString();
  writeJSON(ITEMS_FILE, items);
  writeJSON(EVENTS_FILE, events);
  res.json({ success: true, matched, unmatched });
});

// =========================
// AI — CONDITION AUTO-ASSESSMENT
// =========================
app.post('/items/:id/condition-assess', async (req, res) => {
  if (!client) return res.json({ success: false, message: 'AI not configured' });
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false });

  const photo = item.photos?.[0];
  if (!photo) return res.json({ success: false, message: 'No photo on item' });

  const photoUrl = `${req.protocol}://${req.get('host')}${photo}`;
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: photoUrl } },
          { type: 'text', text: `You are an estate auction condition inspector. Examine this item photo and write a detailed condition report. Be specific about: visible damage (chips, cracks, scratches, stains, fading, missing parts), overall wear level, and anything affecting value. Keep it factual, 3-5 sentences. Start with overall condition grade: Excellent / Good / Fair / Worn / Poor. Format: {"grade":"Good","report":"Full condition report here."}. Return ONLY valid JSON.` }
        ]
      }]
    });
    const raw = (response.choices[0].message.content || '').trim().replace(/^```json?|```$/g, '').trim();
    const parsed = safeJsonParse(raw, null);
    if (!parsed) throw new Error('Bad AI response');
    item.conditionGrade = parsed.grade;
    item.conditionReport = parsed.report;
    if (!item.condition || item.condition === 'unknown') item.condition = parsed.grade.toLowerCase();
    addLog(item, { employee: req.body.employee || 'system', action: 'condition assessed', note: parsed.grade });
    writeJSON(ITEMS_FILE, items);
    res.json({ success: true, grade: parsed.grade, report: parsed.report });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// =========================
// AI — DESCRIPTION VARIANTS (short/medium/long)
// =========================
app.post('/items/:id/description-variants', async (req, res) => {
  if (!client) return res.json({ success: false, message: 'AI not configured' });
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Write three versions of an estate auction listing description for this item.
Item: ${item.name || 'Unknown'}
Category: ${item.category || 'misc'}
Condition: ${item.conditionGrade || item.condition || 'unknown'}
Condition Notes: ${item.conditionReport || item.repairNote || 'none'}
Tags: ${(item.tags || []).join(', ') || 'none'}
Estimated Value: $${item.estimatedValueLow || 0}–$${item.estimatedValueHigh || 0}
Existing Description: ${item.description || 'none'}

Return ONLY valid JSON:
{"short":"1-2 sentence social media caption (under 50 words)","medium":"Listing headline paragraph (80-100 words, auction-ready)","long":"Full catalog description (180-220 words, detailed provenance, condition, appeal)"}`
      }]
    });
    const raw = (response.choices[0].message.content || '').trim().replace(/^```json?|```$/g, '').trim();
    const parsed = safeJsonParse(raw, null);
    if (!parsed) throw new Error('Bad AI response');
    item.descriptionVariants = parsed;
    writeJSON(ITEMS_FILE, items);
    res.json({ success: true, ...parsed });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// =========================
// AI — SMART REPAIR ESTIMATE
// =========================
app.post('/items/:id/repair-estimate', async (req, res) => {
  if (!client) return res.json({ success: false, message: 'AI not configured' });
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false });

  const repairNote = item.repairNote || req.body.repairNote || 'general repair needed';
  const estimatedValue = item.estimatedValueHigh || item.estimatedValueLow || 0;
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are an estate auction repair advisor. Analyze this repair situation and give a practical recommendation.

Item: ${item.name || 'Unknown'}
Category: ${item.category || 'misc'}
Repair needed: ${repairNote}
Estimated item value: $${estimatedValue}

Return ONLY valid JSON:
{"estimateLow":0,"estimateHigh":0,"recommendation":"repair"|"sell-as-is"|"discard","reasoning":"2-3 sentence explanation","repairType":"type of repair shop or service needed"}`
      }]
    });
    const raw = (response.choices[0].message.content || '').trim().replace(/^```json?|```$/g, '').trim();
    const parsed = safeJsonParse(raw, null);
    if (!parsed) throw new Error('Bad AI response');
    item.repairEstimate = parsed;
    writeJSON(ITEMS_FILE, items);
    res.json({ success: true, ...parsed });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// =========================
// AI — MARKET COMPARABLE PRICING
// =========================
app.post('/items/:id/comparable-pricing', async (req, res) => {
  if (!client) return res.json({ success: false, message: 'AI not configured' });
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are an estate auction market analyst. Based on your knowledge of auction results and resale markets, provide comparable pricing for this item.

Item: ${item.name || 'Unknown'}
Category: ${item.category || 'misc'}
Condition: ${item.conditionGrade || item.condition || 'unknown'}
Description: ${item.description || 'none'}
Tags: ${(item.tags || []).join(', ') || 'none'}

Provide realistic auction market data based on comparable sold items. Return ONLY valid JSON:
{"marketLow":0,"marketHigh":0,"typicalStartingBid":0,"reserveRecommendation":0,"comparables":[{"description":"brief comparable item description","soldFor":0,"source":"auction platform name"}],"marketNotes":"2-3 sentences on current market for this type of item"}`
      }]
    });
    const raw = (response.choices[0].message.content || '').trim().replace(/^```json?|```$/g, '').trim();
    const parsed = safeJsonParse(raw, null);
    if (!parsed) throw new Error('Bad AI response');
    item.marketPricing = parsed;
    writeJSON(ITEMS_FILE, items);
    res.json({ success: true, ...parsed });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// =========================
// AI — NATURAL LANGUAGE SEARCH
// =========================
app.post('/items/search-nl', async (req, res) => {
  if (!client) return res.json({ success: false, message: 'AI not configured' });
  const { query } = req.body;
  if (!query) return res.status(400).json({ success: false });

  const stages = ['Home Visit','Received at Studio','Review & Cleaning','Photograph','Prep for Pick Up','Ready for Pick Up','Picked Up','Missing at Drop Off'];
  const categories = ['furniture','decor','tools','art','electronics','glassware','kitchenware','books','jewelry','outdoor','collectibles','clothing','toys','misc'];

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Convert this search query into filter criteria for an estate auction item database.
Query: "${query}"
Valid stages: ${stages.join(', ')}
Valid categories: ${categories.join(', ')}

Return ONLY valid JSON (null means no filter):
{"nameContains":null,"stage":null,"category":null,"condition":null,"minValue":null,"maxValue":null,"needsRepair":null,"hasPhoto":null,"hasDescription":null}`
      }]
    });
    const raw = (response.choices[0].message.content || '').trim().replace(/^```json?|```$/g, '').trim();
    const filters = safeJsonParse(raw, {});
    const items = readJSON(ITEMS_FILE);
    const results = items.filter(i => {
      if (filters.stage && i.stage !== filters.stage) return false;
      if (filters.category && (i.category || '').toLowerCase() !== filters.category.toLowerCase()) return false;
      if (filters.nameContains && !(i.name || '').toLowerCase().includes(filters.nameContains.toLowerCase())) return false;
      if (filters.condition && (i.condition || '').toLowerCase() !== filters.condition.toLowerCase()) return false;
      if (filters.minValue !== null && filters.minValue !== undefined && (i.estimatedValueHigh || 0) < filters.minValue) return false;
      if (filters.maxValue !== null && filters.maxValue !== undefined && (i.estimatedValueLow || 0) > filters.maxValue) return false;
      if (filters.needsRepair === true && !i.needsRepair) return false;
      if (filters.needsRepair === false && i.needsRepair) return false;
      if (filters.hasPhoto === true && (!i.photos || !i.photos.length)) return false;
      if (filters.hasDescription === true && !i.auctionDescription && !i.description) return false;
      return true;
    });
    res.json({ success: true, results, filters, count: results.length });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// =========================
// AI — AUTO AUCTION ASSIGNMENT
// =========================
app.post('/items/:id/auto-assign-event', async (req, res) => {
  if (!client) return res.json({ success: false, message: 'AI not configured' });
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false });

  const events = readJSON(EVENTS_FILE).filter(e => e.status === 'upcoming');
  if (!events.length) return res.json({ success: false, message: 'No upcoming events' });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are an estate auction curator. Match this item to the best upcoming event.

Item: ${item.name} | Category: ${item.category || 'misc'} | Value: $${item.estimatedValueLow || 0}–$${item.estimatedValueHigh || 0} | Tags: ${(item.tags || []).join(', ')}

Upcoming events:
${events.map(e => `ID:${e.id} | ${e.name} | ${e.date} | Focus: ${e.category}`).join('\n')}

Return ONLY valid JSON: {"eventId":"<id from list>","reason":"one sentence explanation"}`
      }]
    });
    const raw = (response.choices[0].message.content || '').trim().replace(/^```json?|```$/g, '').trim();
    const parsed = safeJsonParse(raw, null);
    if (!parsed || !parsed.eventId) throw new Error('Bad AI response');

    const ev = events.find(e => String(e.id) === String(parsed.eventId));
    if (!ev) return res.json({ success: false, message: 'AI chose invalid event' });

    if (!ev.lots.map(String).includes(String(item.id))) ev.lots.push(String(item.id));
    item.eventId = String(ev.id);
    item.eventName = ev.name;
    addLog(item, { employee: req.body.employee || 'system', action: 'auto-assigned to event', note: ev.name });
    writeJSON(ITEMS_FILE, items);
    const allEvents = readJSON(EVENTS_FILE);
    const evIndex = allEvents.findIndex(e => String(e.id) === String(ev.id));
    if (evIndex !== -1) allEvents[evIndex] = ev;
    writeJSON(EVENTS_FILE, allEvents);
    res.json({ success: true, event: ev, reason: parsed.reason });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// =========================
// AI — PREDICTIVE SALE PRICE
// =========================
app.post('/items/:id/predict-price', async (req, res) => {
  if (!client) return res.json({ success: false, message: 'AI not configured' });
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) return res.status(404).json({ success: false });

  // Get historical sold data from same category
  const historicalSold = items.filter(i =>
    i.soldPrice && i.soldPrice > 0 &&
    i.category === item.category &&
    String(i.id) !== String(item.id)
  ).slice(-20).map(i => ({
    name: i.name, condition: i.condition, soldPrice: i.soldPrice,
    estimatedHigh: i.estimatedValueHigh, tags: i.tags
  }));

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `You are an estate auction price analyst. Predict the closing sale price for this item.

Item: ${item.name}
Category: ${item.category || 'misc'}
Condition: ${item.conditionGrade || item.condition || 'unknown'}
Your estimated value: $${item.estimatedValueLow || 0}–$${item.estimatedValueHigh || 0}
Tags: ${(item.tags || []).join(', ') || 'none'}
Market comps from AI: ${item.marketPricing ? `$${item.marketPricing.marketLow}–$${item.marketPricing.marketHigh}` : 'not run'}

Historical sold data from same category in this studio (last 20 items):
${historicalSold.length ? historicalSold.map(h => `${h.name} [${h.condition}] → $${h.soldPrice}`).join('\n') : 'No history yet'}

Return ONLY valid JSON: {"predictedLow":0,"predictedHigh":0,"confidence":"low"|"medium"|"high","suggestedStartingBid":0,"reasoning":"2 sentence explanation"}`
      }]
    });
    const raw = (response.choices[0].message.content || '').trim().replace(/^```json?|```$/g, '').trim();
    const parsed = safeJsonParse(raw, null);
    if (!parsed) throw new Error('Bad AI response');
    item.pricePrediction = parsed;
    writeJSON(ITEMS_FILE, items);
    res.json({ success: true, ...parsed });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// =========================
// AI — FULL INTAKE AUTOMATION
// =========================
app.post('/auto-intake', upload.single('photo'), async (req, res) => {
  if (!client) return res.json({ success: false, message: 'AI not configured' });
  if (!req.file) return res.status(400).json({ success: false, message: 'Photo required' });

  const voiceTranscript = req.body.voiceTranscript || '';
  const consignerCode   = req.body.consignerCode || '';
  const consignerName   = req.body.consignerName || '';
  const employee        = req.body.employee || 'system';

  const photoPath = `/uploads/${req.file.filename}`;
  const photoUrl  = `${req.protocol}://${req.get('host')}${photoPath}`;

  try {
    // Single AI call: photo + voice → complete item data
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: photoUrl } },
          { type: 'text', text: `You are an estate auction intake specialist. Analyze this item photo${voiceTranscript ? ` and this spoken description: "${voiceTranscript}"` : ''} and extract complete intake data.

Category options: furniture, decor, tools, art, electronics, glassware, kitchenware, books, jewelry, outdoor, collectibles, clothing, toys, misc
Condition options: excellent, good, fair, worn, vintage wear, unknown

Return ONLY valid JSON:
{"title":"","description":"2-3 sentences","category":"","condition":"","conditionReport":"specific damage notes from photo","tags":[],"estimatedValueLow":0,"estimatedValueHigh":0,"dimensions":"if visible"}` }
        ]
      }]
    });

    const raw = (response.choices[0].message.content || '').trim().replace(/^```json?|```$/g, '').trim();
    const parsed = safeJsonParse(raw, null);
    if (!parsed || !parsed.title) throw new Error('AI extraction failed');

    res.json({
      success: true,
      photoPath,
      title:             cleanAIText(parsed.title, ''),
      description:       cleanAIText(parsed.description, ''),
      category:          cleanAIText(parsed.category, 'misc'),
      condition:         cleanAIText(parsed.condition, 'unknown'),
      conditionReport:   cleanAIText(parsed.conditionReport, ''),
      tags:              Array.isArray(parsed.tags) ? parsed.tags : [],
      estimatedValueLow: parsed.estimatedValueLow  || 0,
      estimatedValueHigh:parsed.estimatedValueHigh || 0,
      dimensions:        parsed.dimensions || ''
    });
  } catch (err) {
    console.error('Auto-intake error:', err.message);
    res.json({ success: false, message: err.message, photoPath });
  }
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