# Sistema de Registro de Pagos

Aplicación web completa para el registro y seguimiento de pagos con múltiples items, autenticación de usuarios, notificaciones por email y listo para producción en Google Cloud.

## Características

### Frontend
- Formulario HTML5 responsive y moderno
- Validación de campos en tiempo real
- Diseño adaptable para móviles y escritorio
- Mensajes de confirmación y error
- Interfaz intuitiva y profesional

### Backend
- API REST con Node.js y Express
- Base de datos SQLite para persistencia
- Envío automático de emails con Nodemailer
- Manejo robusto de errores
- CORS habilitado para desarrollo

### Base de Datos
- SQLite con tabla de pagos
- Campos: ID, local, fecha, proveedor, forma de pago, importe, observación, fecha de registro
- Script de inicialización automática

## Estructura del Proyecto

```
formulario-pagos/
├── backend/
│   ├── server.js           # Servidor Express y API REST
│   ├── init-db.js          # Script de inicialización de BD
│   └── pagos.db            # Base de datos (se crea automáticamente)
├── frontend/
│   ├── index.html          # Formulario principal
│   ├── styles.css          # Estilos responsive
│   └── script.js           # Validación y envío de datos
├── .env                    # Configuración de email (crear manualmente)
├── .env.example            # Plantilla de configuración
├── .gitignore              # Archivos ignorados por Git
├── package.json            # Dependencias del proyecto
└── README.md               # Este archivo
```

## Requisitos Previos

- Node.js (versión 14 o superior)
- npm (incluido con Node.js)
- Cuenta de email para envío de notificaciones (recomendado: Gmail)

## Instalación

### 1. Clonar o descargar el proyecto

Si tienes el proyecto en una carpeta, navega hasta ella:

```bash
cd formulario-pagos
```

### 2. Instalar dependencias

```bash
npm install
```

Esto instalará:
- express (servidor web)
- sqlite3 (base de datos)
- nodemailer (envío de emails)
- dotenv (variables de entorno)
- cors (manejo de CORS)
- nodemon (desarrollo - opcional)

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y edítalo con tus credenciales:

```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

Edita el archivo `.env` con tus datos:

```env
PORT=3000

# Configuración de Email SMTP
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu-email@gmail.com
EMAIL_PASSWORD=tu-contraseña-de-aplicacion
EMAIL_FROM=tu-email@gmail.com
EMAIL_TO=destinatario@example.com
```

#### Configurar Gmail (recomendado)

1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Navega a **Seguridad** → **Verificación en 2 pasos** (actívala si no lo está)
3. Luego ve a **Contraseñas de aplicaciones**
4. Genera una nueva contraseña para "Correo"
5. Usa esa contraseña en `EMAIL_PASSWORD` (no tu contraseña normal)

#### Otros proveedores de email

- **Outlook/Hotmail**: `smtp.office365.com`, puerto 587
- **Yahoo**: `smtp.mail.yahoo.com`, puerto 587
- **Otros**: Consulta la documentación SMTP de tu proveedor

### 4. Inicializar la base de datos

```bash
npm run init-db
```

Verás el mensaje: "Base de datos inicializada correctamente."

### 5. Iniciar el servidor

```bash
npm start
```

O para desarrollo con auto-reinicio:

```bash
npm run dev
```

Verás:
```
Servidor ejecutándose en http://localhost:3000
Conectado a la base de datos SQLite.
```

### 6. Abrir la aplicación

Abre tu navegador y ve a: http://localhost:3000

## Uso

### Registrar un Pago

1. Completa el formulario con los datos requeridos:
   - **Local**: Nombre del local o sucursal
   - **Fecha**: Fecha del pago (no puede ser futura)
   - **Proveedor**: Nombre del proveedor
   - **Forma de Pago**: Selecciona entre Efectivo, Transferencia, Cheque o Tarjeta
   - **Importe**: Cantidad del pago (debe ser mayor a 0)
   - **Observación**: Notas adicionales (opcional)

2. Haz clic en **Aceptar**

3. El sistema:
   - Validará los datos
   - Guardará el registro en la base de datos
   - Enviará un email de notificación
   - Mostrará un mensaje de confirmación

4. Puedes registrar otro pago haciendo clic en **Registrar otro pago**

### Validaciones

El formulario valida:
- Todos los campos requeridos estén completos
- El importe sea un número válido mayor a 0
- La fecha no sea futura
- Los datos tengan el formato correcto

Las validaciones se muestran en tiempo real al completar cada campo.

### Notificaciones por Email

Cada vez que se registra un pago, se envía un email con:
- ID del registro
- Todos los datos del pago
- Fecha y hora del registro
- Formato HTML profesional

## API Endpoints

### POST /api/pagos

Registra un nuevo pago.

**Request Body:**
```json
{
  "local": "Sucursal Centro",
  "fecha": "2025-11-12",
  "proveedor": "Proveedor XYZ",
  "forma_pago": "Transferencia",
  "importe": 15000.50,
  "observacion": "Pago mensual"
}
```

**Response (éxito):**
```json
{
  "success": true,
  "message": "Pago registrado y email enviado correctamente",
  "pagoId": 1,
  "emailSent": true
}
```

**Response (error):**
```json
{
  "success": false,
  "message": "Descripción del error"
}
```

### GET /api/pagos

Obtiene todos los pagos registrados (ordenados por fecha más reciente).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "local": "Sucursal Centro",
      "fecha": "2025-11-12",
      "proveedor": "Proveedor XYZ",
      "forma_pago": "Transferencia",
      "importe": 15000.5,
      "observacion": "Pago mensual",
      "fecha_registro": "2025-11-12 14:30:00"
    }
  ]
}
```

