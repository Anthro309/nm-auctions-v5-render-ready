const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ SAFE INIT (prevents crash if env missing)
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// FILES
const USERS_FILE = 'users.json';
const ITEMS_FILE = 'items.json';

// HELPERS
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function ensureUsersExist() {
  if (!fs.existsSync(USERS_FILE)) {
    writeJSON(USERS_FILE, [
      { name: 'Fabian', pin: '1234', isAdmin: true }
    ]);
  }
}

ensureUsersExist();

// UPLOAD DIR
const uploadsPath = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// MULTER FIXED
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({ storage });

// LOGIN
app.post('/login', (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.name === req.body.name && u.pin === req.body.pin);

  if (!user) return res.status(401).json({ success: false });

  res.json({ success: true, user });
});

// UPLOAD
app.post('/upload', upload.single('photo'), (req, res) => {
  res.json({
    success: true,
    path: `/uploads/${req.file.filename}`
  });
});

// AI ANALYZE (SAFE + STRONGER)
app.post('/analyze-image', async (req, res) => {
  try {
    if (!client) {
      return res.json({
        success: true,
        title: 'Item',
        description: 'No AI key set',
        category: 'misc',
        condition: 'unknown'
      });
    }

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Describe item in JSON: title, description, category, condition' },
            { type: 'input_image', image_url: req.body.imageUrl }
          ]
        }
      ]
    });

    let raw = response.output_text || '';
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        title: 'Item',
        description: raw,
        category: 'misc',
        condition: 'unknown'
      };
    }

    res.json({
      success: true,
      ...parsed
    });

  } catch (err) {
    console.error(err);
    res.json({
      success: true,
      title: 'Item',
      description: 'Fallback description',
      category: 'misc',
      condition: 'unknown'
    });
  }
});

// START
app.listen(PORT, () => console.log(`Server running on ${PORT}`));