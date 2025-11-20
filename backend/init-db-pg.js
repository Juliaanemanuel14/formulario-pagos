require('dotenv').config();
const db = require('./db');

async function initDatabase() {
  try {
    console.log('Inicializando base de datos PostgreSQL...');
    await db.initTables();
    console.log('✅ Base de datos inicializada correctamente');
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    await db.close();
    process.exit(1);
  }
}

initDatabase();
