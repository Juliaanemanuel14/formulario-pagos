require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// NOTA: Los usuarios ahora se almacenan en la tabla 'usuarios' de la BD
// con contraseñas hasheadas usando bcrypt para mayor seguridad

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesiones con SQLite para persistencia
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname)
  }),
  secret: process.env.SESSION_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true en producción con HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting para login - máximo 5 intentos por 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // límite de 5 solicitudes por ventana
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión. Por favor, intente de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Conexión a la base de datos
const dbPath = path.join(__dirname, 'pagos.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite.');
  }
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

// Endpoint de login con rate limiting
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Usuario y contraseña son requeridos'
    });
  }

  try {
    // Buscar usuario en la base de datos
    db.get(
      'SELECT id, username, password_hash, rol, activo FROM usuarios WHERE username = ?',
      [username],
      async (err, user) => {
        if (err) {
          console.error('Error al buscar usuario:', err.message);
          return res.status(500).json({
            success: false,
            message: 'Error en el servidor'
          });
        }

        // Verificar si el usuario existe y está activo
        if (!user || user.activo !== 1) {
          return res.status(401).json({
            success: false,
            message: 'Usuario o contraseña incorrectos'
          });
        }

        // Verificar contraseña con bcrypt
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (passwordMatch) {
          // Actualizar último acceso
          db.run(
            'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
          );

          // Crear sesión
          req.session.user = {
            id: user.id,
            username: user.username,
            rol: user.rol,
            loginTime: new Date()
          };

          res.json({
            success: true,
            message: 'Login exitoso',
            user: {
              username: user.username,
              rol: user.rol
            }
          });
        } else {
          res.status(401).json({
            success: false,
            message: 'Usuario o contraseña incorrectos'
          });
        }
      }
    );
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
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
  try {
    const { locales, proveedor, fechaPago, fechaServicio, moneda, concepto, importe, observacion } = req.body;
    const usuario = req.session.user.username;

    // Validación de campos requeridos
    if (!locales || !Array.isArray(locales) || locales.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar al menos un local'
      });
    }

    if (!proveedor || !proveedor.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del proveedor es requerido'
      });
    }

    if (!fechaPago || !fechaServicio) {
      return res.status(400).json({
        success: false,
        message: 'Las fechas de pago y servicio son requeridas'
      });
    }

    if (!moneda || !moneda.trim()) {
      return res.status(400).json({
        success: false,
        message: 'La moneda es requerida'
      });
    }

    if (!concepto || !concepto.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El concepto es requerido'
      });
    }

    const importeNum = parseFloat(importe);
    if (isNaN(importeNum) || importeNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El importe debe ser un número válido mayor a 0'
      });
    }

    // Calcular importe por local (dividir el total entre el número de locales)
    const importePorLocal = importeNum / locales.length;

    // Array para almacenar los IDs de pagos creados
    const pagoIds = [];
    let localesProcessed = 0;

    // Función para insertar un pago para un local específico
    const insertPagoSQL = `
      INSERT INTO pagos (local, proveedor, fecha_pago, fecha_servicio, moneda, concepto, importe, observacion, usuario_registro)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Procesar cada local
    locales.forEach((local) => {
      db.run(insertPagoSQL, [local, proveedor, fechaPago, fechaServicio, moneda, concepto, importePorLocal, observacion || '', usuario], function(err) {
        if (err) {
          console.error(`Error al insertar pago para ${local}:`, err.message);
          if (localesProcessed === 0) {
            return res.status(500).json({
              success: false,
              message: 'Error al guardar el pago en la base de datos'
            });
          }
          return;
        }

        const pagoId = this.lastID;
        pagoIds.push(pagoId);
        console.log(`Gasto registrado con ID: ${pagoId} para local ${local} por ${usuario}`);

        localesProcessed++;

        // Cuando todos los locales se procesaron, enviar email
        if (localesProcessed === locales.length) {
          enviarEmailConfirmacion();
        }
      });
    });

    // Función para enviar email de confirmación
    function enviarEmailConfirmacion() {
      // Obtener mes y año de fecha_servicio
      const fechaServicioDate = new Date(fechaServicio + 'T00:00:00');
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const mesServicio = meses[fechaServicioDate.getMonth()];
      const añoServicio = fechaServicioDate.getFullYear();

      // Información sobre división por locales
      let localesInfo = '';
      if (locales.length > 1) {
        localesInfo = `
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-weight: 600;">
              ℹ️ Este gasto se dividió entre ${locales.length} locales:
            </p>
            <p style="margin: 8px 0 0 0; color: #92400e;">
              ${locales.join(', ')}
            </p>
            <p style="margin: 8px 0 0 0; color: #92400e;">
              Importe por local: <strong>$${importePorLocal.toFixed(2)}</strong>
            </p>
          </div>
        `;
      }

      // Generar asunto del email: Presupuesto "proveedor" - Periodo: "Mes Año" - Local: "locales"
      const asunto = `Presupuesto ${proveedor} - Periodo: ${mesServicio} ${añoServicio} - Local: ${locales.join(', ')}`;

      // Preparar lista de destinatarios
      const destinatarios = [process.env.EMAIL_TO, process.env.EMAIL_TO_CC].filter(Boolean).join(', ');

      // Enviar email
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: destinatarios,
        subject: asunto,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
            <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">
              Nueva Solicitud de Gastos
            </h2>

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr style="background-color: #f9fafb;">
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; width: 150px;">IDs:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">#${pagoIds.join(', #')}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Local(es):</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${locales.join(', ')}</td>
              </tr>
              <tr style="background-color: #f9fafb;">
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Proveedor:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${proveedor}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Fecha Pago:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${fechaPago}</td>
              </tr>
              <tr style="background-color: #f9fafb;">
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Fecha Servicio:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${fechaServicio}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Moneda:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${moneda}</td>
              </tr>
              <tr style="background-color: #f9fafb;">
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Registrado por:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; color: #4f46e5; font-weight: bold;">${usuario}</td>
              </tr>
            </table>

            ${localesInfo}

            <h3 style="color: #4f46e5; margin-top: 30px; margin-bottom: 15px;">Detalles del Gasto</h3>

            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background-color: #f9fafb;">
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; width: 150px;">Concepto:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${concepto}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Importe Total:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; color: #10b981; font-weight: 600; font-size: 18px;">$${importeNum.toFixed(2)}</td>
              </tr>
              ${locales.length > 1 ? `
              <tr style="background-color: #f9fafb;">
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Por Local:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">$${importePorLocal.toFixed(2)}</td>
              </tr>` : ''}
              ${observacion ? `
              <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Observación:</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${observacion}</td>
              </tr>` : ''}
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
            pagoId: pagoIds[0],
            pagoIds: pagoIds,
            emailSent: false
          });
        }

        console.log('Email enviado:', info.messageId);
        res.status(201).json({
          success: true,
          message: 'Gasto registrado y email enviado correctamente',
          pagoId: pagoIds[0],
          pagoIds: pagoIds,
          emailSent: true
        });
      });
    }

  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Endpoint GET para obtener todos los pagos
app.get('/api/pagos', requireAuth, (req, res) => {
  const sql = 'SELECT * FROM pagos ORDER BY fecha_registro DESC';

  db.all(sql, [], (err, pagos) => {
    if (err) {
      console.error('Error al consultar la base de datos:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener los datos'
      });
    }

    res.json({
      success: true,
      data: pagos
    });
  });
});

// Endpoint PATCH para actualizar el campo OP de un pago
app.patch('/api/pagos/:id/op', requireAuth, (req, res) => {
  const pagoId = req.params.id;
  const { op } = req.body;
  const usuario = req.session.user.username;

  // Solo Julian Salvatierra puede actualizar el OP
  if (usuario !== 'Julian Salvatierra') {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para actualizar este campo'
    });
  }

  // Validar que op sea un número o vacío
  if (op && !/^\d+$/.test(op.trim())) {
    return res.status(400).json({
      success: false,
      message: 'El campo OP debe contener solo números'
    });
  }

  const sql = 'UPDATE pagos SET op = ? WHERE id = ?';

  db.run(sql, [op || null, pagoId], function(err) {
    if (err) {
      console.error('Error al actualizar OP:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar el campo OP'
      });
    }

    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }

    console.log(`Campo OP actualizado para pago #${pagoId} por ${usuario}: ${op || 'vacío'}`);

    res.json({
      success: true,
      message: 'Campo OP actualizado correctamente'
    });
  });
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
  console.log(`Para inicializar la base de datos, ejecuta: npm run init-db`);
});

// Cerrar la base de datos cuando se cierre el servidor
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Conexión a la base de datos cerrada.');
    process.exit(0);
  });
});
