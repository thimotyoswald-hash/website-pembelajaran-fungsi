'use strict';

/*
 * Website Pembelajaran Fungsi - Server
 * ------------------------------------
 * Tanpa dependency eksternal: memakai modul bawaan Node.js
 *   - node:http   : server statis + REST API
 *   - node:sqlite : database file-based (data/asas.db)
 *
 * Jalankan:  node server.js   (atau: npm start)
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const { DatabaseSync } = require('node:sqlite');

/* ===================== KONFIGURASI ===================== */

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'asas.db');
const INDEX_FILE = 'index.html';

/* ===================== DATABASE ===================== */

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nis        TEXT    UNIQUE,
    nama       TEXT    NOT NULL,
    kelas      TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS progress (
    student_id INTEGER NOT NULL,
    section    TEXT    NOT NULL,
    data       TEXT    NOT NULL DEFAULT '{}',
    updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (student_id, section),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    section    TEXT    NOT NULL,
    score      INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    details    TEXT    NOT NULL DEFAULT '[]',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_attempts_section ON attempts(section);
`);

/* ===================== HELPER ===================== */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

/* Berkas sumber backend yang tidak boleh diakses lewat HTTP. */
const DENY = ['server.js', 'package.json', 'package-lock.json'];

function sendJSON(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendError(res, code, message) {
  sendJSON(res, code, { ok: false, error: message });
}

function readBody(req, limit = 1024 * 512) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload terlalu besar'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('JSON tidak valid'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function parseJSON(text, fallback) {
  try {
    const v = JSON.parse(text);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

const clean = (v, max = 120) => String(v ?? '').trim().slice(0, max);

/* ===================== ROUTE API ===================== */

async function handleAPI(req, res, url) {
  const seg = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const sub = seg.slice(1);
  const method = req.method;

  /* -- health -- */
  if (method === 'GET' && (sub.length === 0 || sub[0] === 'health')) {
    let students = 0;
    let attempts = 0;
    try {
      students = db.prepare('SELECT COUNT(*) AS n FROM students').get().n;
      attempts = db.prepare('SELECT COUNT(*) AS n FROM attempts').get().n;
    } catch { /* table belum siap */ }
    return sendJSON(res, 200, {
      ok: true,
      service: 'Website Pembelajaran Fungsi',
      db: path.relative(ROOT, DB_FILE),
      students,
      attempts,
      node: process.version
    });
  }

  /* -- students -- */
  if (method === 'GET' && sub[0] === 'students' && sub.length === 1) {
    const rows = db
      .prepare(
        `SELECT s.*,
                (SELECT COUNT(*) FROM attempts a WHERE a.student_id = s.id) AS total_attempts,
                (SELECT MAX(score * 100.0 / NULLIF(total,0)) FROM attempts a WHERE a.student_id = s.id) AS best_percent
         FROM students s ORDER BY s.nama COLLATE NOCASE`
      )
      .all();
    return sendJSON(res, 200, { ok: true, data: rows });
  }

  if (method === 'POST' && sub[0] === 'students' && sub.length === 1) {
    const b = await readBody(req);
    const nis = clean(b.nis, 40);
    const nama = clean(b.nama, 80);
    const kelas = clean(b.kelas, 40);
    if (!nama) return sendError(res, 400, 'Nama wajib diisi.');

    const existing = nis
      ? db.prepare('SELECT id FROM students WHERE nis = ?').get(nis)
      : db
          .prepare('SELECT id FROM students WHERE nama = ? AND kelas = ?')
          .get(nama, kelas);

    if (existing) {
      db.prepare(
        `UPDATE students SET nama = ?, kelas = ?, nis = COALESCE(NULLIF(?, ''), nis),
                             updated_at = datetime('now') WHERE id = ?`
      ).run(nama, kelas, nis, existing.id);
      const row = db.prepare('SELECT * FROM students WHERE id = ?').get(existing.id);
      return sendJSON(res, 200, { ok: true, created: false, data: row });
    }

    const info = nis
      ? db.prepare('INSERT INTO students (nis, nama, kelas) VALUES (?, ?, ?)').run(nis, nama, kelas)
      : db.prepare('INSERT INTO students (nama, kelas) VALUES (?, ?)').run(nama, kelas);
    const row = db.prepare('SELECT * FROM students WHERE id = ?').get(info.lastInsertRowid);
    return sendJSON(res, 201, { ok: true, created: true, data: row });
  }

  /* -- satu siswa -- */
  if (method === 'GET' && sub[0] === 'students' && sub.length === 2) {
    const row = db.prepare('SELECT * FROM students WHERE id = ?').get(sub[1]);
    if (!row) return sendError(res, 404, 'Siswa tidak ditemukan.');
    const progress = db.prepare('SELECT section, data, updated_at FROM progress WHERE student_id = ?').all(row.id);
    const attempts = db
      .prepare('SELECT id, section, score, total, details, created_at FROM attempts WHERE student_id = ? ORDER BY id DESC')
      .all(row.id);
    return sendJSON(res, 200, {
      ok: true,
      data: {
        ...row,
        progress: Object.fromEntries(progress.map((p) => [p.section, parseJSON(p.data, {})])),
        attempts: attempts.map((a) => ({ ...a, details: parseJSON(a.details, []) }))
      }
    });
  }

  if (method === 'DELETE' && sub[0] === 'students' && sub.length === 2) {
    const info = db.prepare('DELETE FROM students WHERE id = ?').run(sub[1]);
    if (!info.changes) return sendError(res, 404, 'Siswa tidak ditemukan.');
    db.prepare('DELETE FROM progress WHERE student_id = ?').run(sub[1]);
    db.prepare('DELETE FROM attempts WHERE student_id = ?').run(sub[1]);
    return sendJSON(res, 200, { ok: true });
  }

  /* -- progress (autosave)-- */
  if (method === 'POST' && sub[0] === 'progress' && sub.length === 1) {
    const b = await readBody(req);
    const id = Number(b.student_id);
    if (!id) return sendError(res, 400, 'student_id wajib diisi.');
    if (!db.prepare('SELECT 1 FROM students WHERE id = ?').get(id))
      return sendError(res, 404, 'Siswa tidak ditemukan.');
    const entries = Array.isArray(b.items) ? b.items : [{ section: b.section, data: b.data }];
    const stmt = db.prepare(
      `INSERT INTO progress (student_id, section, data, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(student_id, section) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    );
    const saved = [];
    for (const it of entries) {
      const section = clean(it.section, 40);
      if (!section) continue;
      stmt.run(id, section, JSON.stringify(it.data ?? {}));
      saved.push(section);
    }
    return sendJSON(res, 200, { ok: true, saved });
  }

  if (method === 'GET' && sub[0] === 'progress' && sub.length === 2) {
    const rows = db
      .prepare('SELECT section, data, updated_at FROM progress WHERE student_id = ?')
      .all(sub[1]);
    return sendJSON(res, 200, {
      ok: true,
      data: Object.fromEntries(rows.map((r) => [r.section, parseJSON(r.data, {})]))
    });
  }

  /* -- attempts (nilai latihan) -- */
  if (method === 'POST' && sub[0] === 'attempts' && sub.length === 1) {
    const b = await readBody(req);
    const id = Number(b.student_id);
    if (!id) return sendError(res, 400, 'student_id wajib diisi.');
    if (!db.prepare('SELECT 1 FROM students WHERE id = ?').get(id))
      return sendError(res, 404, 'Siswa tidak ditemukan.');
    const section = clean(b.section, 40) || 'latihan';
    const score = Math.max(0, Math.min(1000, Number(b.score) || 0));
    const total = Math.max(1, Math.min(1000, Number(b.total) || 1));
    const info = db
      .prepare('INSERT INTO attempts (student_id, section, score, total, details) VALUES (?, ?, ?, ?, ?)')
      .run(id, section, score, total, JSON.stringify(Array.isArray(b.details) ? b.details.slice(0, 200) : []));
    const row = db.prepare('SELECT * FROM attempts WHERE id = ?').get(info.lastInsertRowid);
    return sendJSON(res, 201, { ok: true, data: { ...row, details: parseJSON(row.details, []) } });
  }

  if (method === 'GET' && sub[0] === 'attempts' && sub.length === 2) {
    const id = sub[1];
    const section = url.searchParams.get('section');
    const rows = section
      ? db
          .prepare(
            'SELECT * FROM attempts WHERE student_id = ? AND section = ? ORDER BY id DESC LIMIT 100'
          )
          .all(id, section)
      : db.prepare('SELECT * FROM attempts WHERE student_id = ? ORDER BY id DESC LIMIT 100').all(id);
    return sendJSON(res, 200, {
      ok: true,
      data: rows.map((r) => ({ ...r, details: parseJSON(r.details, []) }))
    });
  }

  if (method === 'GET' && sub[0] === 'attempts' && sub.length === 1) {
    const section = url.searchParams.get('section');
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 50));
    const rows = section
      ? db
          .prepare(
            `SELECT a.*, s.nama, s.kelas, s.nis FROM attempts a
             JOIN students s ON s.id = a.student_id
             WHERE a.section = ? ORDER BY a.id DESC LIMIT ?`
          )
          .all(section, limit)
      : db
          .prepare(
            `SELECT a.*, s.nama, s.kelas, s.nis FROM attempts a
             JOIN students s ON s.id = a.student_id ORDER BY a.id DESC LIMIT ?`
          )
          .all(limit);
    return sendJSON(res, 200, {
      ok: true,
      data: rows.map((r) => ({ ...r, details: parseJSON(r.details, []) }))
    });
  }

  /* -- laporan nilai per siswa (rekap)-- */
  if (method === 'GET' && sub[0] === 'reports' && sub.length === 1) {
    const rows = db
      .prepare(
        `SELECT s.id, s.nis, s.nama, s.kelas,
                COUNT(a.id) AS jumlah,
                IFNULL(ROUND(AVG(a.score * 100.0 / a.total), 1), 0) AS rata_rata,
                IFNULL(MAX(a.score * 100.0 / a.total), 0) AS terbaik,
                MAX(a.created_at) AS terakhir
         FROM students s LEFT JOIN attempts a ON a.student_id = s.id
         GROUP BY s.id ORDER BY rata_rata DESC, s.nama COLLATE NOCASE`
      )
      .all();
    const perSection = db
      .prepare(
        `SELECT s.nama, s.kelas, a.section,
                ROUND(AVG(a.score * 100.0 / a.total), 1) AS rata_rata, COUNT(*) AS jumlah
         FROM attempts a JOIN students s ON s.id = a.student_id
         GROUP BY s.id, a.section ORDER BY s.nama COLLATE NOCASE, a.section`
      )
      .all();
    return sendJSON(res, 200, { ok: true, data: rows, per_section: perSection });
  }

  /* -- ekspor seluruh data (JSON) -- */
  if (method === 'GET' && sub[0] === 'export' && sub.length === 1) {
    const students = db.prepare('SELECT * FROM students ORDER BY id').all();
    const progress = db.prepare('SELECT * FROM progress').all();
    const attempts = db.prepare('SELECT * FROM attempts ORDER BY id').all();
    return sendJSON(res, 200, {
      ok: true,
      app: 'Website Pembelajaran Fungsi',
      exported_at: new Date().toISOString(),
      data: { students, progress, attempts }
    });
  }

  return sendError(res, 404, 'Endpoint tidak dikenal: ' + url.pathname);
}

