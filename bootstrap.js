const fs = require('fs');
const path = require('path');

const repoRoot = __dirname;
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function fileDefault(name) {
  if (name === 'wotd.json') return JSON.stringify({ date: null, word: null, used: [] }, null, 2);
  if (name === 'lot-counter.json') return JSON.stringify({}, null, 2);
  return JSON.stringify([], null, 2);
}

function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, defaultContent);
}

function replaceWithSymlink(targetPath, sourcePath, type) {
  try {
    if (fs.existsSync(targetPath) || fs.lstatSync(targetPath)) {
      const stat = fs.lstatSync(targetPath);
      if (stat.isSymbolicLink()) {
        const current = fs.readlinkSync(targetPath);
        if (path.resolve(path.dirname(targetPath), current) === path.resolve(sourcePath)) return;
        fs.unlinkSync(targetPath);
      } else if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
    }
  } catch (_) {}

  fs.symlinkSync(
    sourcePath,
    targetPath,
    process.platform === 'win32' ? (type === 'dir' ? 'junction' : 'file') : type
  );
}

function copyFileIfNeeded(src, dst, defaultContent) {
  if (fs.existsSync(dst)) return;
  try {
    if (fs.existsSync(src) && !fs.lstatSync(src).isSymbolicLink()) {
      fs.copyFileSync(src, dst);
      return;
    }
  } catch (_) {}
  fs.writeFileSync(dst, defaultContent);
}

function enablePersistentData() {
  if (!dataDir) return;

  ensureDir(dataDir);
  ensureDir(path.join(dataDir, 'uploads'));

  const jsonFiles = [
    'users.json',
    'items.json',
    'reports.json',
    'wotd.json',
    'notifications.json',
    'intake.json',
    'lot-counter.json',
    'events.json'
  ];

  jsonFiles.forEach((name) => {
    const repoFile = path.join(repoRoot, name);
    const dataFile = path.join(dataDir, name);
    copyFileIfNeeded(repoFile, dataFile, fileDefault(name));
    replaceWithSymlink(repoFile, dataFile, 'file');
  });

  const publicDir = path.join(repoRoot, 'public');
  ensureDir(publicDir);
  const uploadsLink = path.join(publicDir, 'uploads');
  replaceWithSymlink(uploadsLink, path.join(dataDir, 'uploads'), 'dir');

  console.log(`📦 Persistent data enabled at ${dataDir}`);
}

enablePersistentData();
require('./server.js');
