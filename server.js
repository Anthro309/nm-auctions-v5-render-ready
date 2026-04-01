const express = require('express');
const path = require('path');
const fs = require('fs');

const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();
const WORKFLOW = ['drop_off', 'back_of_house', 'review_cleaning', 'photograph', 'prepare_pickup', 'picked_up'];
const STAGE_LABELS = {
  drop_off: 'Drop Off',
  back_of_house: 'Back of House',
  review_cleaning: 'Review & Cleaning',
  photograph: 'Photograph',
  prepare_pickup: 'Prepare for Customer Pick Up',
  picked_up: 'Customer Picked Up'
};

const db = loadDb();
seedDefaults();

function nowIso() { return new Date().toISOString(); }
function todayLocal() { return new Date().toISOString().slice(0, 10); }
function monthLetter(dateString) { const d = dateString ? new Date(dateString) : new Date(); return 'ABCDEFGHIJKL'[d.getMonth()] || 'A'; }
function saveDb() { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
function loadDb() {
  if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  return { employees: [], consigners: [], dropoffs: [], items: [], itemLogs: [], notifications: [], reports: [] };
}
function findEmployeeByName(name) { return db.employees.find(e => e.firstName.toLowerCase() === String(name).trim().toLowerCase()); }
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  req.user = session;
  req.token = token;
  next();
}
function requireAdmin(req, res, next) { if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' }); next(); }
function seedDefaults() {
  if (db.employees.length) return;
  const people = [['James', true], ['Fabian', true], ['Steven', true], ['Mike', false], ['Gio', false], ['Hector', false], ['Michelle', false], ['Sara', false]];
  const pinHash = bcrypt.hashSync('1234', 10);
  db.employees = people.map(([firstName, isAdmin]) => ({ id: nanoid(10), firstName, pinHash, isAdmin, forcePinChange: true, createdAt: nowIso() }));
  saveDb();
}
function publicUser(employee) { return { id: employee.id, firstName: employee.firstName, isAdmin: employee.isAdmin, forcePinChange: employee.forcePinChange }; }
function createNotificationForAll(message, itemId = null) {
  for (const employee of db.employees) db.notifications.unshift({ id: nanoid(12), employeeId: employee.id, itemId, message, isRead: false, createdAt: nowIso() });
  saveDb();
}
function hydrateItem(item) {
  const consigner = db.consigners.find(c => c.id === item.consignerId) || {};
  return { ...item, consigner_first_name: consigner.firstName, consigner_last_name: consigner.lastName, shortcode: consigner.shortcode };
}

app.post('/api/login', (req, res) => {
  const { firstName, pin } = req.body || {};
  if (!firstName || !pin) return res.status(400).json({ error: 'First name and PIN are required.' });
  const employee = findEmployeeByName(firstName);
  if (!employee || !bcrypt.compareSync(String(pin), employee.pinHash)) return res.status(401).json({ error: 'Invalid login.' });
  const token = nanoid(24);
  sessions.set(token, publicUser(employee));
  res.json({ token, user: publicUser(employee) });
});

app.post('/api/change-pin', requireAuth, (req, res) => {
  const { newPin } = req.body || {};
  if (!/^\d{4}$/.test(String(newPin || ''))) return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
  const employee = db.employees.find(e => e.id === req.user.id);
  employee.pinHash = bcrypt.hashSync(String(newPin), 10);
  employee.forcePinChange = false;
  sessions.set(req.token, publicUser(employee));
  saveDb();
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const unreadNotifications = db.notifications.filter(n => n.employeeId === req.user.id && !n.isRead).length;
  res.json({ user: req.user, unreadNotifications });
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  const byStage = Object.fromEntries(WORKFLOW.map(s => [s, 0]));
  for (const item of db.items) byStage[item.currentStage] = (byStage[item.currentStage] || 0) + 1;
  const pendingApprovals = db.items.filter(i => i.awaitingAcceptance).length;
  const todayReport = db.reports.find(r => r.reportDate === todayLocal()) || null;
  res.json({ byStage, pendingApprovals, todayReport: todayReport ? { id: todayReport.id, report_date: todayReport.reportDate } : null });
});

app.get('/api/employees', requireAuth, (_req, res) => {
  res.json(db.employees.map(e => ({ id: e.id, firstName: e.firstName, isAdmin: e.isAdmin, forcePinChange: e.forcePinChange, createdAt: e.createdAt })).sort((a,b)=>a.firstName.localeCompare(b.firstName)));
});
app.post('/api/employees', requireAuth, requireAdmin, (req, res) => {
  const { firstName, isAdmin } = req.body || {};
  if (!firstName) return res.status(400).json({ error: 'First name is required.' });
  if (findEmployeeByName(firstName)) return res.status(400).json({ error: 'Employee already exists.' });
  const employee = { id: nanoid(10), firstName: String(firstName).trim(), pinHash: bcrypt.hashSync('1234', 10), isAdmin: !!isAdmin, forcePinChange: true, createdAt: nowIso() };
  db.employees.push(employee); saveDb(); res.json({ ok: true, id: employee.id });
});
app.patch('/api/employees/:id', requireAuth, requireAdmin, (req, res) => {
  const employee = db.employees.find(e => e.id === req.params.id); if (!employee) return res.status(404).json({ error: 'Employee not found.' }); employee.isAdmin = !!req.body?.isAdmin; saveDb(); res.json({ ok: true });
});

app.post('/api/consigners', requireAuth, (req, res) => {
  const { firstName, lastName } = req.body || {};
  if (!firstName || !lastName) return res.status(400).json({ error: 'Consigner first and last name are required.' });
  const shortcode = `${String(firstName).replace(/[^a-z]/gi,'').toUpperCase().slice(0,3)}${String(lastName).replace(/[^a-z]/gi,'').toUpperCase().slice(0,3)}`.padEnd(6,'X');
  const consigner = { id: nanoid(10), firstName: String(firstName).trim(), lastName: String(lastName).trim(), shortcode, createdAt: nowIso() };
  db.consigners.unshift(consigner); saveDb(); res.json(consigner);
});
app.get('/api/consigners', requireAuth, (_req, res) => {
  res.json(db.consigners.map(c => ({ ...c, item_count: db.items.filter(i => i.consignerId === c.id).length })));
});

app.post('/api/dropoffs', requireAuth, (req, res) => {
  const { consignerId } = req.body || {};
  if (!consignerId) return res.status(400).json({ error: 'Consigner is required.' });
  const dropoff = { id: nanoid(10), consignerId, sequenceCounter: 0, createdBy: req.user.id, createdAt: nowIso(), closedAt: null };
  db.dropoffs.unshift(dropoff); saveDb(); res.json({ id: dropoff.id });
});
app.get('/api/dropoffs', requireAuth, (_req, res) => {
  const rows = db.dropoffs.map(d => {
    const c = db.consigners.find(x => x.id === d.consignerId) || {};
    return { ...d, first_name: c.firstName, last_name: c.lastName, shortcode: c.shortcode, item_count: db.items.filter(i => i.dropoffId === d.id).length };
  });
  res.json(rows);
});

app.post('/api/items', requireAuth, (req, res) => {
  const { dropoffId, name, description = '', dimensions = '', conditionText = '', notes = '', multipartTotal = 1 } = req.body || {};
  if (!dropoffId || !name) return res.status(400).json({ error: 'Drop off and item name are required.' });
  const dropoff = db.dropoffs.find(d => d.id === dropoffId); if (!dropoff) return res.status(404).json({ error: 'Drop off not found.' });
  const consigner = db.consigners.find(c => c.id === dropoff.consignerId); if (!consigner) return res.status(404).json({ error: 'Consigner not found.' });
  const intakeOrder = (dropoff.sequenceCounter || 0) + 1; dropoff.sequenceCounter = intakeOrder;
  const item = {
    id: nanoid(12), dropoffId, consignerId: consigner.id, qr_code: `${consigner.shortcode}-${dropoffId}-${intakeOrder}`,
    consigner_item_code: `${consigner.shortcode}-${intakeOrder}`, intake_order: intakeOrder, lot_number: '', lot_sequence: null,
    name: String(name).trim(), description, dimensions, condition_text: conditionText, notes, multipart_total: Number(multipartTotal || 1),
    currentStage: 'drop_off', pendingFromStage: '', pendingToStage: '', pendingReason: '', pendingByEmployeeId: '', awaitingAcceptance: false,
    photographedAt: '', preparedAt: '', pickedUpAt: '', createdBy: req.user.id, createdAt: nowIso(), updatedAt: nowIso()
  };
  db.items.push(item); db.itemLogs.unshift({ id: nanoid(12), itemId: item.id, fromStage: '', toStage: 'drop_off', movedByEmployeeId: req.user.id, acceptedByEmployeeId: '', reason: '', isSkip: false, createdAt: nowIso() }); saveDb();
  res.json({ ok: true, id: item.id, consignerItemCode: item.consigner_item_code, qrCode: item.qr_code });
});

app.get('/api/items', requireAuth, (req, res) => {
  const { stage, search, reportDate, consignerId, qr } = req.query;
  let rows = db.items.slice();
  if (stage) rows = rows.filter(i => i.currentStage === stage);
  if (consignerId) rows = rows.filter(i => i.consignerId === consignerId);
  if (reportDate) rows = rows.filter(i => String(i.photographedAt || '').slice(0,10) === reportDate);
  if (qr) rows = rows.filter(i => [i.qr_code, i.consigner_item_code, i.id].includes(qr));
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter(i => {
      const c = db.consigners.find(x => x.id === i.consignerId) || {};
      return [i.name, i.consigner_item_code, c.firstName, c.lastName, i.lot_number].some(v => String(v || '').toLowerCase().includes(q));
    });
  }
  rows.sort((a,b)=>(a.intake_order - b.intake_order) || a.createdAt.localeCompare(b.createdAt));
  res.json(rows.map(hydrateItem).map(i => ({ ...i, current_stage: i.currentStage, awaiting_acceptance: i.awaitingAcceptance })));
});

