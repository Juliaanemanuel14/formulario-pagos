const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pagos.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
    process.exit(1);
  }
  console.log('Conectado a la base de datos SQLite.\n');
});

console.log('Aplicando corrección a la base de datos...\n');

// En SQLite no se puede modificar las constraints de una columna directamente
// Necesitamos recrear la tabla

const steps = [
  {
    name: 'Crear tabla temporal',
    sql: `
      CREATE TABLE IF NOT EXISTS pagos_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local TEXT NOT NULL,
        proveedor TEXT NOT NULL,
        fecha_pago DATE NOT NULL,
        fecha_servicio DATE NOT NULL,
        usuario_registro TEXT NOT NULL,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  {
    name: 'Copiar datos existentes',
    sql: `
      INSERT INTO pagos_new (id, local, proveedor, fecha_pago, fecha_servicio, usuario_registro, fecha_registro)
      SELECT
        id,
        local,
        COALESCE(proveedor, 'Sin especificar'),
        COALESCE(fecha_pago, fecha, date('now')),
        COALESCE(fecha_servicio, fecha, date('now')),
        usuario_registro,
        fecha_registro
      FROM pagos
    `
  },
  {
    name: 'Eliminar tabla antigua',
    sql: 'DROP TABLE pagos'
  },
  {
    name: 'Renombrar tabla nueva',
    sql: 'ALTER TABLE pagos_new RENAME TO pagos'
  }
];

function executeStep(index) {
  if (index >= steps.length) {
    console.log('\n✅ Base de datos actualizada exitosamente.');
    console.log('Ahora puedes iniciar el servidor: npm start\n');
    db.close();
    return;
  }

  const step = steps[index];
  console.log(`${index + 1}. ${step.name}...`);

  db.run(step.sql, (err) => {
    if (err) {
      console.error(`   ❌ Error: ${err.message}`);
      db.close();
      process.exit(1);
    } else {
      console.log(`   ✓ Completado`);
      executeStep(index + 1);
    }
  });
}

// Iniciar proceso
executeStep(0);
