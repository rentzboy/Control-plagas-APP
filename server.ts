import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import fs from "fs";
import nodemailer from "nodemailer";

import multer from "multer";

const PORT = 3000;
const isProd = process.env.NODE_ENV === "production" || process.argv[1]?.endsWith("server.cjs");
const dbFile = path.resolve(process.cwd(), "agrocontrol.db");
let db = new Database(dbFile);

const uploadDir = "/tmp/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Mailer setup
let transporter: nodemailer.Transporter | null = null;
async function setupMailer() {
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log("Ethereal testing SMTP setup complete. Check Ethereal for sent emails.");
    } catch (e) {
      console.log("Could not set up test mailer");
    }
  }
}
setupMailer();


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
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV, 
      time: new Date().toISOString(),
      cwd: process.cwd()
    });
  });

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
    const { id } = req.params;
    const updates = req.body;
    
    // Get existing parcel
    const existing = db.prepare("SELECT * FROM parcelas WHERE id = ?").get(id) as any;
    if (!existing) return res.status(404).json({ error: "Parcela no encontrada" });

    // Merge updates
    const merged = {
      nombre: updates.nombre ?? existing.nombre,
      grupo_id: updates.hasOwnProperty('grupoId') ? updates.grupoId : existing.grupo_id,
      finca_id: updates.fincaId ?? existing.finca_id,
      gml_data: updates.gmlData ?? existing.gml_data,
      puntos_json: updates.puntosJson ? JSON.stringify(updates.puntosJson) : existing.puntos_json,
      total_arboles: updates.totalArboles ?? existing.total_arboles,
      separacion_arboles: updates.separacionArboles ?? existing.separacion_arboles,
      separacion_filas: updates.separacionFilas ?? existing.separacion_filas
    };

    db.prepare(`
      UPDATE parcelas 
      SET nombre = ?, grupo_id = ?, finca_id = ?, gml_data = ?, puntos_json = ?, total_arboles = ?, separacion_arboles = ?, separacion_filas = ? 
      WHERE id = ?
    `).run(
      merged.nombre, 
      merged.grupo_id, 
      merged.finca_id, 
      merged.gml_data, 
      merged.puntos_json, 
      merged.total_arboles, 
      merged.separacion_arboles, 
      merged.separacion_filas, 
      id
    );
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
    const { parcelaId, fincaId, plagaId } = req.query;
    let query = `
      SELECT r.*, f.nombre as finca_nombre, p.nombre as parcela_nombre, pl.nombre as plaga_nombre
      FROM revisiones r
      INNER JOIN fincas f ON r.finca_id = f.id
      INNER JOIN parcelas p ON r.parcela_id = p.id
      INNER JOIN plagas pl ON r.plaga_id = pl.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (parcelaId) {
      query += " AND r.parcela_id = ?";
      params.push(parcelaId);
    }
    if (fincaId) {
      query += " AND r.finca_id = ?";
      params.push(fincaId);
    }
    if (plagaId) {
      query += " AND r.plaga_id = ?";
      params.push(plagaId);
    }
    query += " ORDER BY r.fecha DESC";
    
    const revisiones = db.prepare(query).all(...params);
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

  app.put("/api/revisiones/:id", (req, res) => {
    const { datosPuntosJson } = req.body;
    db.prepare(`
      UPDATE revisiones 
      SET datos_puntos_json = ? 
      WHERE id = ?
    `).run(JSON.stringify(datosPuntosJson), req.params.id);
    res.json({ success: true });
  });

  // Export y Accesos Extra
  app.get("/api/download-db", (req, res) => {
    if (fs.existsSync(dbFile)) {
      res.download(dbFile, "agrocontrol.db");
    } else {
      res.status(404).send("Base de datos no encontrada");
    }
  });

  app.post("/api/export/email", async (req, res) => {
    const { email } = req.body;
    try {
      if (!transporter) {
        return res.status(500).json({ error: "Servicio de email no configurado" });
      }

      // Gather some stats for the email body
      const stats = db.prepare("SELECT count(*) as count FROM revisiones").get() as any;

      const info = await transporter.sendMail({
        from: '"AgroControl Plagas" <noreply@agrocontrol.local>',
        to: email,
        subject: "Informe de Exportación AgroControl",
        text: `Se adjunta el reporte. Total de revisiones registradas: ${stats.count}`,
        html: `<h3>Informe Generado</h3><p>Total de revisiones en el sistema: <b>${stats.count}</b>.</p>`,
      });
      
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("Mensaje enviado: %s", info.messageId);
      if (previewUrl) {
         console.log("Vista previa disponible en: %s", previewUrl);
      }
      
      res.json({ 
        success: true, 
        message: previewUrl 
          ? `Correo enviado (simulado). Mira la consola para URL.` 
          : `Datos enviados exitosamente a ${email}` 
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Error enviando correo" });
    }
  });

  app.post("/api/export/server", (req, res) => {
    // Mock external server export
    const { serverUrl, data } = req.body;
    console.log(`Exporting data to ${serverUrl}`);
    res.json({ success: true, message: "Datos enviados al servidor (simulado)" });
  });

  app.post("/api/admin/restore-db", upload.single("database"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo" });

    try {
      const stats = fs.statSync(req.file.path);
      console.log(`Restoring database from: ${req.file.path} (Size: ${stats.size} bytes)`);
      
      if (stats.size === 0) {
        throw new Error("El archivo subido está vacío");
      }

      // Close current connection
      db.close();
      
      // Reemplazar archivo
      fs.copyFileSync(req.file.path, dbFile);
      
      // Reiniciar conexión
      db = new Database(dbFile);
      
      // Verificar si hay datos inmediatamente
      const count = db.prepare("SELECT count(*) as count FROM parcelas").get() as any;
      console.log(`Database restored. Parcelas count: ${count?.count}`);
      
      // Limpiar temporal
      fs.unlinkSync(req.file.path);
      
      res.json({ 
        success: true, 
        message: "Base de datos restaurada correctamente",
        stats: { parcelas: count?.count }
      });
    } catch (e: any) {
      console.error("Error restoring database:", e);
      // Intentar reabrir la conexión si falla
      try { if (!db.open) db = new Database(dbFile); } catch(re) {}
      res.status(500).json({ error: "Fallo al restaurar la base de datos: " + (e.message || "Error desconocido") });
    }
  });

  // Vite middleware for development or fallback to static for production
  
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production path resolution
    const distPath = path.join(process.cwd(), "dist");
    
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application files not found. Please try rebuilding.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
