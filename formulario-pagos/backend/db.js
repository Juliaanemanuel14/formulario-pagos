const { Pool } = require('pg');

// Configuración de la base de datos
const isProduction = process.env.NODE_ENV === 'production';

let pool;

if (isProduction) {
  // Configuración para PostgreSQL en Cloud SQL
  pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || '/cloudsql/' + process.env.INSTANCE_CONNECTION_NAME,
    port: process.env.DB_PORT || 5432,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  // Configuración para desarrollo local (puedes usar PostgreSQL local o SQLite)
  // Para desarrollo, usaremos variables de entorno o valores por defecto
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'pagos_db',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    max: 5,
  });
}

// Función para ejecutar queries
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Función para obtener un cliente del pool (para transacciones)
async function getClient() {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // Modificar release para mejorar debugging
  client.release = () => {
    client.query = query;
    client.release = release;
    return release.apply(client);
  };

  return client;
}

// Inicializar tablas
async function initTables() {
  const createPagosTable = `
    CREATE TABLE IF NOT EXISTS pagos (
      id SERIAL PRIMARY KEY,
      local VARCHAR(255) NOT NULL,
      proveedor VARCHAR(255),
      fecha_pago DATE,
      fecha_servicio DATE,
      fecha DATE,
      moneda VARCHAR(50),
      concepto TEXT,
      importe DECIMAL(10, 2),
      observacion TEXT,
      op VARCHAR(50),
      usuario_registro VARCHAR(255) NOT NULL,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createItemsTable = `
    CREATE TABLE IF NOT EXISTS pago_items (
      id SERIAL PRIMARY KEY,
      pago_id INTEGER NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
      concepto TEXT NOT NULL,
      importe DECIMAL(10, 2) NOT NULL,
      observacion TEXT
    );
  `;

  const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS session (
      sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    );
  `;

  const createIndexSessions = `
    CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
  `;

  try {
    await query(createPagosTable);
    console.log('✓ Tabla "pagos" creada o ya existe');

    await query(createItemsTable);
    console.log('✓ Tabla "pago_items" creada o ya existe');

    await query(createSessionsTable);
    console.log('✓ Tabla "session" creada o ya existe');

    await query(createIndexSessions);
    console.log('✓ Índice de sesiones creado');

    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('Error al inicializar tablas:', error);
    throw error;
  }
}

// Cerrar el pool
async function close() {
  await pool.end();
  console.log('Pool de conexiones cerrado');
}

module.exports = {
  query,
  getClient,
  initTables,
  close,
  pool
};
