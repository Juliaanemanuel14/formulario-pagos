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

console.log('Iniciando migración de la base de datos...');

// Verificar si las columnas ya existen
db.all("PRAGMA table_info(pagos)", [], (err, columns) => {
  if (err) {
    console.error('Error al obtener información de la tabla:', err.message);
    db.close();
    process.exit(1);
  }

  const columnNames = columns.map(col => col.name);
  const hasProveedor = columnNames.includes('proveedor');
  const hasFechaPago = columnNames.includes('fecha_pago');
  const hasFechaServicio = columnNames.includes('fecha_servicio');

  if (hasProveedor && hasFechaPago && hasFechaServicio) {
    console.log('✓ La base de datos ya tiene las nuevas columnas.');
    db.close();
    return;
  }

  console.log('Aplicando migración...');

  // Agregar nueva columna 'proveedor'
  if (!hasProveedor) {
    db.run("ALTER TABLE pagos ADD COLUMN proveedor TEXT DEFAULT 'Sin especificar'", (err) => {
      if (err) {
        console.error('Error al agregar columna proveedor:', err.message);
      } else {
        console.log('✓ Columna "proveedor" agregada.');
      }
    });
  }

  // Agregar nueva columna 'fecha_pago'
  if (!hasFechaPago) {
    db.run("ALTER TABLE pagos ADD COLUMN fecha_pago DATE", (err) => {
      if (err) {
        console.error('Error al agregar columna fecha_pago:', err.message);
      } else {
        console.log('✓ Columna "fecha_pago" agregada.');
        // Copiar datos de 'fecha' a 'fecha_pago' si existe la columna 'fecha'
        if (columnNames.includes('fecha')) {
          db.run("UPDATE pagos SET fecha_pago = fecha WHERE fecha_pago IS NULL", (err) => {
            if (err) {
              console.error('Error al copiar datos a fecha_pago:', err.message);
            } else {
              console.log('✓ Datos copiados de "fecha" a "fecha_pago".');
            }
          });
        }
      }
    });
  }

  // Agregar nueva columna 'fecha_servicio'
  if (!hasFechaServicio) {
    db.run("ALTER TABLE pagos ADD COLUMN fecha_servicio DATE", (err) => {
      if (err) {
        console.error('Error al agregar columna fecha_servicio:', err.message);
      } else {
        console.log('✓ Columna "fecha_servicio" agregada.');
        // Copiar datos de 'fecha' a 'fecha_servicio' si existe la columna 'fecha'
        if (columnNames.includes('fecha')) {
          db.run("UPDATE pagos SET fecha_servicio = fecha WHERE fecha_servicio IS NULL", (err) => {
            if (err) {
              console.error('Error al copiar datos a fecha_servicio:', err.message);
            } else {
              console.log('✓ Datos copiados de "fecha" a "fecha_servicio".');
            }
          });
        }
      }
    });
  }

  // Esperar un momento antes de cerrar para que se completen las operaciones
  setTimeout(() => {
    db.close((err) => {
      if (err) {
        console.error('Error al cerrar la base de datos:', err.message);
      } else {
        console.log('\n✓ Migración completada exitosamente.');
        console.log('La base de datos ha sido actualizada con los nuevos campos.');
      }
    });
  }, 1000);
});
