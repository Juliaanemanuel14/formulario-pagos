require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const brevo = require('@getbrevo/brevo');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// NOTA: Los usuarios ahora se almacenan en la tabla 'usuarios' de la BD
// con contraseñas hasheadas usando bcrypt para mayor seguridad

// Trust proxy - necesario para Railway
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesiones con PostgreSQL para persistencia
app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true en producción con HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
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

// Inicializar la base de datos automáticamente
db.initTables().then(() => {
  console.log('✅ Base de datos PostgreSQL inicializada correctamente\n');
}).catch(err => {
  console.error('❌ Error al inicializar la base de datos:', err);
});

// Configuración de Brevo para envío de emails con soporte CC/BCC
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

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
    const result = await db.query(
      'SELECT id, username, password_hash, rol, activo FROM usuarios WHERE username = $1',
      [username]
    );

    const user = result.rows[0];

    // Verificar si el usuario existe y está activo
    if (!user || user.activo !== true) {
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Verificar contraseña con bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (passwordMatch) {
      // Actualizar último acceso
      await db.query(
        'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1',
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
  const client = await db.getClient();

  try {
    const { locales, proveedor, fechaPago, fechaServicio, moneda, concepto, importe, observacion } = req.body;
    const usuario = req.session.user.username;

    // Validación de campos requeridos
    if (!locales || !Array.isArray(locales) || locales.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar al menos un local'
      });
    }

    if (!proveedor || !proveedor.trim()) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'El nombre del proveedor es requerido'
      });
    }

    if (!fechaPago || !fechaServicio) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Las fechas de pago y servicio son requeridas'
      });
    }

    if (!moneda || !moneda.trim()) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'La moneda es requerida'
      });
    }

    if (!concepto || !concepto.trim()) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'El concepto es requerido'
      });
    }

    const importeNum = parseFloat(importe);
    if (isNaN(importeNum) || importeNum <= 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'El importe debe ser un número válido mayor a 0'
      });
    }

    // Calcular importe por local (dividir el total entre el número de locales)
    const importePorLocal = importeNum / locales.length;

    // Array para almacenar los IDs de pagos creados
    const pagoIds = [];

    // Comenzar transacción
    await client.query('BEGIN');

    // SQL para insertar un pago para un local específico
    const insertPagoSQL = `
      INSERT INTO pagos (local, proveedor, fecha_pago, fecha_servicio, moneda, concepto, importe, observacion, usuario_registro)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    // Procesar cada local
    for (const local of locales) {
      const result = await client.query(insertPagoSQL, [
        local,
        proveedor,
        fechaPago,
        fechaServicio,
        moneda,
        concepto,
        importePorLocal,
        observacion || '',
        usuario
      ]);

      const pagoId = result.rows[0].id;
      pagoIds.push(pagoId);
      console.log(`Gasto registrado con ID: ${pagoId} para local ${local} por ${usuario}`);
    }

    // Confirmar transacción
    await client.query('COMMIT');

    // Función para enviar email de confirmación
    async function enviarEmailConfirmacion() {
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

      // Preparar lista de destinatarios con soporte CC/BCC usando Brevo
      const emailTo = process.env.EMAIL_TO;
      const emailCc = process.env.EMAIL_TO_CC
        ? process.env.EMAIL_TO_CC.split(',').map(email => email.trim()).filter(Boolean)
        : [];

      // Construir el contenido HTML del email
      const htmlContent = `
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
        `;

      // Preparar el objeto de email para Brevo con soporte CC/BCC
      const sendSmtpEmail = new brevo.SendSmtpEmail();

      // Usar el dominio de Brevo para evitar problemas de DKIM/DMARC con Gmail
      sendSmtpEmail.sender = { name: 'Registro de Pagos', email: 'noreply@desarrollogastro.com' };
      sendSmtpEmail.to = [{ email: emailTo }];

      // Agregar destinatarios CC si existen
      if (emailCc.length > 0) {
        sendSmtpEmail.cc = emailCc.map(email => ({ email }));
      }

      sendSmtpEmail.subject = asunto;
      sendSmtpEmail.htmlContent = htmlContent;

      // Enviar email con Brevo (soporta CC/BCC)
      try {
        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

        console.log('✓ Email enviado exitosamente con Brevo');
        console.log('  → Respuesta completa:', JSON.stringify(result, null, 2));
        console.log('  → Destinatario principal:', emailTo);
        if (emailCc.length > 0) {
          console.log('  → CC:', emailCc.join(', '));
        }

        res.status(201).json({
          success: true,
          message: 'Gasto registrado y email enviado correctamente',
          pagoId: pagoIds[0],
          pagoIds: pagoIds,
          emailSent: true
        });
      } catch (error) {
        console.error('✗ Error al enviar el email con Brevo:');
        console.error('  → Error completo:', JSON.stringify(error, null, 2));
        console.error('  → Mensaje:', error.message);
        console.error('  → Response:', error.response?.body);
        res.status(200).json({
          success: true,
          message: 'Gasto registrado correctamente, pero hubo un error al enviar el email',
          pagoId: pagoIds[0],
          pagoIds: pagoIds,
          emailSent: false,
          emailError: error.message
        });
      }
    }

    // Enviar email de confirmación
    await enviarEmailConfirmacion();

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

// Endpoint GET para obtener todos los pagos
app.get('/api/pagos', requireAuth, async (req, res) => {
  try {
    const sql = 'SELECT * FROM pagos ORDER BY fecha_registro DESC';
    const result = await db.query(sql);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los datos'
    });
  }
});

// Endpoint PATCH para actualizar el campo OP de un pago
app.patch('/api/pagos/:id/op', requireAuth, async (req, res) => {
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

  try {
    const sql = 'UPDATE pagos SET op = $1 WHERE id = $2';
    const result = await db.query(sql, [op || null, pagoId]);

    if (result.rowCount === 0) {
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
  } catch (error) {
    console.error('Error al actualizar OP:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el campo OP'
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

// Health check para Railway
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

// Cerrar la base de datos cuando se cierre el servidor
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
