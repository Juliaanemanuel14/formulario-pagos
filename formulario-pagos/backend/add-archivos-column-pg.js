require('dotenv').config();
const db = require('./db');

async function addArchivosColumn() {
  try {
    console.log('🔧 Agregando columna "archivos_urls" a la tabla pagos (PostgreSQL)...');

    // Agregar columna para almacenar URLs de archivos (JSONB para mejor performance)
    await db.query(`
      ALTER TABLE pagos
      ADD COLUMN IF NOT EXISTS archivos_urls JSONB DEFAULT '[]'::jsonb
    `);

    console.log('✅ Columna "archivos_urls" agregada exitosamente');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al agregar columna:', error.message);
    await db.close();
    process.exit(1);
  }
}

addArchivosColumn();
