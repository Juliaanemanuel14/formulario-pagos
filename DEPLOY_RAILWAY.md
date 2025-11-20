# 🚀 Guía de Despliegue en Railway

Esta guía te llevará paso a paso para desplegar tu aplicación de registro de pagos en Railway.

---

## 📋 Requisitos Previos

- [x] Cuenta en [Railway.app](https://railway.app) (gratuita)
- [x] Cuenta en [GitHub](https://github.com)
- [x] Git instalado en tu computadora
- [x] Aplicación funcionando localmente

---

## 🔧 Paso 1: Preparar el Repositorio de GitHub

### 1.1 Crear un Nuevo Repositorio

1. Ve a [GitHub](https://github.com) e inicia sesión
2. Haz clic en el botón **"New"** o **"+"** > **"New repository"**
3. Configura el repositorio:
   - **Nombre**: `formulario-pagos` (o el que prefieras)
   - **Descripción**: "Sistema de registro de pagos con autenticación"
   - **Visibilidad**: **Private** (recomendado para aplicaciones empresariales)
   - **NO** marques "Initialize with README" (ya tienes archivos)
4. Haz clic en **"Create repository"**

### 1.2 Conectar tu Proyecto Local con GitHub

Abre Git Bash o terminal en la carpeta de tu proyecto y ejecuta:

```bash
# Inicializar git si no está inicializado
git init

# Agregar el remote de GitHub (reemplaza TU-USUARIO con tu usuario de GitHub)
git remote add origin https://github.com/TU-USUARIO/formulario-pagos.git

# Verificar que el remote se agregó correctamente
git remote -v

# Agregar todos los archivos al staging (excepto los que están en .gitignore)
git add .

# Crear el primer commit
git commit -m "Initial commit - Sistema de registro de pagos con seguridad bcrypt"

# Subir al repositorio (si tu rama principal es 'main')
git push -u origin main

# Si tu rama es 'master', usa:
# git push -u origin master
```

### 1.3 Verificar que se Subió Correctamente

- Actualiza la página de tu repositorio en GitHub
- Deberías ver todos tus archivos EXCEPTO:
  - `.env` (protegido por .gitignore)
  - `backend/*.db` (bases de datos locales)
  - `node_modules/` (dependencias)

---

## 🛤️ Paso 2: Crear Proyecto en Railway

### 2.1 Registrarse e Iniciar Sesión

1. Ve a [railway.app](https://railway.app)
2. Haz clic en **"Login"** o **"Start a New Project"**
3. **Recomendado**: Inicia sesión con tu cuenta de GitHub (facilita la integración)

### 2.2 Crear Nuevo Proyecto

1. En el dashboard de Railway, haz clic en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Si es la primera vez:
   - Railway te pedirá permisos para acceder a tus repositorios
   - Haz clic en **"Configure GitHub App"**
   - Selecciona si quieres dar acceso a **todos los repositorios** o **solo repositorios seleccionados**
   - Si eliges repositorios seleccionados, marca `formulario-pagos`
   - Guarda los cambios
4. Selecciona el repositorio **`formulario-pagos`**
5. Railway comenzará a detectar tu proyecto automáticamente

---

## ⚙️ Paso 3: Configurar Variables de Entorno

**MUY IMPORTANTE**: Railway necesita las mismas variables de entorno que tienes en tu `.env` local.

### 3.1 Acceder a las Variables de Entorno

1. En tu proyecto de Railway, haz clic en tu servicio (debería aparecer como `formulario-pagos`)
2. Ve a la pestaña **"Variables"**
3. Haz clic en **"Raw Editor"** (más fácil para copiar múltiples variables)

### 3.2 Agregar las Variables

Copia y pega el siguiente contenido en el editor, **reemplazando los valores** con los de tu archivo `.env`:

```env
NODE_ENV=production
SESSION_SECRET=GENERAR-NUEVO-SECRETO-AQUI
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=desarrollogastro@gmail.com
EMAIL_PASSWORD=zmpn qjlc qvuj quzl
EMAIL_FROM=desarrollogastro@gmail.com
EMAIL_TO=juliaanemanuel14@gmail.com
EMAIL_TO_CC=matias.controldegestion@gmail.com
```

### 3.3 Generar Nuevo SESSION_SECRET para Producción

**IMPORTANTE**: NO uses el mismo `SESSION_SECRET` que en desarrollo.

Genera uno nuevo ejecutando en tu terminal local:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado y reemplázalo en la variable `SESSION_SECRET` de Railway.

### 3.4 Guardar Variables

1. Haz clic en **"Add"** o **"Update Variables"**
2. Railway reiniciará automáticamente tu servicio con las nuevas variables

---

## 💾 Paso 4: Configurar Persistencia de Base de Datos

Por defecto, Railway usa un sistema de archivos efímero (los archivos se borran al reiniciar). Para que tu base de datos SQLite persista, necesitas configurar un volumen.

### 4.1 Agregar un Volumen

1. En tu servicio de Railway, ve a la pestaña **"Settings"**
2. Busca la sección **"Volumes"** o **"Storage"**
3. Haz clic en **"+ Add Volume"** o **"New Volume"**
4. Configura el volumen:
   - **Mount Path**: `/app/backend`
   - **Name**: `database-storage` (opcional)
5. Haz clic en **"Add"**

Esto garantiza que los archivos `pagos.db` y `sessions.db` persistan entre reinicios.

---

## 🚀 Paso 5: Desplegar la Aplicación

### 5.1 Primer Despliegue

Railway debería comenzar el despliegue automáticamente después de:
- Conectar el repositorio
- Configurar las variables de entorno
- Agregar el volumen

Puedes ver el progreso en la pestaña **"Deployments"**.

### 5.2 Ver los Logs

1. Ve a la pestaña **"Deployments"**
2. Haz clic en el despliegue activo
3. Verás logs en tiempo real:
   ```
   Installing dependencies...
   Building application...
   Starting server...
   Servidor ejecutándose en http://0.0.0.0:XXXX
   Conectado a la base de datos SQLite.
   ```

### 5.3 Obtener la URL de tu Aplicación

1. En la vista principal de tu servicio, busca la sección **"Domains"**
2. Railway genera automáticamente una URL como:
   ```
   https://formulario-pagos-production.up.railway.app
   ```
3. Haz clic en la URL para abrir tu aplicación

---

## 🗃️ Paso 6: Inicializar Base de Datos en Railway

Después del primer despliegue, necesitas crear la tabla de usuarios en producción.

### 6.1 Abrir la Terminal de Railway

1. En tu servicio, haz clic en los **tres puntos (⋮)** en la esquina superior derecha
2. Selecciona **"Open Shell"** o **"Service Shell"**
3. Se abrirá una terminal dentro del contenedor de Railway

### 6.2 Ejecutar Script de Creación de Usuarios

En la terminal de Railway, ejecuta:

```bash
npm run create-users
```

Deberías ver una salida similar a:

```
🔐 Creando tabla de usuarios con seguridad bcrypt...
✓ Tabla "usuarios" creada exitosamente
📝 Migrando usuarios existentes...
✓ Usuario "Lucas Ortiz" migrado
✓ Usuario "Julian Salvatierra" migrado
✓ Usuario "Matias Huss" migrado
✓ Usuario "Lucia Molina" migrado
✅ Migración completada
```

---

## ✅ Paso 7: Verificar el Despliegue

### 7.1 Probar el Login

1. Abre la URL de tu aplicación en Railway
2. Deberías ser redirigido automáticamente a `/login`
3. Intenta iniciar sesión con:
   - **Usuario**: `Julian Salvatierra`
   - **Contraseña**: `4226`
4. Si el login es exitoso, serás redirigido al formulario principal

### 7.2 Probar el Registro de Pagos

1. Completa el formulario con datos de prueba
2. Haz clic en **"Registrar Gasto"**
3. Verifica que:
   - El gasto se registra correctamente
   - Se muestra el mensaje de confirmación
   - Se envía el email (revisa la bandeja de entrada)

### 7.3 Verificar Historial

1. Ve a la página de historial
2. Verifica que el gasto registrado aparece en la tabla
3. Verifica que el importe NO sea $0.00 (problema anterior corregido)

---

## 🔒 Paso 8: Configuración de Dominio Personalizado (Opcional)

Si tienes un dominio propio, puedes configurarlo en Railway:

### 8.1 Agregar Dominio Personalizado

1. En tu servicio, ve a la sección **"Settings"**
2. Busca **"Custom Domain"** o **"Domains"**
3. Haz clic en **"+ Add Domain"**
4. Ingresa tu dominio (ej: `pagos.tuempresa.com`)
5. Railway te dará registros DNS para configurar en tu proveedor de dominio

### 8.2 Configurar DNS

1. Ve al panel de control de tu proveedor de dominio (ej: GoDaddy, Namecheap)
2. Agrega un registro **CNAME**:
   - **Name/Host**: `pagos` (o el subdominio que quieras)
   - **Value/Points to**: El valor que te dio Railway
   - **TTL**: 3600 (o el mínimo permitido)
3. Guarda los cambios
4. Espera entre 5 minutos y 48 horas para que se propague (usualmente es rápido)

Railway configurará automáticamente HTTPS con certificado SSL gratuito.

---

## 🔄 Paso 9: Configurar Despliegues Automáticos

Railway ya está configurado para despliegue continuo (CD). Cada vez que hagas `git push` a la rama `main` (o `master`), Railway desplegará automáticamente.

### 9.1 Flujo de Trabajo Recomendado

```bash
# 1. Hacer cambios en tu código local
# (editar archivos en tu editor)

# 2. Probar localmente
npm start

# 3. Si todo funciona, hacer commit
git add .
git commit -m "Descripción de los cambios"

# 4. Subir a GitHub
git push origin main

# 5. Railway detectará el push y desplegará automáticamente
# Puedes ver el progreso en la pestaña "Deployments"
```

### 9.2 Deshabilitar Despliegues Automáticos (Opcional)

Si prefieres controlar cuándo se despliega:

1. Ve a **Settings** en tu servicio
2. Busca **"Deployment Trigger"** o **"Auto Deploy"**
3. Desactiva la opción
4. Para desplegar manualmente, ve a **Deployments** > **"Deploy"**

---

## 📊 Monitoreo y Logs

### 10.1 Ver Logs en Tiempo Real

1. En tu servicio, ve a la pestaña **"Logs"** o **"Observability"**
2. Puedes ver:
   - Logs de aplicación (console.log, console.error)
   - Errores de despliegue
   - Tráfico HTTP
   - Reinios del servicio

### 10.2 Métricas

Railway proporciona métricas básicas:
- Uso de CPU
- Uso de memoria
- Tráfico de red
- Tiempo de actividad (uptime)

---

## 🐛 Troubleshooting

### Problema 1: Error "Application failed to respond"

**Causa**: La aplicación no se inició correctamente o hay un error en el código.

**Solución**:
1. Ve a **Logs** y busca errores
2. Verifica que todas las variables de entorno estén configuradas
3. Asegúrate de que el volumen esté montado en `/app/backend`

### Problema 2: "Usuario o contraseña incorrectos"

**Causa**: La tabla `usuarios` no existe en la base de datos de producción.

**Solución**:
1. Abre la terminal de Railway (**Service Shell**)
2. Ejecuta: `npm run create-users`
3. Reinicia el servicio

### Problema 3: Emails no se envían

**Causa**: Configuración incorrecta de variables de entorno de email.

**Solución**:
1. Verifica que las variables `EMAIL_*` estén correctas en Railway
2. Verifica que la contraseña de aplicación de Gmail siga siendo válida
3. Revisa los logs para ver errores específicos de nodemailer

### Problema 4: Sesiones se pierden al reiniciar

**Causa**: El volumen no está configurado correctamente.

**Solución**:
1. Ve a **Settings** > **Volumes**
2. Verifica que el mount path sea `/app/backend`
3. Si no existe, crea el volumen
4. Redespliega la aplicación

### Problema 5: "Too many login attempts"

**Causa**: Rate limiting activado después de 5 intentos fallidos.

**Solución**:
- Espera 15 minutos
- O reinicia el servicio desde Railway

### Problema 6: Base de datos bloqueada (database is locked)

**Causa**: SQLite no maneja bien múltiples conexiones simultáneas.

**Solución a corto plazo**:
- Reinicia el servicio

**Solución a largo plazo** (si tienes mucho tráfico):
- Considera migrar a PostgreSQL (Railway lo ofrece gratis)

---

## 💰 Costos Estimados

Railway ofrece:
- **Plan Hobby**: $5/mes de crédito gratuito
- **Plan Pro**: $20/mes con más recursos

Para esta aplicación:
- **Uso estimado**: $3-7/mes (con bajo-medio tráfico)
- **Incluye**:
  - Hosting de la aplicación
  - SSL/HTTPS automático
  - 8GB de RAM compartida
  - Almacenamiento persistente (volumen)
  - Despliegues ilimitados

---

## 🔐 Recomendaciones de Seguridad Post-Despliegue

### Alta Prioridad

1. **Cambiar Contraseñas de Usuarios**
   - Las contraseñas actuales (4 dígitos) son temporales
   - Implementar política de contraseñas fuertes:
     - Mínimo 8 caracteres
     - Mayúsculas, minúsculas, números y símbolos

2. **Monitorear Logs Regularmente**
   - Revisar logs semanalmente para detectar actividad sospechosa
   - Configurar alertas en Railway si es posible

3. **Backups de Base de Datos**
   - Railway NO hace backups automáticos de volúmenes
   - Descarga manualmente `pagos.db` periódicamente:
     1. Abre **Service Shell** en Railway
     2. Ejecuta: `cat backend/pagos.db | base64`
     3. Copia el output y guárdalo localmente
     4. Para restaurar: decodifica base64 y sube el archivo

### Media Prioridad

4. **Implementar Endpoint de Cambio de Contraseña**
   - Permitir a usuarios cambiar su contraseña desde la UI
   - Forzar cambio en primer login

5. **Configurar Logs de Auditoría**
   - Registrar todos los intentos de login (exitosos y fallidos)
   - Registrar todos los cambios en la base de datos

---

## 📚 Recursos Adicionales

- [Documentación de Railway](https://docs.railway.app/)
- [Railway Community Discord](https://discord.gg/railway)
- [GitHub Actions para CI/CD](https://docs.github.com/en/actions)
- [Nodemailer con Gmail](https://nodemailer.com/usage/using-gmail/)

---

## 🆘 Soporte

Si tienes problemas durante el despliegue:

1. **Revisa los logs** en Railway
2. **Verifica las variables de entorno**
3. **Consulta la documentación** de Railway
4. **Busca en Railway Discord** (comunidad muy activa)

---

## ✅ Checklist de Despliegue

Usa esta lista para verificar que completaste todos los pasos:

- [ ] Repositorio de GitHub creado y código subido
- [ ] Proyecto de Railway creado y conectado a GitHub
- [ ] Variables de entorno configuradas (incluyendo SESSION_SECRET nuevo)
- [ ] Volumen agregado en `/app/backend`
- [ ] Aplicación desplegada exitosamente
- [ ] Script `create-users` ejecutado en Railway
- [ ] Login funcionando correctamente
- [ ] Registro de pagos funcionando
- [ ] Email de confirmación enviándose
- [ ] Historial mostrando importes correctos
- [ ] Campo OP funcionando para Julian Salvatierra
- [ ] (Opcional) Dominio personalizado configurado

---

**Última actualización**: 2025-11-20
**Versión**: 1.0

¡Felicitaciones! Tu aplicación ahora está en la nube y accesible desde cualquier lugar 🎉