app.get('/api/items/:id', requireAuth, (req, res) => {
  const item = db.items.find(i => i.id === req.params.id); if (!item) return res.status(404).json({ error: 'Item not found.' });
  const hydrated = hydrateItem(item);
  const relatedItems = db.items.filter(i => i.consignerId === item.consignerId).sort((a,b)=>a.intake_order-b.intake_order).map(i => ({ id: i.id, name: i.name, consigner_item_code: i.consigner_item_code, current_stage: i.currentStage, lot_number: i.lot_number }));
  const logs = db.itemLogs.filter(l => l.itemId === item.id).map(l => ({ ...l, moved_by_name: db.employees.find(e => e.id === l.movedByEmployeeId)?.firstName || '', accepted_by_name: db.employees.find(e => e.id === l.acceptedByEmployeeId)?.firstName || '' }));
  res.json({ item: { ...hydrated, current_stage: hydrated.currentStage }, relatedItems, logs });
});

app.patch('/api/items/:id', requireAuth, (req, res) => {
  const item = db.items.find(i => i.id === req.params.id); if (!item) return res.status(404).json({ error: 'Item not found.' });
  Object.assign(item, {
    name: req.body?.name ?? item.name,
    description: req.body?.description ?? item.description,
    dimensions: req.body?.dimensions ?? item.dimensions,
    condition_text: req.body?.conditionText ?? item.condition_text,
    notes: req.body?.notes ?? item.notes,
    multipart_total: req.body?.multipartTotal ?? item.multipart_total,
    updatedAt: nowIso()
  });
  saveDb(); res.json({ ok: true });
});

