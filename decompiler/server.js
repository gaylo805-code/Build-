// ============================================================================
// Online Decompiler — Express Backend (VPS)
// Stack: Node.js + Express + multer + cors + node-cron
// Tools: jadx CLI (/opt/jadx/bin/jadx) for APK/DEX/JAR; optional strings/readelf
// Endpoints:
//   POST /api/decompile          -> upload file, run jadx, return { jobId, tree }
//   GET  /api/file-content       -> ?jobId=..&path=..  return { content }
//   GET  /api/health             -> liveness probe
//   GET  /api/jobs/:jobId/status -> poll decompile progress
// Storage: ./uploads (raw), ./jobs/<jobId>/output (jadx out). Auto-cleanup 30min.
// ============================================================================
'use strict';

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// ---- Config (override via env) ----
const PORT = process.env.PORT || 3001;
// Cloudflare Pages origin(s), comma-separated. '*' only for local dev.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const JOBS_DIR = path.join(__dirname, 'jobs');
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 100);
const JOB_TTL_MIN = Number(process.env.JOB_TTL_MIN || 30); // auto-cleanup threshold
const JADX_BIN = process.env.JADX_BIN || '/opt/jadx/bin/jadx';
const JADX_TIMEOUT_MS = Number(process.env.JADX_TIMEOUT_MS || 5 * 60 * 1000); // 5 min/job
// Ghidra headless decompiler for native binaries (ELF/.so/.bin). Heavy: minutes per file.
const GHIDRA_DIR = process.env.GHIDRA_DIR || '/opt/ghidra_12.1.4_PUBLIC';
const GHIDRA_SCRIPTS = path.join(__dirname, 'ghidra_scripts');
const GHIDRA_TIMEOUT_MS = Number(process.env.GHIDRA_TIMEOUT_MS || 8 * 60 * 1000); // 8 min/job
const GHIDRA_MAX_FUNCS_BYTES = 20 * 1024 * 1024; // cap decompiled output kept on disk

for (const d of [UPLOAD_DIR, JOBS_DIR]) fs.mkdirSync(d, { recursive: true });

// ---- Express app ----
const app = express();

// CORS: allow Cloudflare Pages frontend. Reflect configured origins.
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked for origin ' + origin));
  },
}));

// ---- Multer: disk storage, strict file filter + size limit ----
const ALLOWED_EXT = new Set(['.apk', '.dex', '.jar', '.so', '.class', '.zip', '.aar', '.apks', '.xapk', '.bin', '.odex', '.oat', '.o', '.elf']);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = crypto.randomBytes(8).toString('hex');
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${id}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_EXT.has(ext)) return cb(null, true);
    return cb(new Error('Unsupported file type ' + ext + '. Allowed: ' + [...ALLOWED_EXT].join(', ')));
  },
});

// ---- In-memory job registry (status polling) ----
// jobId -> { status: queued|running|done|error, fileName, createdAt, error?, fileCount? }
const jobs = new Map();

// ---- Helpers ----
const isSafeRelPath = (p) => {
  if (!p || typeof p !== 'string') return false;
  if (p.includes('\0') || path.isAbsolute(p)) return false;
  const norm = path.normalize(p);
  return !norm.startsWith('..') && !path.isAbsolute(norm);
};

