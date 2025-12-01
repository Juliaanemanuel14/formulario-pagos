require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Resend } = require('resend');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Confiar en el proxy de Railway para HTTPS
app.set('trust proxy', 1);

// Usuarios autorizados (hardcoded)
const USERS = {
  'Lucas Ortiz': '7894',
  'Julian Salvatierra': '4226',
  'Matias Huss': '1994',
  'Giuli': '7531',
  'Lucia Molina': '9632'
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
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  },
  proxy: true
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Inicializar tablas al iniciar
db.initTables().catch(err => {
  console.error('Error al inicializar tablas:', err);
});

// Configuración de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Configurar Supabase Storage
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Configurar multer para manejar uploads en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
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
app.post('/api/pagos', requireAuth, upload.array('imagenes', 5), async (req, res) => {
  try {
    // Extraer datos del body
    let locales, proveedor, fechaPago, fechaServicio, moneda, concepto, importe, observacion;

    // Si hay archivos, los datos vienen como strings en req.body
    if (req.files && req.files.length > 0) {
      locales = JSON.parse(req.body.locales);
      proveedor = req.body.proveedor;
      fechaPago = req.body.fechaPago;
      fechaServicio = req.body.fechaServicio;
      moneda = req.body.moneda;
      concepto = req.body.concepto;
      importe = req.body.importe;
      observacion = req.body.observacion;
    } else {
      // Sin archivos, viene como JSON normal
      ({ locales, proveedor, fechaPago, fechaServicio, moneda, concepto, importe, observacion } = req.body);
    }

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

    // Array para almacenar URLs de imágenes subidas
    const imagenesUrls = [];

    // Subir imágenes a Supabase Storage si existen
    if (req.files && req.files.length > 0) {
      console.log(`Subiendo ${req.files.length} imágenes a Supabase Storage...`);

      for (const file of req.files) {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
        const filePath = `gastos/${fileName}`;

        const { data, error } = await supabase.storage
          .from(process.env.SUPABASE_STORAGE_BUCKET)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error('Error al subir imagen a Supabase:', error);
          continue; // Continuar con las demás imágenes
        }

        // Obtener URL pública
        const { data: publicData } = supabase.storage
          .from(process.env.SUPABASE_STORAGE_BUCKET)
          .getPublicUrl(filePath);

        imagenesUrls.push(publicData.publicUrl);
        console.log(`Imagen subida exitosamente: ${publicData.publicUrl}`);
      }

      console.log(`Total de imágenes subidas: ${imagenesUrls.length}`);
    }

    // Array para almacenar los IDs de pagos creados
    const pagoIds = [];

    // Insertar un pago para cada local (incluyendo imagenes)
    const insertPagoSQL = `
      INSERT INTO pagos (local, proveedor, fecha_pago, fecha_servicio, moneda, concepto, importe, observacion, usuario_registro, imagenes)
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
        imagenesUrls.length > 0 ? imagenesUrls : null  // Guardar array de URLs
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

    // Agregar imágenes al email si existen
    let imagenesHTML = '';
    if (imagenesUrls.length > 0) {
      imagenesHTML = `
        <h3 style="color: #4f46e5; margin-top: 30px; margin-bottom: 15px;">Imágenes Adjuntas</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-top: 16px;">
          ${imagenesUrls.map(url => `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <a href="${url}" target="_blank" style="display: block;">
                <img src="${url}" alt="Imagen del gasto" style="width: 100%; height: 200px; object-fit: cover; display: block;">
              </a>
            </div>
          `).join('')}
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

        ${imagenesHTML}

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

// Endpoint PATCH para actualizar el campo OP de un pago
app.patch('/api/pagos/:id/op', requireAuth, async (req, res) => {
  const pagoId = req.params.id;
  const { op } = req.body;
  const usuario = req.session.user.username;

  // Solo Julian Salvatierra y Giuli pueden actualizar el OP
  if (usuario !== 'Julian Salvatierra' && usuario !== 'Giuli') {
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
    await db.query(sql, [op || null, pagoId]);

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

// Endpoint DELETE para eliminar un pago (solo Julian Salvatierra)
app.delete('/api/pagos/:id', requireAuth, async (req, res) => {
  const pagoId = req.params.id;
  const usuario = req.session.user.username;

  // Solo Julian Salvatierra puede eliminar registros
  if (usuario !== 'Julian Salvatierra') {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para eliminar registros'
    });
  }

  try {
    // Verificar que el pago existe
    const checkSQL = 'SELECT id FROM pagos WHERE id = $1';
    const checkResult = await db.query(checkSQL, [pagoId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado'
      });
    }

    // Eliminar el pago (CASCADE eliminará automáticamente los items asociados)
    const deleteSQL = 'DELETE FROM pagos WHERE id = $1';
    await db.query(deleteSQL, [pagoId]);

    console.log(`Registro #${pagoId} eliminado por ${usuario}`);

    res.json({
      success: true,
      message: 'Registro eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el registro'
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
