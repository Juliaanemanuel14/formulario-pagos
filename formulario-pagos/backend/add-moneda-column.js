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

console.log('Agregando columna "moneda" a la tabla pagos...\n');

// Agregar la columna moneda con valor por defecto
db.run("ALTER TABLE pagos ADD COLUMN moneda TEXT DEFAULT 'Peso'", (err) => {
  if (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('✓ La columna "moneda" ya existe en la tabla pagos.');
    } else {
      console.error('❌ Error al agregar columna moneda:', err.message);
      db.close();
      process.exit(1);
    }
  } else {
    console.log('✓ Columna "moneda" agregada exitosamente con valor por defecto "Peso".');
  }

  // Verificar que la columna existe
  db.all("PRAGMA table_info(pagos)", (err, rows) => {
    if (err) {
      console.error('Error al verificar la tabla:', err.message);
      db.close();
      process.exit(1);
    }

    console.log('\n📋 Columnas actuales de la tabla pagos:');
    rows.forEach(row => {
      const check = row.name === 'moneda' ? '✅' : '  ';
      console.log(`${check} ${row.name} (${row.type})`);
    });

    console.log('\n✅ Migración completada exitosamente.');
    console.log('Ahora puedes reiniciar el servidor: npm start\n');

    db.close();
  });
});
