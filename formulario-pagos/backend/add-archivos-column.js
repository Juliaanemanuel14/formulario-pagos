require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pagos.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Agregando columna "archivos_urls" a la tabla pagos...');

// Agregar columna para almacenar URLs de archivos (JSON)
db.run(`ALTER TABLE pagos ADD COLUMN archivos_urls TEXT DEFAULT '[]'`, (err) => {
  if (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('ℹ️  La columna "archivos_urls" ya existe');
    } else {
      console.error('❌ Error al agregar columna:', err.message);
      db.close();
      process.exit(1);
    }
  } else {
    console.log('✅ Columna "archivos_urls" agregada exitosamente');
  }

  db.close(() => {
    console.log('✓ Base de datos actualizada');
    process.exit(0);
  });
});
