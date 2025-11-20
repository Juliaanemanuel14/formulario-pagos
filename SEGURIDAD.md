# 🔐 Mejoras de Seguridad Implementadas

## Resumen

Se han implementado **4 mejoras críticas de seguridad** para proteger la aplicación contra ataques comunes y mejorar la gestión de credenciales.

---

## ✅ 1. Protección de Credenciales

### Problema Anterior
- Archivo `.env` sin protección en el repositorio
- Riesgo de exposición de credenciales de email

### Solución Implementada
- `.env` agregado a `.gitignore`
- Credenciales protegidas del control de versiones
- Variables de entorno aisladas

### Archivos Modificados
- `.gitignore`

---

## ✅ 2. Sesiones Persistentes (SQLite)

### Problema Anterior
- Sesiones almacenadas en memoria (MemoryStore)
- Sesiones perdidas al reiniciar el servidor
- No escalable para producción

### Solución Implementada
- Implementación de `connect-sqlite3`
- Sesiones persistidas en BD SQLite
- Archivo `sessions.db` en backend (excluido de git)

### Beneficios
- Las sesiones sobreviven reinicios del servidor
- Mejor experiencia de usuario
- Preparado para escalado

### Archivos Modificados
- `backend/server.js`
- `.gitignore`

---

## ✅ 3. Autenticación Segura con Bcrypt

### Problema Anterior
- Contraseñas en texto plano hardcoded
- Contraseñas débiles (4 dígitos)
- Código fuente contenía credenciales

### Solución Implementada
- Tabla `usuarios` en base de datos
- Contraseñas hasheadas con bcrypt (10 rounds)
- Verificación segura de contraseñas
- Campo `rol` para permisos (admin/usuario)
- Campo `activo` para deshabilitar usuarios
- Registro de `ultimo_acceso`

### Estructura de la Tabla

```sql
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  rol TEXT DEFAULT 'usuario',
  activo INTEGER DEFAULT 1,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso DATETIME
)
```

### Usuarios Migrados

| Usuario | Rol | Contraseña Actual |
|---------|-----|-------------------|
| Lucas Ortiz | usuario | 7894 (temporal) |
| Julian Salvatierra | admin | 4226 (temporal) |
| Matias Huss | usuario | 1994 (temporal) |
| Lucia Molina | usuario | 6462 (temporal) |

⚠️ **IMPORTANTE**: Las contraseñas actuales son temporales y deben ser cambiadas.

### Comandos Útiles

```bash
# Crear/migrar tabla de usuarios
npm run create-users

# Las contraseñas se hashean automáticamente con bcrypt
```

### Archivos Modificados
- `backend/server.js` - Login con bcrypt
- `backend/create-users-table.js` - Script de migración
- `package.json` - Nuevo script

---

## ✅ 4. Rate Limiting (Protección contra Fuerza Bruta)

### Problema Anterior
- Sin límite de intentos de login
- Vulnerable a ataques de fuerza bruta
- Sin throttling de peticiones

### Solución Implementada
- `express-rate-limit` en endpoint de login
- **Límite**: 5 intentos cada 15 minutos
- Mensaje de error claro al usuario

### Configuración

```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 solicitudes
  message: 'Demasiados intentos de inicio de sesión...'
});
```

### Archivos Modificados
- `backend/server.js`

---

## 🔄 Proceso de Migración

### 1. Instalación de Dependencias

```bash
npm install
```

Esto instalará:
- `connect-sqlite3`: Almacenamiento de sesiones
- `bcrypt`: Hashing de contraseñas
- `express-rate-limit`: Limitación de peticiones

### 2. Crear Tabla de Usuarios

```bash
npm run create-users
```

Este comando:
1. Crea la tabla `usuarios` si no existe
2. Migra los 4 usuarios hardcoded
3. Hashea las contraseñas actuales con bcrypt
4. Muestra un resumen de usuarios creados

### 3. Reiniciar Servidor

```bash
npm start
# o para desarrollo
npm run dev
```

---

