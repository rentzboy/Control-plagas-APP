
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const paths = [
  path.resolve(process.cwd(), 'agrocontrol.db'),
  '/tmp/agrocontrol.db'
];

for (const p of paths) {
  if (fs.existsSync(p)) {
    console.log(`Checking path: ${p}`);
    const stats = fs.statSync(p);
    console.log(`File Size: ${stats.size} bytes`);
    
    if (stats.size === 0) continue;

    const db = new Database(p);
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      console.log('Tables found:', tables.map(t => t.name).join(', '));
      
      const results: any = {};
      for (const table of tables) {
        try {
          const count = db.prepare(`SELECT count(*) as count FROM ${table.name}`).get() as any;
          results[table.name] = count.count;
        } catch (err) {
          results[table.name] = 'Error: ' + (err as any).message;
        }
      }
      console.log('Counts:', results);
      
      if (results['parcelas'] > 0) {
          const sample = db.prepare('SELECT * FROM parcelas LIMIT 1').all();
          console.log('Sample Parcela:', sample);
      }
    } catch (e) {
      console.error(`Error reading DB at ${p}:`, e);
    }
    db.close();
  } else {
    console.log(`Path does not exist: ${p}`);
  }
}
