const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const app = express();
const db = new Database("kyles-catalog.db");
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-now";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
  CREATE TABLE IF NOT EXISTS catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price TEXT DEFAULT '',
    available INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

if (!db.prepare("SELECT 1 FROM catalog LIMIT 1").get()) {
  const add = db.prepare("INSERT INTO catalog (name, description, price, available) VALUES (?, ?, ?, ?)");
  add.run("Example Item", "Replace this from the admin page.", "$5", 10);
  add.run("Another Item", "A second example catalog item.", "$3", 5);
}

function resetIfNewDay() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const row = db.prepare("SELECT value FROM settings WHERE key='last_reset'").get();
  if (!row || row.value !== today) {
    // Availability is reset to the original daily quantity stored in settings.
    const quantities = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'qty:%'").all();
    const qtyMap = new Map(quantities.map(x => [Number(x.key.slice(4)), Number(x.value)]));
    const items = db.prepare("SELECT id, available FROM catalog").all();
    const update = db.prepare("UPDATE catalog SET available=? WHERE id=?");
    const tx = db.transaction(() => {
      for (const item of items) {
        const qty = qtyMap.has(item.id) ? qtyMap.get(item.id) : item.available;
        update.run(qty, item.id);
      }
      db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('last_reset',?)").run(today);
    });
    tx();
  }
}
resetIfNewDay();

function adminOnly(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || token !== ADMIN_PASSWORD) return res.status(401).json({error:"Unauthorized"});
  next();
}

app.get("/api/catalog", (req,res) => {
  resetIfNewDay();
  res.json(db.prepare("SELECT * FROM catalog ORDER BY id").all());
});

app.post("/api/preorder", (req,res) => {
  resetIfNewDay();
  const { name, itemId } = req.body;
  if (!name?.trim() || !itemId) return res.status(400).json({error:"Name and item are required."});
  const item = db.prepare("SELECT * FROM catalog WHERE id=?").get(itemId);
  if (!item) return res.status(404).json({error:"Item not found."});
  if (item.available <= 0) return res.status(409).json({error:"That item is sold out."});

  const tx = db.transaction(() => {
    db.prepare("UPDATE catalog SET available=available-1 WHERE id=? AND available>0").run(itemId);
    db.prepare("INSERT INTO orders(name,item_id,item_name,created_at) VALUES(?,?,?,?)")
      .run(name.trim().slice(0,100), item.id, item.name, new Date().toISOString());
  });
  tx();
  res.json({ok:true});
});

app.post("/api/admin/login", (req,res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({token: ADMIN_PASSWORD});
  } else res.status(401).json({error:"Wrong password."});
});

app.get("/api/admin/orders", adminOnly, (req,res) => {
  resetIfNewDay();
  res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC").all());
});

app.post("/api/admin/catalog", adminOnly, (req,res) => {
  const { id, name, description="", price="", dailyQuantity=0 } = req.body;
  if (!name?.trim()) return res.status(400).json({error:"Name is required."});
  const qty = Math.max(0, Number(dailyQuantity) || 0);

  if (id) {
    db.prepare("UPDATE catalog SET name=?, description=?, price=? WHERE id=?")
      .run(name.trim(), description, price, id);
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)").run(`qty:${id}`, String(qty));
    db.prepare("UPDATE catalog SET available=? WHERE id=?").run(qty, id);
  } else {
    const info = db.prepare("INSERT INTO catalog(name,description,price,available) VALUES(?,?,?,?)")
      .run(name.trim(), description, price, qty);
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)").run(`qty:${info.lastInsertRowid}`, String(qty));
  }
  res.json({ok:true});
});

app.delete("/api/admin/catalog/:id", adminOnly, (req,res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM catalog WHERE id=?").run(id);
  db.prepare("DELETE FROM settings WHERE key=?").run(`qty:${id}`);
  res.json({ok:true});
});

app.post("/api/admin/reset", adminOnly, (req,res) => {
  const items = db.prepare("SELECT id FROM catalog").all();
  const update = db.prepare("UPDATE catalog SET available=? WHERE id=?");
  const tx = db.transaction(() => {
    for (const item of items) {
      const q = db.prepare("SELECT value FROM settings WHERE key=?").get(`qty:${item.id}`);
      update.run(Number(q?.value || 0), item.id);
    }
  });
  tx();
  res.json({ok:true});
});

app.listen(PORT, () => console.log(`Kyle's Catalog running at http://localhost:${PORT}`));