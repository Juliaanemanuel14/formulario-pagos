require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Usuarios autorizados (hardcoded)
const USERS = {
  'Lucas Ortiz': '7894',
  'Julian Salvatierra': '4226',
  'Matias Huss': '1994'
};

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesiones con PostgreSQL
app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Inicializar tablas al iniciar
db.initTables().catch(err => {
  console.error('Error al inicializar tablas:', err);
});

// Configuración de nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Middleware de autenticación
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: 'No autorizado. Por favor, inicie sesión.'
    });
  }
};

// ===== ENDPOINTS DE AUTENTICACIÓN =====

// Endpoint de login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Usuario y contraseña son requeridos'
    });
  }

  // Verificar credenciales
  if (USERS[username] && USERS[username] === password) {
    // Crear sesión
    req.session.user = {
      username: username,
      loginTime: new Date()
    };

    res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        username: username
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Usuario o contraseña incorrectos'
    });
  }
});

// Endpoint de logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión'
      });
    }

    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  });
});

// Endpoint para verificar autenticación
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      authenticated: true,
      user: {
        username: req.session.user.username
      }
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

// ===== ENDPOINTS DE PAGOS (PROTEGIDOS) =====

// Endpoint POST para recibir datos del formulario
app.post('/api/pagos', requireAuth, async (req, res) => {
  const client = await db.getClient();

  try {
    const { local, fecha, items } = req.body;
    const usuario = req.session.user.username;

    // Validación de campos requeridos
    if (!local || !fecha || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Local, fecha y al menos un item son requeridos'
      });
    }

    // Validar items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.concepto || !item.importe) {
        return res.status(400).json({
          success: false,
          message: `El item ${i + 1} debe tener concepto e importe`
        });
      }

      const importeNum = parseFloat(item.importe);
      if (isNaN(importeNum) || importeNum <= 0) {
        return res.status(400).json({
          success: false,
          message: `El importe del item ${i + 1} debe ser un número válido mayor a 0`
        });
      }
    }

    // Comenzar transacción
    await client.query('BEGIN');

    // Insertar pago principal
    const insertPagoSQL = `
      INSERT INTO pagos (local, fecha, usuario_registro)
      VALUES ($1, $2, $3)
      RETURNING id
    `;

    const pagoResult = await client.query(insertPagoSQL, [local, fecha, usuario]);
    const pagoId = pagoResult.rows[0].id;

    console.log(`Gasto registrado con ID: ${pagoId} por ${usuario}`);

    // Insertar items del pago
    const insertItemSQL = `
      INSERT INTO pago_items (pago_id, concepto, importe, observacion)
      VALUES ($1, $2, $3, $4)
    `;

    let totalImporte = 0;
    for (const item of items) {
      const importeNum = parseFloat(item.importe);
      totalImporte += importeNum;

      await client.query(insertItemSQL, [
        pagoId,
        item.concepto,
        importeNum,
        item.observacion || ''
      ]);
    }

    // Confirmar transacción
    await client.query('COMMIT');

    // Generar tabla HTML de items para el email
    let itemsTableHTML = '';
    items.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? '#f9fafb' : '#ffffff';
      itemsTableHTML += `
        <tr style="background-color: ${bgColor};">
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${item.concepto}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #10b981; font-weight: 600; text-align: right;">$${parseFloat(item.importe).toFixed(2)}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${item.observacion || '-'}</td>
        </tr>
      `;
    });

    // Enviar email
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: `Nueva Solicitud de Gastos - ${local}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">
            Nueva Solicitud de Gastos
          </h2>

          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr style="background-color: #f9fafb;">
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; width: 150px;">ID:</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">#${pagoId}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Local:</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${local}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Fecha:</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${fecha}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Registrado por:</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; color: #4f46e5; font-weight: bold;">${usuario}</td>
            </tr>
          </table>

          <h3 style="color: #4f46e5; margin-top: 30px; margin-bottom: 15px;">Items del Gasto</h3>

          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #4f46e5; color: white;">
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Concepto</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">Importe</th>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Observación</th>
              </tr>
            </thead>
            <tbody>
              ${itemsTableHTML}
            </tbody>
            <tfoot>
              <tr style="background-color: #f3f4f6; font-weight: bold;">
                <td style="padding: 12px; border: 1px solid #e5e7eb;">TOTAL</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; color: #10b981; font-size: 18px; text-align: right;">$${totalImporte.toFixed(2)}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;"></td>
              </tr>
            </tfoot>
          </table>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            <em>Registro generado automáticamente el ${new Date().toLocaleString('es-ES')}</em>
          </p>
        </div>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error al enviar el email:', error);
        return res.status(200).json({
          success: true,
          message: 'Gasto registrado correctamente, pero hubo un error al enviar el email',
          pagoId: pagoId,
          emailSent: false
        });
      }

      console.log('Email enviado:', info.messageId);
      res.status(201).json({
        success: true,
        message: 'Gasto registrado y email enviado correctamente',
        pagoId: pagoId,
        emailSent: true
      });
    });

  } catch (error) {
    // Rollback en caso de error
    await client.query('ROLLBACK');
    console.error('Error en el servidor:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  } finally {
    client.release();
  }
});

// Endpoint GET para obtener todos los pagos con sus items
app.get('/api/pagos', requireAuth, async (req, res) => {
  try {
    const pagosSQL = 'SELECT * FROM pagos ORDER BY fecha_registro DESC';
    const pagosResult = await db.query(pagosSQL);

    if (pagosResult.rows.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Obtener items para cada pago
    const pagosConItems = await Promise.all(
      pagosResult.rows.map(async (pago) => {
        const itemsSQL = 'SELECT * FROM pago_items WHERE pago_id = $1 ORDER BY id';
        const itemsResult = await db.query(itemsSQL, [pago.id]);

        return {
          ...pago,
          items: itemsResult.rows
        };
      })
    );

    res.json({
      success: true,
      data: pagosConItems
    });
  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los datos'
    });
  }
});

// ===== RUTAS DE FRONTEND =====

// Ruta de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Ruta de historial (requiere autenticación)
app.get('/historial', (req, res) => {
  if (req.session && req.session.user) {
    res.sendFile(path.join(__dirname, '../frontend/historial.html'));
  } else {
    res.redirect('/login');
  }
});

// Ruta principal (requiere autenticación)
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    res.redirect('/login');
  }
});

// Health check para Cloud Run
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Algo salió mal en el servidor'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});

// Cerrar conexiones al cerrar el servidor
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido, cerrando conexiones...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT recibido, cerrando conexiones...');
  await db.close();
  process.exit(0);
});
