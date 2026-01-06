const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pagos.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
    process.exit(1);
  }
  console.log('Conectado a la base de datos SQLite.');
});

// Tabla principal de pagos
const createPagosTableSQL = `
  CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local TEXT NOT NULL,
    proveedor TEXT NOT NULL,
    fecha_pago DATE NOT NULL,
    fecha_servicio DATE NOT NULL,
    moneda TEXT NOT NULL,
    usuario_registro TEXT NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

// Tabla de items/detalles del pago
const createItemsTableSQL = `
  CREATE TABLE IF NOT EXISTS pago_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pago_id INTEGER NOT NULL,
    concepto TEXT NOT NULL,
    importe REAL NOT NULL,
    observacion TEXT,
    FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE
  )
`;

// Crear tablas en secuencia
db.run(createPagosTableSQL, (err) => {
  if (err) {
    console.error('Error al crear la tabla pagos:', err.message);
    db.close();
    process.exit(1);
  } else {
    console.log('Tabla "pagos" creada exitosamente o ya existe.');

    // Crear tabla de items
    db.run(createItemsTableSQL, (err) => {
      if (err) {
        console.error('Error al crear la tabla pago_items:', err.message);
      } else {
        console.log('Tabla "pago_items" creada exitosamente o ya existe.');
      }

      db.close((err) => {
        if (err) {
          console.error('Error al cerrar la base de datos:', err.message);
        } else {
          console.log('Base de datos inicializada correctamente.');
        }
      });
    });
  }
});