// Build a JSON tree of decompiled output, capped to avoid huge payloads.
// Returns { name, type: 'dir', children: [...] }. Files: { name, path, size }.
const MAX_TREE_FILES = 5000;
const MAX_TREE_DEPTH = 12;
const TEXT_EXT = new Set(['.java', '.xml', '.json', '.txt', '.md', '.gradle', '.properties', '.smali', '.c', '.h', '.cpp', '.js', '.ts']);
async function buildTree(rootDir, relDir = '', depth = 0) {
  const abs = path.join(rootDir, relDir);
  const entries = await fsp.readdir(abs, { withFileTypes: true });
  const children = [];
  let count = 0;
  for (const e of entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))) {
    if (count >= MAX_TREE_FILES || depth > MAX_TREE_DEPTH) break;
    // Skip jadx noise / binaries to keep the tree navigable
    if (e.name === '.jadx' || e.name.endsWith('.class')) continue;
    const rel = relDir ? `${relDir}/${e.name}` : e.name;
    if (e.isDirectory()) {
      const sub = await buildTree(rootDir, rel, depth + 1);
      count += sub.count;
      // Prune empty dirs
      if (sub.node.children.length) children.push(sub.node);
    } else {
      count += 1;
      const st = await fsp.stat(path.join(rootDir, rel)).catch(() => null);
      children.push({ name: e.name, type: 'file', path: rel, size: st ? st.size : 0 });
    }
  }
  return { node: { name: relDir ? path.basename(relDir) : 'sources', type: 'dir', children }, count };
}

