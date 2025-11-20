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

console.log('Migrando base de datos a estructura sin items...\n');

const steps = [
  {
    name: 'Agregar columna concepto',
    sql: "ALTER TABLE pagos ADD COLUMN concepto TEXT"
  },
  {
    name: 'Agregar columna importe',
    sql: "ALTER TABLE pagos ADD COLUMN importe REAL"
  },
  {
    name: 'Agregar columna observacion',
    sql: "ALTER TABLE pagos ADD COLUMN observacion TEXT"
  }
];

let stepIndex = 0;

function executeStep() {
  if (stepIndex >= steps.length) {
    console.log('\n✅ Migración completada exitosamente.');
    console.log('\nVerificando estructura final...\n');

    db.all("PRAGMA table_info(pagos)", (err, rows) => {
      if (err) {
        console.error('Error al verificar la tabla:', err.message);
      } else {
        console.log('📋 Columnas de la tabla pagos:');
        rows.forEach(row => {
          const isNew = ['concepto', 'importe', 'observacion'].includes(row.name);
          const check = isNew ? '✅' : '  ';
          console.log(`${check} ${row.name} (${row.type})`);
        });
      }

      console.log('\n✓ Ahora puedes reiniciar el servidor: npm start\n');
      db.close();
    });
    return;
  }

  const step = steps[stepIndex];
  console.log(`${stepIndex + 1}. ${step.name}...`);

  db.run(step.sql, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log(`   ✓ La columna ya existe`);
      } else {
        console.error(`   ❌ Error: ${err.message}`);
        db.close();
        process.exit(1);
      }
    } else {
      console.log(`   ✓ Completado`);
    }
    stepIndex++;
    executeStep();
  });
}

executeStep();