app.delete('/api/items/:id', requireAuth, (req, res) => {
  const idx = db.items.findIndex(i => i.id === req.params.id); if (idx === -1) return res.status(404).json({ error: 'Item not found.' });
  const item = db.items[idx]; if (item.currentStage !== 'drop_off' && !req.user.isAdmin) return res.status(403).json({ error: 'Only admins can delete after intake moves past Drop Off.' });
  db.items.splice(idx,1); db.itemLogs = db.itemLogs.filter(l => l.itemId !== item.id); db.notifications = db.notifications.filter(n => n.itemId !== item.id); saveDb(); res.json({ ok: true });
});

app.post('/api/items/:id/move', requireAuth, (req, res) => {
  const { toStage, reason = '' } = req.body || {};
  const item = db.items.find(i => i.id === req.params.id); if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (!toStage || !WORKFLOW.includes(toStage)) return res.status(400).json({ error: 'Valid destination stage is required.' });
  if (item.awaitingAcceptance) return res.status(400).json({ error: 'This item is already waiting for acceptance.' });
  const currentIndex = WORKFLOW.indexOf(item.currentStage); const nextIndex = WORKFLOW.indexOf(toStage);
  if (nextIndex <= currentIndex) return res.status(400).json({ error: 'Items can only move forward.' });
  const isSkip = nextIndex - currentIndex > 1;
  if (isSkip && !String(reason).trim()) return res.status(400).json({ error: 'A reason is required when skipping a step.' });
  Object.assign(item, { pendingFromStage: item.currentStage, pendingToStage: toStage, pendingReason: String(reason).trim(), pendingByEmployeeId: req.user.id, awaitingAcceptance: true, updatedAt: nowIso() });
  saveDb(); createNotificationForAll(`${req.user.firstName} sent ${item.consigner_item_code} to ${STAGE_LABELS[toStage]} for approval.`, item.id); res.json({ ok: true });
});

