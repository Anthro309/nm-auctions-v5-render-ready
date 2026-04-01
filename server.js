const express = require('express');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'public/uploads/' });

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

// ===== UPLOAD =====
app.post('/upload', upload.single('photo'), (req,res)=>{
  res.json({
    path: `/uploads/${req.file.filename}`
  });
});

// ===== START =====
app.listen(PORT, ()=>{
  console.log(`🔥 Server running on ${PORT}`);
});