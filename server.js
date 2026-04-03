const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ SAFE AI INIT (no crash)
let client = null;
if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
} else {
  console.log('⚠️ No OpenAI key set — AI disabled');
}

app.use(express.json({ limit: '10mb' }));
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
// HELPERS (UNCHANGED)
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
    return JSON.parse(text);
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
// FIX UPLOAD FOLDER
// =========================
const uploadsPath = path.join(__dirname, 'public/uploads');

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// =========================
// MULTER (FIXED)
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({ storage });

// =========================
// LOGIN (UNCHANGED)
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
// NEXT LOT (FIXED)
// =========================
app.get('/next-lot-code', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const month = req.query.month || monthLetterForDate(new Date());

  const usedNumbers = items
    .map(i => i.lotNumber)
    .filter(Boolean)
    .filter(l => l.startsWith(month))
    .map(l => parseInt(l.slice(1), 10))
    .filter(n => !isNaN(n));

  const next = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
  const lotCode = `${month}${String(next).padStart(3, '0')}`;

  res.json({ success: true, lotCode });
});

// =========================
// UPLOAD (FIXED)
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
// AI (FIXED MODEL + SAFE)
// =========================
app.post('/analyze-image', async (req, res) => {
  try {
    if (!client) {
      return res.json({
        success: false,
        message: 'AI not configured'
      });
    }

    const { imageUrl } = req.body;

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Return JSON: title, description, category, condition' },
            { type: 'input_image', image_url: imageUrl }
          ]
        }
      ]
    });

    const raw = response.output_text || '';
    const parsed = safeJsonParse(raw, null);

    res.json({
      success: true,
      title: cleanAIText(parsed?.title, 'Estate item'),
      description: cleanAIText(parsed?.description, raw),
      category: cleanAIText(parsed?.category, 'misc'),
      condition: cleanAIText(parsed?.condition, 'unknown')
    });

  } catch (err) {
    console.error('AI ERROR:', err);
    res.json({ success: false, message: 'AI image analysis failed' });
  }
});

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});