app.post('/api/items/:id/accept', requireAuth, (req, res) => {
  const item = db.items.find(i => i.id === req.params.id); if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (!item.awaitingAcceptance || !item.pendingToStage) return res.status(400).json({ error: 'This item is not waiting for acceptance.' });
  const toStage = item.pendingToStage;
  if (toStage === 'photograph' && !item.lot_number) {
    const countThisMonth = db.items.filter(i => i.lot_sequence && i.lot_number?.startsWith(monthLetter())).length;
    item.lot_sequence = countThisMonth + 1;
    item.lot_number = `${monthLetter()}${String(item.lot_sequence).padStart(3,'0')}`;
    item.photographedAt = item.photographedAt || nowIso();
  } else if (toStage === 'photograph' && !item.photographedAt) item.photographedAt = nowIso();
  if (toStage === 'prepare_pickup') item.preparedAt = nowIso();
  if (toStage === 'picked_up') item.pickedUpAt = nowIso();
  db.itemLogs.unshift({ id: nanoid(12), itemId: item.id, fromStage: item.pendingFromStage, toStage, movedByEmployeeId: item.pendingByEmployeeId || req.user.id, acceptedByEmployeeId: req.user.id, reason: item.pendingReason, isSkip: !!item.pendingReason, createdAt: nowIso() });
  Object.assign(item, { currentStage: toStage, pendingFromStage: '', pendingToStage: '', pendingReason: '', pendingByEmployeeId: '', awaitingAcceptance: false, updatedAt: nowIso() });
  saveDb(); createNotificationForAll(`${req.user.firstName} accepted ${item.consigner_item_code} into ${STAGE_LABELS[toStage]}.`, item.id); res.json({ ok: true, lotNumber: item.lot_number || '' });
});

app.post('/api/items/:id/reject', requireAuth, (req, res) => {
  const item = db.items.find(i => i.id === req.params.id); if (!item) return res.status(404).json({ error: 'Item not found.' }); if (!item.awaitingAcceptance) return res.status(400).json({ error: 'This item is not waiting for acceptance.' });
  Object.assign(item, { pendingFromStage: '', pendingToStage: '', pendingReason: '', pendingByEmployeeId: '', awaitingAcceptance: false, updatedAt: nowIso() }); saveDb(); createNotificationForAll(`${req.user.firstName} rejected the handoff for ${item.consigner_item_code}.`, item.id); res.json({ ok: true });
});

app.get('/api/pending', requireAuth, (_req, res) => {
  res.json(db.items.filter(i => i.awaitingAcceptance).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(hydrateItem).map(i => ({ ...i, pending_from_stage: i.pendingFromStage, pending_to_stage: i.pendingToStage, pending_reason: i.pendingReason })));
});

app.get('/api/notifications', requireAuth, (req, res) => {
  res.json(db.notifications.filter(n => n.employeeId === req.user.id).slice(0,50).map(n => ({ ...n, is_read: n.isRead })));
});
app.post('/api/notifications/read-all', requireAuth, (req, res) => { db.notifications.forEach(n => { if (n.employeeId === req.user.id) n.isRead = true; }); saveDb(); res.json({ ok: true }); });

app.get('/api/reports', requireAuth, (_req, res) => {
  res.json(db.reports.slice().sort((a,b)=>b.reportDate.localeCompare(a.reportDate)).map(r => ({ ...r, report_date: r.reportDate, closed_by_name: db.employees.find(e => e.id === r.closedByEmployeeId)?.firstName || '', payload: r.payload })));
});
app.post('/api/reports/daily-closeout', requireAuth, (req, res) => {
  const reportDate = req.body?.reportDate || todayLocal();
  const photographed = db.items.filter(i => String(i.photographedAt || '').slice(0,10) === reportDate).sort((a,b)=>(a.photographedAt || '').localeCompare(b.photographedAt || '') || a.intake_order - b.intake_order);
  const payload = {
    title: 'NM Auctions Daily Lot Report', reportDate, itemCount: photographed.length,
    items: photographed.map(i => { const c = db.consigners.find(x => x.id === i.consignerId) || {}; return { lotNumber: i.lot_number, item: i.name, dimensions: i.dimensions, condition: i.condition_text, notes: i.notes, photographedAt: i.photographedAt, consigner: `${c.firstName || ''} ${c.lastName || ''}`.trim() }; })
  };
  let report = db.reports.find(r => r.reportDate === reportDate);
  if (report) { report.closedByEmployeeId = req.user.id; report.createdAt = nowIso(); report.payload = payload; }
  else { report = { id: nanoid(10), reportDate, closedByEmployeeId: req.user.id, createdAt: nowIso(), payload }; db.reports.push(report); }
  saveDb(); createNotificationForAll(`${req.user.firstName} ran daily close out for ${reportDate}.`); res.json({ ok: true, payload });
});
app.get('/api/reports/:date', requireAuth, (req, res) => {
  const report = db.reports.find(r => r.reportDate === req.params.date); if (!report) return res.status(404).json({ error: 'Report not found.' }); res.json({ ...report, report_date: report.reportDate, closed_by_name: db.employees.find(e => e.id === report.closedByEmployeeId)?.firstName || '', payload: report.payload });
});

app.get('/api/health', (_req, res) => res.json({ status: 'OK', dataPath: DB_PATH }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`NM Auctions V5 running on port ${PORT}`));
