const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 10000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

const USERS_FILE = 'users.json';
const ITEMS_FILE = 'items.json';
const REPORTS_FILE = 'reports.json';
const NOTIFICATIONS_FILE = 'notifications.json';
const INTAKE_FILE = 'intake.json';

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
    writeJSON(USERS_FILE, [
      { name: 'Fabian', pin: '1234', isAdmin: true },
      { name: 'James', pin: '1234', isAdmin: true },
      { name: 'Steven', pin: '1234', isAdmin: true },
      { name: 'Mike', pin: '1234', isAdmin: false },
      { name: 'Gio', pin: '1234', isAdmin: false },
      { name: 'Michelle', pin: '1234', isAdmin: false },
      { name: 'Sara', pin: '1234', isAdmin: false }
    ]);
  }
}

function monthLetterForDate(date = new Date()) {
  return 'ABCDEFGHIJKL'[date.getMonth()];
}

ensureArrayFile(ITEMS_FILE);
ensureArrayFile(REPORTS_FILE);
ensureArrayFile(NOTIFICATIONS_FILE);
ensureArrayFile(INTAKE_FILE);
ensureUsersExist();

const uploadDir = path.join(__dirname, 'public/uploads');

try {
  if (fs.existsSync(uploadDir)) {
    const stat = fs.statSync(uploadDir);
    if (!stat.isDirectory()) {
      fs.unlinkSync(uploadDir);
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('⚠️ uploads path fixed from file to folder');
    }
  } else {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 uploads folder created');
  }
} catch (err) {
  console.error('UPLOAD DIR ERROR:', err);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
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

app.post('/addItems', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const incoming = Array.isArray(req.body.items) ? req.body.items : [];

  if (!incoming.length) {
    return res.status(400).json({ success: false, message: 'No items provided' });
  }

  const existingLots = new Set(items.map(i => i.lotNumber).filter(Boolean));
  const newItems = [];

  for (const i of incoming) {
    if (!i.lotCode) {
      return res.status(400).json({ success: false, message: 'Missing lotCode' });
    }

    if (existingLots.has(i.lotCode)) {
      return res.status(400).json({
        success: false,
        message: `Duplicate lot code: ${i.lotCode}`
      });
    }

    const item = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      name: i.title || '',
      description: i.description || '',
      category: i.category || '',
      condition: i.condition || '',
      consigner: `${i.consignerFirstName || ''} ${i.consignerLastName || ''}`.trim(),
      code: i.consignerCode || '',
      lotNumber: i.lotCode,
      photos: i.photo ? [i.photo] : [],
      stage: 'Initial Visit',
      createdAt: i.createdAt || new Date().toISOString(),
      createdBy: i.createdBy || 'system'
    };

    newItems.push(item);
  }

  writeJSON(ITEMS_FILE, [...items, ...newItems]);

  res.json({ success: true, count: newItems.length });
});

app.get('/items', (req, res) => {
  res.json(readJSON(ITEMS_FILE));
});

app.get('/items/by-lot/:lot', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => i.lotNumber === req.params.lot);

  if (!item) {
    return res.json(null);
  }

  res.json(item);
});

app.post('/items/:id/stage', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const item = items.find(i => String(i.id) === String(req.params.id));

  if (!item) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }

  const stage = req.body.stage;
  if (!stage) {
    return res.status(400).json({ success: false, message: 'Missing stage' });
  }

  item.stage = stage;
  writeJSON(ITEMS_FILE, items);

  res.json({ success: true, item });
});

app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  res.json({
    success: true,
    path: `/uploads/${req.file.filename}`
  });
});

app.post('/analyze-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Missing imageUrl' });
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You identify estate sale and auction items from photos. Return compact JSON only with keys: title, description, category, condition. Keep title under 10 words. Keep description under 24 words. Category should be simple, like Furniture, Decor, Tool, Electronics, Art, Kitchen, Outdoor, Toy, Jewelry, Collectible, Appliance, Office. Condition should be one of: Excellent, Good, Fair, Poor, Unknown.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Identify the main item in this image and return auction-friendly JSON only.'
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    let parsed = {};

    try {
      parsed = JSON.parse(content);
    } catch (err) {
      parsed = {
        title: 'Unidentified Item',
        description: 'Item photographed for intake.',
        category: 'Unknown',
        condition: 'Unknown'
      };
    }

    res.json({
      success: true,
      title: parsed.title || 'Unidentified Item',
      description: parsed.description || 'Item photographed for intake.',
      category: parsed.category || 'Unknown',
      condition: parsed.condition || 'Unknown'
    });
  } catch (err) {
    console.error('AI ERROR:', err);
    res.status(500).json({
      success: false,
      message: 'AI analysis failed'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});