## 🧪 Pruebas

### Test de Login con Bcrypt

1. Abrir `http://localhost:3000/login`
2. Ingresar credenciales:
   - Usuario: `Julian Salvatierra`
   - Contraseña: `4226`
3. Verificar login exitoso
4. Sesión persistida en `backend/sessions.db`

### Test de Rate Limiting

1. Intentar login 6 veces con credenciales incorrectas
2. Esperar mensaje: "Demasiados intentos de inicio de sesión..."
3. Esperar 15 minutos o reiniciar servidor
4. Intentar de nuevo

---

## 📊 Comparación Antes/Después

| Aspecto | Antes ❌ | Después ✅ |
|---------|----------|------------|
| Contraseñas | Texto plano | Bcrypt hash |
| Almacenamiento | Código fuente | Base de datos |
| Sesiones | Memoria (volátil) | SQLite (persistente) |
| Fuerza bruta | Desprotegido | Rate limiting (5/15min) |
| Credenciales | Expuestas en git | Protegidas (.gitignore) |
| Escalabilidad | Mala | Buena |

---

## 🚨 Recomendaciones Post-Implementación

### ALTA PRIORIDAD

1. **Cambiar Contraseñas**
   - Las contraseñas actuales (4 dígitos) son temporales
   - Implementar política de contraseñas seguras:
     - Mínimo 8 caracteres
     - Al menos una mayúscula
     - Al menos un número
     - Al menos un carácter especial

2. **Cambiar SESSION_SECRET**
   - Actualizar `.env`:
   ```bash
   SESSION_SECRET=un-secreto-muy-largo-y-aleatorio-minimo-32-caracteres
   ```
   - Generar con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

3. **HTTPS en Producción**
   - Cambiar `cookie.secure` a `true` en `server.js`
   - Configurar SSL/TLS en el servidor

### MEDIA PRIORIDAD

4. **Implementar Cambio de Contraseña**
   - Endpoint para que usuarios cambien su contraseña
   - Forzar cambio en primer login

5. **Logs de Auditoría**
   - Registrar todos los intentos de login
   - Alertas de intentos fallidos

6. **Protección CSRF**
   - Implementar tokens CSRF en formularios

---

## 📁 Archivos Generados

```
backend/
  ├── sessions.db          # Sesiones persistentes (git ignored)
  ├── pagos.db             # Base de datos principal (actualizada con tabla usuarios)
  └── create-users-table.js # Script de migración

.gitignore                 # Actualizado con sessions.db
```

---

## 🐛 Troubleshooting

### Error: "Usuario o contraseña incorrectos"

**Causa**: La tabla `usuarios` no existe o está vacía

**Solución**:
```bash
npm run create-users
```

### Error: "MemoryStore is not designed for production"

**Causa**: La instalación de `connect-sqlite3` no se completó

**Solución**:
```bash
npm install connect-sqlite3 --save
npm start
```

### Sesiones se pierden al reiniciar

**Causa**: No se está usando SQLiteStore

**Solución**: Verificar que `server.js` tenga:
```javascript
const SQLiteStore = require('connect-sqlite3')(session);
// ...
store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname) })
```

---

## 📚 Recursos

- [bcrypt - npm](https://www.npmjs.com/package/bcrypt)
- [connect-sqlite3 - npm](https://www.npmjs.com/package/connect-sqlite3)
- [express-rate-limit - npm](https://www.npmjs.com/package/express-rate-limit)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

## ✅ Checklist de Seguridad

- [x] Credenciales protegidas (.env en .gitignore)
- [x] Sesiones persistentes (connect-sqlite3)
- [x] Contraseñas hasheadas (bcrypt)
- [x] Rate limiting (express-rate-limit)
- [ ] CSRF protection (pendiente)
- [ ] HTTPS en producción (pendiente)
- [ ] Contraseñas fuertes (pendiente - cambio manual)
- [ ] Logs de auditoría (pendiente)

---

**Última actualización**: 2025-11-20
**Versión de seguridad**: 2.0