/* ===================== SERVER STATIS ===================== */

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '' || rel === '/index.html') rel = '/' + INDEX_FILE;

  const target = path.resolve(ROOT, '.' + rel.split('?')[0]);
  if (!target.startsWith(path.resolve(ROOT))) return sendError(res, 403, 'Akses ditolak.');

  let stat;
  try {
    stat = await fsp.stat(target);
  } catch {
    return sendError(res, 404, 'File tidak ditemukan: ' + rel);
  }
  if (stat.isDirectory()) {
    const idx = path.join(target, INDEX_FILE);
    if (fs.existsSync(idx)) return streamFile(res, idx);
    return sendError(res, 404, 'Folder tidak memiliki halaman index.');
  }

  // Jangan pernah bocorkan database maupun sumber backend lewat URL.
  const base = path.basename(target).toLowerCase();
  if (base.endsWith('.db') || base.endsWith('.db-wal') || base.endsWith('.db-shm') || base.startsWith('.')) {
    return sendError(res, 403, 'Akses ditolak.');
  }
  if (DENY.includes(base)) return sendError(res, 403, 'Berkas sumber backend tidak dipublikasikan.');

  return streamFile(res, target, stat);
}

function streamFile(res, file, stat) {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat ? stat.size : fs.statSync(file).size,
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(file).pipe(res);
}

/* ===================== SERVER ===================== */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  try {
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return await handleAPI(req, res, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, 405, 'Method tidak diizinkan.');
    return await serveStatic(req, res, url);
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    console.error('[error]', req.method, url.pathname, '-', err && err.message);
    if (!res.headersSent) sendError(res, status, err && err.message ? err.message : 'Kesalahan server.');
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Website Pembelajaran Fungsi');
  console.log('  ---------------------------------------------');
  console.log('  Situs      : http://' + HOST + ':' + PORT + '/');
  console.log('  API        : http://' + HOST + ':' + PORT + '/api/health');
  console.log('  Database   : ' + DB_FILE);
  console.log('  Cara stop  : tekan Ctrl + C');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n  Port ' + PORT + ' sedang dipakai. Coba: set PORT=3001\n');
    process.exit(1);
  }
  throw err;
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\n  Menutup server...');
    try { db.close(); } catch { /* ignore */ }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}