const { Pool } = require('pg');

// Configuración de la base de datos
// Railway proporciona DATABASE_URL automáticamente
let pool;

if (process.env.DATABASE_URL) {
  // Railway u otro servicio que proporciona DATABASE_URL
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  console.log('📦 Conectado a PostgreSQL via DATABASE_URL');
} else {
  // Desarrollo local (fallback a variables individuales)
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'pagos_db',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    max: 5,
  });
  console.log('📦 Conectado a PostgreSQL local');
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
  const bcrypt = require('bcrypt');

  // Tabla de pagos con todos los campos necesarios
  const createPagosTable = `
    CREATE TABLE IF NOT EXISTS pagos (
      id SERIAL PRIMARY KEY,
      local VARCHAR(255) NOT NULL,
      proveedor VARCHAR(255) NOT NULL,
      fecha_pago DATE NOT NULL,
      fecha_servicio DATE NOT NULL,
      moneda VARCHAR(10) NOT NULL,
      concepto TEXT,
      importe DECIMAL(10, 2),
      observacion TEXT,
      op VARCHAR(255),
      usuario_registro VARCHAR(255) NOT NULL,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Tabla de usuarios con bcrypt
  const createUsuariosTable = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      rol VARCHAR(50) DEFAULT 'usuario',
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ultimo_acceso TIMESTAMP
    );
  `;

  // Tabla de sesiones
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

    await query(createUsuariosTable);
    console.log('✓ Tabla "usuarios" creada o ya existe');

    await query(createSessionsTable);
    console.log('✓ Tabla "session" creada o ya existe');

    await query(createIndexSessions);
    console.log('✓ Índice de sesiones creado');

    // Verificar si existen usuarios
    const checkUsers = await query('SELECT COUNT(*) as count FROM usuarios');
    const userCount = parseInt(checkUsers.rows[0].count);

    if (userCount === 0) {
      console.log('📝 Creando usuarios iniciales...');

      const usuariosIniciales = [
        { username: 'Lucas Ortiz', password: '7894', email: 'lucas@example.com', rol: 'usuario' },
        { username: 'Julian Salvatierra', password: '4226', email: 'julian@example.com', rol: 'admin' },
        { username: 'Matias Huss', password: '1994', email: 'matias@example.com', rol: 'usuario' },
        { username: 'Lucia Molina', password: '6462', email: 'lucia@example.com', rol: 'usuario' }
      ];

      for (const user of usuariosIniciales) {
        const passwordHash = await bcrypt.hash(user.password, 10);
        await query(
          'INSERT INTO usuarios (username, password_hash, email, rol) VALUES ($1, $2, $3, $4)',
          [user.username, passwordHash, user.email, user.rol]
        );
        console.log(`  ✓ Usuario "${user.username}" creado`);
      }

      console.log('✅ Usuarios iniciales creados');
    } else {
      console.log(`✓ Ya existen ${userCount} usuarios en la base de datos`);
    }

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
