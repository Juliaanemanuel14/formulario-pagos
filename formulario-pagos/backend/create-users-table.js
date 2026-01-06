const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'pagos.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
    process.exit(1);
  }
  console.log('Conectado a la base de datos SQLite.\n');
});

console.log('🔐 Creando tabla de usuarios con seguridad bcrypt...\n');

// Crear tabla de usuarios
const createUsersTableSQL = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    rol TEXT DEFAULT 'usuario',
    activo INTEGER DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso DATETIME
  )
`;

db.run(createUsersTableSQL, async (err) => {
  if (err) {
    console.error('❌ Error al crear la tabla usuarios:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('✓ Tabla "usuarios" creada exitosamente\n');

  // Migrar usuarios hardcoded
  const usuariosIniciales = [
    { username: 'Lucas Ortiz', password: '7894', email: 'lucas@example.com', rol: 'usuario' },
    { username: 'Julian Salvatierra', password: '4226', email: 'julian@example.com', rol: 'admin' },
    { username: 'Matias Huss', password: '1994', email: 'matias@example.com', rol: 'usuario' },
    { username: 'Lucia Molina', password: '6462', email: 'lucia@example.com', rol: 'usuario' }
  ];

  console.log('📝 Migrando usuarios existentes...\n');

  const saltRounds = 10;

  for (const user of usuariosIniciales) {
    try {
      const passwordHash = await bcrypt.hash(user.password, saltRounds);

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT OR IGNORE INTO usuarios (username, password_hash, email, rol) VALUES (?, ?, ?, ?)',
          [user.username, passwordHash, user.email, user.rol],
          function(err) {
            if (err) reject(err);
            else resolve(this);
          }
        );
      });

      console.log(`✓ Usuario "${user.username}" migrado`);
    } catch (error) {
      console.error(`❌ Error al migrar "${user.username}":`, error.message);
    }
  }

  console.log('\n✅ Migración completada\n');

  // Verificar usuarios creados
  db.all('SELECT id, username, email, rol, activo FROM usuarios', (err, rows) => {
    if (err) {
      console.error('Error al consultar usuarios:', err.message);
    } else {
      console.log('👥 Usuarios en la base de datos:');
      console.table(rows);

      console.log('\n⚠️  IMPORTANTE:');
      console.log('1. Las contraseñas actuales son débiles (4 dígitos)');
      console.log('2. Los usuarios deben cambiarlas por contraseñas seguras');
      console.log('3. Se recomienda mínimo 8 caracteres, mayúsculas, minúsculas y números\n');
      console.log('📋 Para usar esta nueva tabla, actualiza server.js para consultar usuarios de la BD\n');
    }

    db.close();
  });
});
