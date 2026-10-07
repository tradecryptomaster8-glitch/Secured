const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || "/app/data";
const DATA_FILE = path.join(DATA_DIR, "data.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

const CATEGORIES = [
  { id: "crypto",        name: "Crypto",           icon: "₿"  },
  { id: "ng-banks",      name: "Nigerian Banks",   icon: "🇳🇬" },
  { id: "us-banks",      name: "USA Banks",        icon: "🇺🇸" },
  { id: "local",         name: "Local Companies",  icon: "🏢" },
  { id: "social",        name: "Social Media",     icon: "💬" },
  { id: "email",         name: "Email Tech",       icon: "📧" },
  { id: "entertainment", name: "Entertainment",    icon: "🎬" },
  { id: "admin",         name: "Admin Panel",      icon: "🛡️" }
];

function buildSeed() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    categories: CATEGORIES.map(c => ({
      ...c,
      websites: Array.from({ length: 30 }, (_, i) => ({
        id: `${c.id}-${i + 1}`,
        name: `${c.name} Site ${i + 1}`,
        url: `https://example-${c.id}-${i + 1}.com`,
        captures: 0
      }))
    })),
    captures: []
  };
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = buildSeed();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    const seed = buildSeed();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
}

function saveData(data) {
  data.updatedAt = new Date().toISOString();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

app.use(express.json());

app.get("/", (req, res) => {
  const data = loadData();
  const totalSites = data.categories.reduce((n, c) => n + c.websites.length, 0);
  res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>30 WEBSITES CONTROL PANEL</title>
<style>
body{font-family:system-ui;background:#0d1117;color:#c9d1d9;margin:0;padding:2rem}
h1{color:#58a6ff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;margin-top:1.5rem}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1rem}
.card h3{margin:0 0 .5rem;color:#f0f6fc}
.big{font-size:2rem;font-weight:700;color:#3fb950}
.small{color:#8b949e;font-size:.85rem}
</style></head><body>
<h1>30 WEBSITES CONTROL PANEL</h1>
<p class="small">Deploy · Capture · Monitor</p>
<div class="grid">
  <div class="card"><h3>Categories</h3><div class="big">${data.categories.length}</div></div>
  <div class="card"><h3>Websites</h3><div class="big">${totalSites}</div></div>
  <div class="card"><h3>Captures</h3><div class="big">${data.captures.length}</div></div>
  <div class="card"><h3>Storage</h3><div class="small">${DATA_FILE}</div></div>
</div>
<h2 style="margin-top:2rem;color:#58a6ff">Categories (30 each)</h2>
<div class="grid">
${data.categories.map(c => `<div class="card"><h3>${c.icon} ${c.name}</h3><div class="big">${c.websites.length}</div><div class="small">websites</div></div>`).join("")}
</div>
</body></html>`);
});

app.get("/api/data", (req, res) => res.json(loadData()));

app.get("/api/categories", (req, res) => {
  const data = loadData();
  res.json(data.categories.map(c => ({ id: c.id, name: c.name, icon: c.icon, count: c.websites.length })));
});

app.post("/api/capture", (req, res) => {
  const { websiteId, note } = req.body || {};
  const data = loadData();
  let found = null;
  for (const c of data.categories) {
    const w = c.websites.find(x => x.id === websiteId);
    if (w) { w.captures += 1; found = w; break; }
  }
  if (!found) return res.status(404).json({ error: "website not found" });
  const capture = { id: `cap-${Date.now()}`, websiteId, note: note || "", at: new Date().toISOString() };
  data.captures.push(capture);
  saveData(data);
  res.json({ ok: true, capture, website: found });
});

app.listen(PORT, () => {
  console.log(`Control panel running on :${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
  loadData();
});
