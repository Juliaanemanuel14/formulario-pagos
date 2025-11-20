# Guía de Despliegue en Google Cloud Run

Esta guía te llevará paso a paso para desplegar tu aplicación de registro de pagos en Google Cloud Run con PostgreSQL.

## Requisitos Previos

1. Cuenta de Google Cloud (con créditos gratuitos o tarjeta de crédito configurada)
2. Google Cloud CLI instalado ([Descargar aquí](https://cloud.google.com/sdk/docs/install))
3. Docker instalado (opcional, Cloud Build lo puede hacer por ti)

## Costos Estimados

- **Cloud Run**: ~$5-20/mes (pago por uso, escala a cero)
- **Cloud SQL PostgreSQL**: ~$10-30/mes (instancia pequeña)
- **Total estimado**: ~$15-50/mes

---

## Paso 1: Configurar Google Cloud Project

### 1.1 Crear un nuevo proyecto

```bash
# Iniciar sesión en Google Cloud
gcloud auth login

# Crear un nuevo proyecto (reemplaza TU-PROYECTO-ID con un ID único)
gcloud projects create TU-PROYECTO-ID --name="Formulario Pagos"

# Configurar el proyecto actual
gcloud config set project TU-PROYECTO-ID

# Habilitar facturación (debes asociar una cuenta de facturación desde la consola web)
# https://console.cloud.google.com/billing
```

### 1.2 Habilitar APIs necesarias

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  cloudbuild.googleapis.com
```

---

## Paso 2: Crear Base de Datos Cloud SQL (PostgreSQL)

### 2.1 Crear instancia de PostgreSQL

```bash
# Crear la instancia (esto toma unos 5-10 minutos)
gcloud sql instances create pagos-db-instance \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=TU-PASSWORD-SEGURA

# Nota: db-f1-micro es la opción más económica (~$10/mes)
# Para producción con más tráfico, considera db-g1-small
```

### 2.2 Crear la base de datos

```bash
gcloud sql databases create pagos_db --instance=pagos-db-instance
```

### 2.3 Crear usuario de la base de datos

```bash
gcloud sql users create pagos_user \
  --instance=pagos-db-instance \
  --password=TU-PASSWORD-USUARIO
```

### 2.4 Obtener el nombre de conexión

```bash
gcloud sql instances describe pagos-db-instance \
  --format="value(connectionName)"
```

Guarda este valor, lo necesitarás más adelante. Será algo como:
```
tu-proyecto:us-central1:pagos-db-instance
```

---

## Paso 3: Configurar Variables de Entorno

Crea un archivo `.env.production` con tus valores:

```bash
# Copia el ejemplo
cp .env.production.example .env.production

# Edita el archivo con tus valores reales
```

**IMPORTANTE**: Actualiza estos valores en `.env.production`:
- `DB_PASSWORD`: La contraseña que configuraste para el usuario
- `DB_HOST`: El connection name que obtuviste en el paso 2.4
- `INSTANCE_CONNECTION_NAME`: El mismo connection name
- `SESSION_SECRET`: Genera una contraseña segura aleatoria

---

## Paso 4: Construir y Desplegar en Cloud Run

### 4.1 Configurar región

```bash
gcloud config set run/region us-central1
```

### 4.2 Construir la imagen con Cloud Build

```bash
# Cloud Build construirá la imagen automáticamente
gcloud builds submit --tag gcr.io/TU-PROYECTO-ID/formulario-pagos
```

### 4.3 Desplegar en Cloud Run

```bash
gcloud run deploy formulario-pagos \
  --image gcr.io/TU-PROYECTO-ID/formulario-pagos \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances TU-PROYECTO-ID:us-central1:pagos-db-instance \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DB_USER=pagos_user \
  --set-env-vars DB_NAME=pagos_db \
  --set-env-vars DB_HOST=/cloudsql/TU-PROYECTO-ID:us-central1:pagos-db-instance \
  --set-env-vars INSTANCE_CONNECTION_NAME=TU-PROYECTO-ID:us-central1:pagos-db-instance \
  --set-env-vars SESSION_SECRET=tu-secreto-super-seguro \
  --set-env-vars EMAIL_HOST=smtp.gmail.com \
  --set-env-vars EMAIL_PORT=587 \
  --set-env-vars EMAIL_SECURE=false \
  --set-env-vars EMAIL_USER=desarrollogastro@gmail.com \
  --set-env-vars EMAIL_PASSWORD="zmpn qjlc qvuj quzl" \
  --set-env-vars EMAIL_FROM=desarrollogastro@gmail.com \
  --set-env-vars EMAIL_TO=juliaanemanuel14@gmail.com \
  --set-secrets DB_PASSWORD=db-password:latest \
  --max-instances=10 \
  --min-instances=0 \
  --memory=512Mi \
  --cpu=1
```

**IMPORTANTE**: Antes de ejecutar el comando anterior, necesitas crear el secreto para la contraseña:

```bash
# Crear secreto para la contraseña de la base de datos
echo -n "TU-PASSWORD-USUARIO" | gcloud secrets create db-password --data-file=-

# Dar permisos al servicio de Cloud Run para acceder al secreto
gcloud secrets add-iam-policy-binding db-password \
  --member=serviceAccount:TU-NUMERO-PROYECTO-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

---

## Paso 5: Inicializar la Base de Datos

Necesitas ejecutar las migraciones para crear las tablas. Hay dos opciones:

### Opción A: Desde Cloud Shell

```bash
# Conectarse a Cloud SQL
gcloud sql connect pagos-db-instance --user=pagos_user --database=pagos_db

# Una vez conectado, ejecutar las queries SQL:
CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  local VARCHAR(255) NOT NULL,
  fecha DATE NOT NULL,
  usuario_registro VARCHAR(255) NOT NULL,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pago_items (
  id SERIAL PRIMARY KEY,
  pago_id INTEGER NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  importe DECIMAL(10, 2) NOT NULL,
  observacion TEXT
);

CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
```

### Opción B: Usando Cloud Run Jobs (más avanzado)

```bash
# El servidor ya incluye auto-inicialización de tablas al arrancar
# Simplemente accede a la URL de tu aplicación y las tablas se crearán automáticamente
```

---

## Paso 6: Verificar el Despliegue

Después del despliegue, obtendrás una URL como:
```
https://formulario-pagos-xxxxx-uc.a.run.app
```

### 6.1 Probar la aplicación

1. Abre la URL en tu navegador
2. Deberías ser redirigido a `/login`
3. Inicia sesión con:
   - **Lucas Ortiz** / `7894`
   - **Julian Salvatierra** / `4226`
4. Registra un pago de prueba
5. Verifica que llegue el email

### 6.2 Ver logs

```bash
# Ver logs en tiempo real
gcloud run services logs tail formulario-pagos
```

---

## Paso 7: Configurar Dominio Personalizado (Opcional)

Si quieres usar tu propio dominio:

```bash
# Mapear dominio a Cloud Run
gcloud run domain-mappings create --service formulario-pagos \
  --domain pagos.tudominio.com
```

Luego configura los registros DNS según las instrucciones que te muestre el comando.

---

## Mantenimiento y Monitoreo

### Ver métricas

```bash
# Abrir consola de Cloud Run
gcloud run services describe formulario-pagos --platform managed
```

O visita: https://console.cloud.google.com/run

### Actualizar la aplicación

Cada vez que hagas cambios:

```bash
# 1. Construir nueva imagen
gcloud builds submit --tag gcr.io/TU-PROYECTO-ID/formulario-pagos

# 2. Redesplegar
gcloud run deploy formulario-pagos \
  --image gcr.io/TU-PROYECTO-ID/formulario-pagos \
  --platform managed
```

### Backup de la base de datos

```bash
# Crear backup manual
gcloud sql backups create --instance=pagos-db-instance

# Configurar backups automáticos
gcloud sql instances patch pagos-db-instance \
  --backup-start-time=03:00
```

---

## Costos y Optimización

### Reducir costos:

1. **Cloud Run**: Ya configurado con `--min-instances=0` (escala a cero cuando no hay tráfico)
2. **Cloud SQL**:
   - Usar `db-f1-micro` (más barato)
   - Configurar para que se detenga cuando no se use (no recomendado para producción)

### Monitorear costos:

```bash
# Ver presupuesto actual
gcloud billing budgets list
```

O visita: https://console.cloud.google.com/billing

---

## Troubleshooting

### Error: "Cannot connect to Cloud SQL"

```bash
# Verificar que Cloud Run tiene permisos
gcloud run services describe formulario-pagos --format="value(spec.template.spec.serviceAccountName)"
```

### Error: "Database does not exist"

```bash
# Verificar que la base de datos existe
gcloud sql databases list --instance=pagos-db-instance
```

### Ver logs de errores

```bash
# Filtrar solo errores
gcloud run services logs read formulario-pagos --limit=50 | grep ERROR
```

---

## Resumen de Comandos Rápidos

```bash
# Ver servicio
gcloud run services describe formulario-pagos

# Ver logs
gcloud run services logs tail formulario-pagos

# Actualizar variables de entorno
gcloud run services update formulario-pagos \
  --set-env-vars NUEVA_VAR=valor

# Eliminar todo (CUIDADO!)
gcloud run services delete formulario-pagos
gcloud sql instances delete pagos-db-instance
```

---

## Soporte

Si encuentras problemas:
1. Revisa los logs: `gcloud run services logs tail formulario-pagos`
2. Verifica la consola de Google Cloud: https://console.cloud.google.com
3. Documentación oficial: https://cloud.google.com/run/docs

---

**¡Listo!** Tu aplicación debería estar funcionando 24/7 en Google Cloud 🚀
