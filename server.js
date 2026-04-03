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

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// =========================
// FILES
// =========================
const ITEMS_FILE = 'items.json';

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// =========================
// ENSURE UPLOAD FOLDER
// =========================
const uploadsPath = path.join(__dirname, 'public/uploads');

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// =========================
// MULTER
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({ storage });

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
// NEXT LOT
// =========================
app.get('/next-lot-code', (req, res) => {
  const items = readJSON(ITEMS_FILE);

  const month = 'ABCDEFGHIJKL'[new Date().getMonth()];

  const nums = items
    .map(i => i.lotNumber)
    .filter(Boolean)
    .filter(l => l.startsWith(month))
    .map(l => parseInt(l.slice(1)))
    .filter(n => !isNaN(n));

  const next = nums.length ? Math.max(...nums) + 1 : 1;

  res.json({
    success: true,
    lotCode: `${month}${String(next).padStart(3, '0')}`
  });
});

// =========================
// ADD ITEMS
// =========================
app.post('/addItems', (req, res) => {
  const items = readJSON(ITEMS_FILE);
  const incoming = req.body.items || [];

  const newItems = incoming.map(i => ({
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: i.title || '',
    description: i.description || '',
    category: i.category || '',
    condition: i.condition || '',
    consigner: `${i.consignerFirstName} ${i.consignerLastName}`,
    code: i.consignerCode,
    lotNumber: i.lotCode,
    photos: i.photo ? [i.photo] : []
  }));

  writeJSON(ITEMS_FILE, [...items, ...newItems]);

  res.json({ success: true });
});

// =========================
// GET ITEMS
// =========================
app.get('/items', (req, res) => {
  res.json(readJSON(ITEMS_FILE));
});

// =========================
// AI ANALYSIS (FIXED)
// =========================
app.post('/analyze-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ success: false });
    }

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                'Identify this item and respond ONLY JSON: {"title":"","description":"","category":"","condition":""}'
            },
            {
              type: 'input_image',
              image_url: imageUrl
            }
          ]
        }
      ]
    });

    const raw = response.output?.[0]?.content?.[0]?.text || '';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    if (!parsed) {
      return res.json({
        success: true,
        title: 'Estate item',
        description: raw,
        category: 'misc',
        condition: 'unknown'
      });
    }

    res.json({
      success: true,
      title: parsed.title || '',
      description: parsed.description || '',
      category: parsed.category || '',
      condition: parsed.condition || ''
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'AI image analysis failed'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});