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

console.log('=== ESTRUCTURA DE LA TABLA PAGOS ===\n');

db.all("PRAGMA table_info(pagos)", [], (err, columns) => {
  if (err) {
    console.error('Error:', err.message);
    db.close();
    process.exit(1);
  }

  if (columns.length === 0) {
    console.log('❌ La tabla "pagos" no existe.');
  } else {
    console.log('Columnas en la tabla "pagos":');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
    });

    // Verificar si tiene las columnas nuevas
    const columnNames = columns.map(col => col.name);
    console.log('\n=== VERIFICACIÓN DE MIGRACIÓN ===\n');
    console.log(`✓ Columna "proveedor": ${columnNames.includes('proveedor') ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`✓ Columna "fecha_pago": ${columnNames.includes('fecha_pago') ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`✓ Columna "fecha_servicio": ${columnNames.includes('fecha_servicio') ? '✅ EXISTS' : '❌ MISSING'}`);

    const hasFecha = columnNames.includes('fecha');
    console.log(`✓ Columna "fecha" (antigua): ${hasFecha ? '⚠️ STILL EXISTS' : '✓ REMOVED'}`);

    if (!columnNames.includes('proveedor') || !columnNames.includes('fecha_pago') || !columnNames.includes('fecha_servicio')) {
      console.log('\n⚠️ ATENCIÓN: La migración no se ha completado correctamente.');
      console.log('   Ejecuta: npm run migrate-db');
    } else {
      console.log('\n✅ La base de datos tiene todas las columnas necesarias.');
    }
  }

  db.close((err) => {
    if (err) {
      console.error('Error al cerrar la base de datos:', err.message);
    }
  });
});
