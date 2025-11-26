require('dotenv').config();
const db = require('./db');

async function migratePagosTable() {
  console.log('🔄 Iniciando migración de la tabla pagos en PostgreSQL...\n');

  const migrations = [
    {
      name: 'Agregar columna proveedor',
      sql: 'ALTER TABLE pagos ADD COLUMN IF NOT EXISTS proveedor VARCHAR(255)'
    },
    {
      name: 'Agregar columna fecha_pago',
      sql: 'ALTER TABLE pagos ADD COLUMN IF NOT EXISTS fecha_pago DATE'
    },
    {
      name: 'Agregar columna fecha_servicio',
      sql: 'ALTER TABLE pagos ADD COLUMN IF NOT EXISTS fecha_servicio DATE'
    },
    {
      name: 'Agregar columna moneda',
      sql: 'ALTER TABLE pagos ADD COLUMN IF NOT EXISTS moneda VARCHAR(50)'
    },
    {
      name: 'Agregar columna concepto',
      sql: 'ALTER TABLE pagos ADD COLUMN IF NOT EXISTS concepto TEXT'
    },
    {
      name: 'Agregar columna importe',
      sql: 'ALTER TABLE pagos ADD COLUMN IF NOT EXISTS importe DECIMAL(10, 2)'
    },
    {
      name: 'Agregar columna observacion',
      sql: 'ALTER TABLE pagos ADD COLUMN IF NOT EXISTS observacion TEXT'
    },
    {
      name: 'Agregar columna op',
      sql: 'ALTER TABLE pagos ADD COLUMN IF NOT EXISTS op VARCHAR(50)'
    }
  ];

  try {
    for (const migration of migrations) {
      console.log(`▶ ${migration.name}...`);
      await db.query(migration.sql);
      console.log(`  ✅ Completado`);
    }

    // Copiar datos de 'fecha' a las nuevas columnas si existen datos
    console.log('\n▶ Copiando datos de fecha a fecha_pago y fecha_servicio...');
    await db.query(`
      UPDATE pagos
      SET fecha_pago = fecha, fecha_servicio = fecha
      WHERE fecha_pago IS NULL AND fecha IS NOT NULL
    `);
    console.log('  ✅ Datos copiados');

    console.log('\n✅ Migración completada exitosamente');
    console.log('\n📋 Verificando estructura de la tabla...\n');

    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'pagos'
      ORDER BY ordinal_position
    `);

    console.log('Columnas de la tabla pagos:');
    result.rows.forEach(col => {
      const isNew = ['proveedor', 'fecha_pago', 'fecha_servicio', 'moneda', 'concepto', 'importe', 'observacion', 'op'].includes(col.column_name);
      const marker = isNew ? '✅' : '  ';
      console.log(`${marker} ${col.column_name} (${col.data_type})`);
    });

    console.log('\n✓ La base de datos está lista para usar');

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error.message);
    throw error;
  } finally {
    await db.close();
  }
}

migratePagosTable();
