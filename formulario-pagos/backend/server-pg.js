require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Resend } = require('resend');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const db = require('./db');
const supabaseStorage = require('./supabase-storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar multer para recibir archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo por archivo
    files: 5 // Máximo 5 archivos
  },
  fileFilter: (req, file, cb) => {
    if (supabaseStorage.isValidFileType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WEBP) y PDF.'));
    }
  }
});

// Usuarios autorizados (hardcoded)
const USERS = {
  'Lucas Ortiz': '7894',
  'Julian Salvatierra': '4226',
  'Matias Huss': '1994',
  'Giuli': '7531'
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

// Configuración de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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

// Endpoint POST para recibir datos del formulario con archivos
app.post('/api/pagos', requireAuth, upload.array('archivos', 5), async (req, res) => {
  try {
    let { locales, proveedor, fechaPago, fechaServicio, moneda, concepto, importe, observacion } = req.body;
    const usuario = req.session.user.username;
    const files = req.files || [];

    // Parsear locales si viene como string JSON
    if (typeof locales === 'string') {
      try {
        locales = JSON.parse(locales);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Formato de locales inválido'
        });
      }
    }

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

    // Subir archivos a Supabase Storage
    const archivosSubidos = [];
    if (files.length > 0) {
      console.log(`📎 Subiendo ${files.length} archivo(s) a Supabase...`);

      for (const file of files) {
        const uploadResult = await supabaseStorage.uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        if (uploadResult.success) {
          archivosSubidos.push({
            url: uploadResult.url,
            fileName: uploadResult.fileName,
            mimeType: uploadResult.mimeType,
            size: uploadResult.size
          });
          console.log(`✓ Archivo subido: ${uploadResult.fileName}`);
        } else {
          console.error(`✗ Error al subir ${file.originalname}:`, uploadResult.error);
        }
      }
    }

    // Array para almacenar los IDs de pagos creados
    const pagoIds = [];

    // Insertar un pago para cada local
    const insertPagoSQL = `
      INSERT INTO pagos (local, proveedor, fecha_pago, fecha_servicio, moneda, concepto, importe, observacion, usuario_registro, archivos_urls)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;

    for (const local of locales) {
      const result = await db.query(insertPagoSQL, [
        local,
        proveedor,
        fechaPago,
        fechaServicio,
        moneda,
        concepto,
        importePorLocal,
        observacion || '',
        usuario,
        JSON.stringify(archivosSubidos)
      ]);

      const pagoId = result.rows[0].id;
      pagoIds.push(pagoId);
      console.log(`Gasto registrado con ID: ${pagoId} para local ${local} por ${usuario}`);
    }

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

    // Generar asunto del email
    const asunto = `Presupuesto ${proveedor} - Periodo: ${mesServicio} ${añoServicio} - Local: ${locales.join(', ')}`;

    // Información de archivos adjuntos
    let archivosInfo = '';
    if (archivosSubidos.length > 0) {
      const archivosLinks = archivosSubidos.map((archivo, index) => {
        const icono = archivo.mimeType === 'application/pdf' ? '📄' : '🖼️';
        const sizeKB = (archivo.size / 1024).toFixed(2);
        return `<li style="margin: 8px 0;">
          <a href="${archivo.url}" target="_blank" style="color: #4f46e5; text-decoration: none;">
            ${icono} ${archivo.fileName} <span style="color: #6b7280; font-size: 12px;">(${sizeKB} KB)</span>
          </a>
        </li>`;
      }).join('');

      archivosInfo = `
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: 600;">
            📎 Archivos Adjuntos (${archivosSubidos.length}):
          </p>
          <ul style="margin: 0; padding-left: 20px; color: #1e40af;">
            ${archivosLinks}
          </ul>
        </div>
      `;
    }

    // Preparar HTML del email
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

        ${archivosInfo}

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

    // Enviar email usando Resend
    try {
      const { data, error } = await resend.emails.send({
        from: 'Formulario Pagos <onboarding@resend.dev>',
        to: ['gastosop10@gmail.com'],
        subject: asunto,
        html: htmlContent
      });

      if (error) {
        console.error('Error al enviar el email con Resend:', error);
        return res.status(200).json({
          success: true,
          message: 'Gasto registrado correctamente, pero hubo un error al enviar el email',
          pagoId: pagoIds[0],
          pagoIds: pagoIds,
          emailSent: false
        });
      }

      console.log('Email enviado con Resend:', data.id);
      res.status(201).json({
        success: true,
        message: 'Gasto registrado y email enviado correctamente',
        pagoId: pagoIds[0],
        pagoIds: pagoIds,
        emailSent: true
      });
    } catch (emailError) {
      console.error('Error al enviar email:', emailError);
      return res.status(200).json({
        success: true,
        message: 'Gasto registrado correctamente, pero hubo un error al enviar el email',
        pagoId: pagoIds[0],
        pagoIds: pagoIds,
        emailSent: false
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
  console.log(`Usando Resend para emails`);
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
