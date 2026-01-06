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

console.log('Agregando columna OP (Orden de Pago) a la tabla pagos...\n');

const sql = "ALTER TABLE pagos ADD COLUMN op TEXT";

db.run(sql, (err) => {
  if (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('✓ La columna OP ya existe en la tabla pagos');
    } else {
      console.error('❌ Error:', err.message);
      db.close();
      process.exit(1);
    }
  } else {
    console.log('✓ Columna OP agregada exitosamente');
  }

  // Verificar la estructura final
  db.all("PRAGMA table_info(pagos)", (err, rows) => {
    if (err) {
      console.error('Error al verificar la tabla:', err.message);
    } else {
      console.log('\n📋 Columnas de la tabla pagos:');
      rows.forEach(row => {
        const isNew = row.name === 'op';
        const check = isNew ? '✅' : '  ';
        console.log(`${check} ${row.name} (${row.type})`);
      });
    }

    console.log('\n✓ Migración completada. Puedes reiniciar el servidor.\n');
    db.close();
  });
});
