import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import fs from "fs";

const PORT = 3000;
const dbFile = path.resolve(process.cwd(), "agrocontrol.db");
const db = new Database(dbFile);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS fincas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS grupos_parcelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finca_id INTEGER,
    nombre TEXT NOT NULL,
    FOREIGN KEY(finca_id) REFERENCES fincas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS parcelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finca_id INTEGER,
    grupo_id INTEGER,
    nombre TEXT NOT NULL,
    gml_data TEXT,
    puntos_json TEXT, -- GeoJSON or similar for tree points
    total_arboles INTEGER,
    separacion_arboles REAL,
    separacion_filas REAL,
    FOREIGN KEY(finca_id) REFERENCES fincas(id) ON DELETE CASCADE,
    FOREIGN KEY(grupo_id) REFERENCES grupos_parcelas(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS plagas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS revisiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finca_id INTEGER,
    parcela_id INTEGER,
    plaga_id INTEGER,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    datos_puntos_json TEXT, -- Result of tree ratings
    FOREIGN KEY(finca_id) REFERENCES fincas(id),
    FOREIGN KEY(parcela_id) REFERENCES parcelas(id),
    FOREIGN KEY(plaga_id) REFERENCES plagas(id)
  );
`);

// Seed initial pests if empty
const pestCount = db.prepare("SELECT count(*) as count FROM plagas").get() as { count: number };
if (pestCount.count === 0) {
  const insertPest = db.prepare("INSERT INTO plagas (nombre) VALUES (?)");
  ["piojo", "mosca blanca", "gomosis", "prays", "ácaro"].forEach(p => insertPest.run(p));
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get("/api/fincas", (req, res) => {
    const fincas = db.prepare("SELECT * FROM fincas").all();
    res.json(fincas);
  });

  app.post("/api/fincas", (req, res) => {
    const { nombre } = req.body;
    const result = db.prepare("INSERT INTO fincas (nombre) VALUES (?)").run(nombre);
    res.json({ id: result.lastInsertRowid, nombre });
  });

  app.put("/api/fincas/:id", (req, res) => {
    const { nombre } = req.body;
    db.prepare("UPDATE fincas SET nombre = ? WHERE id = ?").run(nombre, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/fincas/:id", (req, res) => {
    db.prepare("DELETE FROM fincas WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Grupos
  app.get("/api/grupos", (req, res) => {
    const fincaId = req.query.fincaId;
    let query = "SELECT * FROM grupos_parcelas";
    if (fincaId) query += " WHERE finca_id = ?";
    const grupos = fincaId ? db.prepare(query).all(fincaId) : db.prepare(query).all();
    res.json(grupos);
  });

  app.post("/api/grupos", (req, res) => {
    const { fincaId, nombre } = req.body;
    const result = db.prepare("INSERT INTO grupos_parcelas (finca_id, nombre) VALUES (?, ?)").run(fincaId, nombre);
    res.json({ id: result.lastInsertRowid, fincaId, nombre });
  });

  app.put("/api/grupos/:id", (req, res) => {
    const { nombre } = req.body;
    db.prepare("UPDATE grupos_parcelas SET nombre = ? WHERE id = ?").run(nombre, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/grupos/:id", (req, res) => {
    db.prepare("DELETE FROM grupos_parcelas WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Parcelas
  app.get("/api/parcelas", (req, res) => {
    const fincaId = req.query.fincaId;
    let query = "SELECT * FROM parcelas";
    if (fincaId) query += " WHERE finca_id = ?";
    const parcelas = fincaId ? db.prepare(query).all(fincaId) : db.prepare(query).all();
    res.json(parcelas);
  });

  app.post("/api/parcelas", (req, res) => {
    const { fincaId, grupoId, nombre, gmlData, puntosJson, totalArboles, separacionArboles, separacionFilas } = req.body;
    const result = db.prepare(`
      INSERT INTO parcelas (finca_id, grupo_id, nombre, gml_data, puntos_json, total_arboles, separacion_arboles, separacion_filas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fincaId, grupoId, nombre, gmlData, JSON.stringify(puntosJson), totalArboles, separacionArboles, separacionFilas);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/parcelas/:id", (req, res) => {
    const { nombre, grupoId } = req.body;
    db.prepare("UPDATE parcelas SET nombre = ?, grupo_id = ? WHERE id = ?").run(nombre, grupoId, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/parcelas/:id", (req, res) => {
    db.prepare("DELETE FROM parcelas WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Plagas
  app.get("/api/plagas", (req, res) => {
    const plagas = db.prepare("SELECT * FROM plagas").all();
    res.json(plagas);
  });

  app.post("/api/plagas", (req, res) => {
    const { nombre } = req.body;
    try {
      const result = db.prepare("INSERT INTO plagas (nombre) VALUES (?)").run(nombre);
      res.json({ id: result.lastInsertRowid, nombre });
    } catch (e) {
      res.status(400).json({ error: "Plaga ya existe" });
    }
  });

  // Revisiones
  app.get("/api/revisiones", (req, res) => {
    const { parcelaId } = req.query;
    let query = `
      SELECT r.*, f.nombre as finca_nombre, p.nombre as parcela_nombre, pl.nombre as plaga_nombre
      FROM revisiones r
      JOIN fincas f ON r.finca_id = f.id
      JOIN parcelas p ON r.parcela_id = p.id
      JOIN plagas pl ON r.plaga_id = pl.id
    `;
    if (parcelaId) query += " WHERE r.parcela_id = ?";
    query += " ORDER BY r.fecha DESC";
    
    const revisiones = parcelaId ? db.prepare(query).all(parcelaId) : db.prepare(query).all();
    res.json(revisiones);
  });

  // Estadísticas para Dashboard
  app.get("/api/stats", (req, res) => {
    const totalFincas = db.prepare("SELECT count(*) as count FROM fincas").get() as any;
    const totalParcelas = db.prepare("SELECT count(*) as count FROM parcelas").get() as any;
    const totalRevisiones = db.prepare("SELECT count(*) as count FROM revisiones").get() as any;
    
    // Distribución de salud (simplificada: promedio de los últimos ratings)
    const healthData = db.prepare(`
      SELECT datos_puntos_json FROM revisiones 
      ORDER BY fecha DESC LIMIT 10
    `).all() as any[];

    let green = 0, yellow = 0, red = 0;
    healthData.forEach(r => {
      const dots = JSON.parse(r.datos_puntos_json);
      Object.values(dots).forEach((val: any) => {
        const rating = typeof val === 'object' ? val.rating : val;
        if (rating === 0) green++;
        else if (rating === 1) yellow++;
        else if (rating === 2) red++;
      });
    });

    res.json({
      totals: { fincas: totalFincas.count, parcelas: totalParcelas.count, revisiones: totalRevisiones.count },
      healthDist: [
        { name: 'Sano', value: green, color: '#10b981' },
        { name: 'Aviso', value: yellow, color: '#fbbf24' },
        { name: 'Crítico', value: red, color: '#ef4444' }
      ]
    });
  });

  app.post("/api/revisiones", (req, res) => {
    const { fincaId, parcelaId, plagaId, fecha, datosPuntosJson } = req.body;
    const result = db.prepare(`
      INSERT INTO revisiones (finca_id, parcela_id, plaga_id, fecha, datos_puntos_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(fincaId, parcelaId, plagaId, fecha, JSON.stringify(datosPuntosJson));
    res.json({ id: result.lastInsertRowid });
  });

  // Export
  app.post("/api/export/email", (req, res) => {
    // Mock email export
    const { email, data } = req.body;
    console.log(`Exporting data to ${email}`);
    res.json({ success: true, message: "Datos enviados por email (simulado)" });
  });

  app.post("/api/export/server", (req, res) => {
    // Mock external server export
    const { serverUrl, data } = req.body;
    console.log(`Exporting data to ${serverUrl}`);
    res.json({ success: true, message: "Datos enviados al servidor (simulado)" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
