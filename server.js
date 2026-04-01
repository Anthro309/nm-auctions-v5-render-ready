const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static('public'));

// ===== STORAGE CONFIG (NEW) =====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'public/uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = Date.now() + ext;
    cb(null, name);
  }
});

const upload = multer({ storage });

// ===== FILE HELPERS =====
function readJSON(file){
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file));
  } catch (e) {
    console.log("READ ERROR:", e);
    return [];
  }
}

function writeJSON(file, data){
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ===== ITEMS =====
app.get('/items', (req,res)=>{
  res.json(readJSON('items.json'));
});

app.post('/items', (req,res)=>{
  const items = readJSON('items.json');

  const newItem = {
    ...req.body,
    id: Date.now()
  };

  items.push(newItem);
  writeJSON('items.json', items);

  res.json(newItem);
});

// ===== UPDATE STAGE =====
app.post('/items/:id/stage', (req,res)=>{
  const items = readJSON('items.json');

  const item = items.find(i => i.id == req.params.id);
  if(item){
    item.stage = req.body.stage;
  }

  writeJSON('items.json', items);
  res.json({ success:true });
});

// ===== UPLOAD (UPDATED) =====
app.post('/upload', upload.single('photo'), (req,res)=>{
  res.json({
    path: `/uploads/${req.file.filename}`
  });
});

// ===== START =====
app.listen(PORT, ()=>{
  console.log(`🔥 Server running on ${PORT}`);
});