// Run jadx CLI on the uploaded file -> output dir. Throws on failure.
async function runJadx(inputFile, outDir) {
  await fsp.mkdir(outDir, { recursive: true });
  // --show-bad-code: keep going on parse errors; --no-res: skip resource decoding for speed
  const args = ['--show-bad-code', '-d', outDir, inputFile];
  await execFileAsync(JADX_BIN, args, { timeout: JADX_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
}

// Run Ghidra headless DecompileDump on a native binary.
// Writes <func>.c files + _index.txt into outDir. Best-effort: throws on failure,
// caller decides whether to fail the job or continue with static analysis only.
async function runGhidra(inputFile, outDir) {
  await fsp.mkdir(outDir, { recursive: true });
  const projDir = await fsp.mkdtemp(path.join(require('os').tmpdir(), 'ghidra-proj-'));
  const analyzeHeadless = path.join(GHIDRA_DIR, 'support', 'analyzeHeadless');
  const args = [
    projDir, 'auto_' + crypto.randomBytes(4).toString('hex'),
    '-import', inputFile,
    '-postScript', 'DecompileDump.java', outDir,
    '-deleteProject',
    '-scriptPath', GHIDRA_SCRIPTS,
    '-max-cpu', String(Math.max(1, require('os').cpus().length - 1)),
  ];
  try {
    await execFileAsync(analyzeHeadless, args, { timeout: GHIDRA_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 });
  } finally {
    await fsp.rm(projDir, { recursive: true, force: true }).catch(() => {});
  }
  // Safety cap: drop biggest .c files if output explodes (protects VPS disk).
  let total = 0;
  const files = await fsp.readdir(outDir).catch(() => []);
  const sized = [];
  for (const f of files) {
    if (!f.endsWith('.c')) continue;
    const st = await fsp.stat(path.join(outDir, f)).catch(() => null);
    if (st) { sized.push({ f, size: st.size }); total += st.size; }
  }
  if (total > GHIDRA_MAX_FUNCS_BYTES) {
    sized.sort((a, b) => b.size - a.size);
    for (const { f, size } of sized) {
      if (total <= GHIDRA_MAX_FUNCS_BYTES) break;
      await fsp.unlink(path.join(outDir, f)).catch(() => {});
      total -= size;
    }
  }
}
// Note: jadx only handles Java/Dalvik — a stripped C/C++ ELF has no Java sources,
// so for .so/.bin/.elf we return static analysis (imports/sections/disassembly) instead.
async function analyzeNative(libPath) {
  try {
    const { stdout: fileOut } = await execAsync(`file -b ${JSON.stringify(libPath)}`).catch(() => ({ stdout: '' }));
    const { stdout: stringsOut } = await execAsync(
      `strings -n 6 ${JSON.stringify(libPath)} | head -n 200`, { maxBuffer: 2 * 1024 * 1024 }).catch(() => ({ stdout: '' }));
    // Imported functions (dynamic symbols) — closest thing to a "function list" for stripped ELFs.
    const { stdout: importsOut } = await execAsync(
      `readelf --dyn-syms -W ${JSON.stringify(libPath)} 2>/dev/null | awk '$4==\"FUNC\" && $8!=\"\" {print $8}' | sort -u | head -n 300`,
      { maxBuffer: 2 * 1024 * 1024 }).catch(() => ({ stdout: '' }));
    // Section list (helps locate .text/.rodata/...).
    const { stdout: sectionsOut } = await execAsync(
      `readelf -S -W ${JSON.stringify(libPath)} 2>/dev/null | head -n 60`).catch(() => ({ stdout: '' }));
    // Disassembly of .text (Intel syntax), capped — real "code", just assembly not C source.
    const { stdout: disasmOut } = await execAsync(
      `objdump -d -M intel --no-show-raw-insn ${JSON.stringify(libPath)} 2>/dev/null | head -n 600`,
      { maxBuffer: 4 * 1024 * 1024 }).catch(() => ({ stdout: '' }));
    return {
      file: fileOut.trim(),
      strings: stringsOut.split('\n').filter(Boolean),
      imports: importsOut.split('\n').filter(Boolean),
      sections: sectionsOut.trim(),
      disasm: disasmOut.trim(),
    };
  } catch { return null; }
}

// ---- Routes ----
app.get('/api/health', async (req, res) => {
  // Verify jadx binary is reachable so Pages UI can show backend status.
  let jadx = 'missing';
  try { const { stdout } = await execFileAsync(JADX_BIN, ['--version'], { timeout: 10000 }); jadx = stdout.trim(); } catch {}
  res.json({ ok: true, jadx, maxFileMB: MAX_FILE_MB, ttlMin: JOB_TTL_MIN });
});

// POST /api/decompile — field name: "file"
app.post('/api/decompile', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field "file").' });
  const jobId = crypto.randomUUID();
  const jobDir = path.join(JOBS_DIR, jobId);
  const outDir = path.join(jobDir, 'output');
  const meta = { status: 'queued', fileName: req.file.originalname, createdAt: Date.now() };
  jobs.set(jobId, meta);
  await fsp.mkdir(jobDir, { recursive: true });

  try {
    meta.status = 'running';
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    let native = null;

    if (ext === '.so' || ext === '.bin' || ext === '.odex' || ext === '.oat' || ext === '.o' || ext === '.elf') {
      // Native/raw binary: no Java sources guaranteed — return strings/arch intel + best-effort jadx.
      native = await analyzeNative(req.file.path);
      try { await runJadx(req.file.path, outDir); } catch {}
      // Full decompile with Ghidra headless (slow: minutes). Failure is non-fatal:
      // static analysis above still returns. Result lands in output/ghidra/*.c.
      meta.status = 'running:ghidra';
      try {
        await runGhidra(req.file.path, path.join(outDir, 'ghidra'));
        meta.ghidra = true;
      } catch (err) {
        meta.ghidra = false;
        meta.ghidraError = String(err.message || err).slice(0, 200);
      }
      meta.status = 'running';
    } else {
      await runJadx(req.file.path, outDir);
    }

    const { node, count } = await buildTree(outDir);
    meta.status = 'done';
    meta.fileCount = count;
    res.json({ jobId, fileName: meta.fileName, tree: node, fileCount: count, native });
  } catch (err) {
    meta.status = 'error';
    meta.error = String(err.message || err).slice(0, 500);
    // jadx writes partial output; surface its log tail to help debugging.
    res.status(500).json({ error: 'Decompile failed: ' + meta.error, jobId });
  } finally {
    // Always drop the raw upload; keep only decompiled output until TTL cleanup.
    await fsp.unlink(req.file.path).catch(() => {});
  }
});