## Scripts Disponibles

- `npm start` - Inicia el servidor en modo producción
- `npm run dev` - Inicia el servidor en modo desarrollo con auto-reinicio
- `npm run init-db` - Inicializa/reinicializa la base de datos

## Solución de Problemas

### El servidor no inicia

- Verifica que el puerto 3000 no esté en uso
- Puedes cambiar el puerto en el archivo `.env`
- Asegúrate de haber ejecutado `npm install`

### No se envían emails

- Verifica las credenciales en el archivo `.env`
- Para Gmail, usa una contraseña de aplicación, no tu contraseña normal
- Verifica que la verificación en 2 pasos esté activada (Gmail)
- Revisa los logs del servidor para ver errores específicos
- El pago se guardará aunque falle el email

### Error de base de datos

- Ejecuta `npm run init-db` para reinicializar la base de datos
- Verifica que tengas permisos de escritura en la carpeta `backend/`
- Elimina el archivo `backend/pagos.db` y vuelve a ejecutar `npm run init-db`

### Problemas de CORS

- El servidor ya tiene CORS habilitado
- Si usas un dominio diferente, modifica la configuración CORS en `backend/server.js`

## Tecnologías Utilizadas

- **Frontend**:
  - HTML5
  - CSS3 (con variables CSS y Flexbox)
  - JavaScript ES6+ (Vanilla JS)
  - Fetch API para peticiones HTTP

- **Backend**:
  - Node.js
  - Express.js
  - SQLite3
  - Nodemailer
  - dotenv

## Mejoras Futuras

Posibles mejoras a implementar:
- Autenticación de usuarios
- Dashboard con estadísticas
- Exportación de datos a Excel/PDF
- Búsqueda y filtrado de pagos
- Edición y eliminación de registros
- Subida de comprobantes (imágenes/PDFs)
- Gráficos de pagos por período
- API para integración con otros sistemas

## Seguridad

- Las credenciales se almacenan en `.env` (no subir a Git)
- Se incluye `.gitignore` para proteger datos sensibles
- Validación de datos en frontend y backend
- Uso de HTTPS en producción (recomendado)
- Sanitización de inputs para prevenir inyecciones SQL

## Despliegue en Producción (Google Cloud)

### ☁️ Levantar en la nube 24/7

Esta aplicación está lista para desplegarse en **Google Cloud Run** con base de datos PostgreSQL.

📖 **[Ver Guía Completa de Despliegue (DEPLOY.md)](./DEPLOY.md)**

### Resumen rápido

1. **Requisitos**:
   - Cuenta de Google Cloud (con $300 USD de créditos gratis)
   - Google Cloud SDK instalado

2. **Costos estimados**: ~$15-50/mes
   - Cloud Run: $5-20/mes (pago por uso, escala a cero)
   - Cloud SQL (PostgreSQL): $10-30/mes

3. **Pasos básicos**:
   ```bash
   # Instalar Google Cloud SDK
   # https://cloud.google.com/sdk/docs/install

   # Autenticar
   gcloud auth login

   # Ejecutar script de despliegue
   bash deploy.sh
   ```

4. **Obtendrás una URL pública** como:
   ```
   https://formulario-pagos-xxxxx.run.app
   ```

### Ventajas de Cloud Run

- ✅ Escalado automático (de 0 a miles de instancias)
- ✅ Pago solo por uso real (escala a cero cuando no hay tráfico)
- ✅ HTTPS automático con certificado SSL
- ✅ Alta disponibilidad (99.95% uptime)
- ✅ Backups automáticos de base de datos
- ✅ Monitoreo y logs integrados

### Archivos para producción

- `backend/server-pg.js` - Servidor con PostgreSQL
- `backend/db.js` - Módulo de conexión a PostgreSQL
- `Dockerfile` - Configuración de contenedor
- `.env.production.example` - Variables de entorno
- `deploy.sh` - Script automatizado de despliegue
- `DEPLOY.md` - Guía paso a paso completa

## Licencia

ISC

## Soporte

Para problemas o preguntas:
1. Revisa la sección de "Solución de Problemas"
2. Para despliegue en la nube: Ver [DEPLOY.md](./DEPLOY.md)
3. Verifica los logs del servidor
4. Asegúrate de seguir todos los pasos de instalación

---

**¡Listo para usar localmente o en producción!** Tu aplicación está preparada para funcionar en desarrollo con SQLite o en producción con PostgreSQL en Google Cloud.