// GET /api/jobs/:jobId/status — lightweight polling endpoint
app.get('/api/jobs/:jobId/status', (req, res) => {
  const j = jobs.get(req.params.jobId);
  if (!j) return res.status(404).json({ error: 'Unknown jobId.' });
  res.json({ jobId: req.params.jobId, ...j });
});

// GET /api/file-content?jobId=..&path=..
app.get('/api/file-content', async (req, res) => {
  const { jobId, path: relPath } = req.query;
  if (!jobId || !relPath) return res.status(400).json({ error: 'Missing jobId or path.' });
  if (!isSafeRelPath(relPath)) return res.status(400).json({ error: 'Invalid path (traversal blocked).' });
  const abs = path.join(JOBS_DIR, String(jobId), 'output', path.normalize(String(relPath)));
  // Double-check containment after normalization (defense in depth).
  const root = path.join(JOBS_DIR, String(jobId), 'output');
  if (!abs.startsWith(root + path.sep) && abs !== root) return res.status(400).json({ error: 'Invalid path.' });
  let st;
  try { st = await fsp.stat(abs); } catch { return res.status(404).json({ error: 'File not found.' }); }
  if (!st.isFile()) return res.status(400).json({ error: 'Path is not a file.' });
  if (st.size > 2 * 1024 * 1024) return res.status(413).json({ error: 'File too large to preview (>2MB).' });
  const ext = path.extname(abs).toLowerCase();
  // Only serve text-ish files; binaries would corrupt the viewer.
  if (!TEXT_EXT.has(ext) && ext !== '') {
    // Allow unknown small text files if they look like text (no NUL bytes in head).
    const head = await fsp.readFile(abs).catch(() => null);
    if (!head || head.slice(0, 4096).includes(0)) return res.status(415).json({ error: 'Binary file — preview not supported.' });
    return res.json({ path: relPath, content: head.slice(0, 512 * 1024).toString('utf8') });
  }
  const content = await fsp.readFile(abs, 'utf8').catch(() => null);
  if (content === null) return res.status(500).json({ error: 'Cannot read file.' });
  res.json({ path: relPath, content: content.slice(0, 512 * 1024) });
});

// ---- Central error handler (multer + CORS + generic) ----
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `File too large (max ${MAX_FILE_MB}MB).` });
    return res.status(400).json({ error: 'Upload error: ' + err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

// ---- Auto-cleanup: every 10 min, delete jobs older than JOB_TTL_MIN ----
async function cleanupOldJobs() {
  const now = Date.now();
  let removed = 0;
  try {
    const ids = await fsp.readdir(JOBS_DIR);
    for (const id of ids) {
      const dir = path.join(JOBS_DIR, id);
      try {
        const st = await fsp.stat(dir);
        const ageMin = (now - st.mtimeMs) / 60000;
        const mem = jobs.get(id);
        const memAgeMin = mem ? (now - mem.createdAt) / 60000 : ageMin;
        if (Math.min(ageMin, memAgeMin) > JOB_TTL_MIN) {
          await fsp.rm(dir, { recursive: true, force: true });
          jobs.delete(id);
          removed++;
        }
      } catch {}
    }
    // Also sweep stale raw uploads (should normally be empty).
    const ups = await fsp.readdir(UPLOAD_DIR).catch(() => []);
    for (const f of ups) {
      const p = path.join(UPLOAD_DIR, f);
      try {
        const st = await fsp.stat(p);
        if ((now - st.mtimeMs) / 60000 > JOB_TTL_MIN) await fsp.unlink(p).catch(() => {});
      } catch {}
    }
  } catch {}
  if (removed) console.log(`[cleanup] removed ${removed} expired job(s)`);
}
cron.schedule('*/10 * * * *', cleanupOldJobs);

// ---- Landing page: serve the decompiler UI at / ----
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`[decompiler] API listening on :${PORT}`);
  console.log(`[decompiler] jadx=${JADX_BIN} origins=${ALLOWED_ORIGINS.join(',')}`);
});
