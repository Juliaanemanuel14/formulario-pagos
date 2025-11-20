#!/bin/bash

# Script de despliegue para Google Cloud Run
# Este script automatiza el proceso de despliegue

set -e

echo "🚀 Iniciando despliegue en Google Cloud Run..."

# Verificar que gcloud está instalado
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: Google Cloud SDK no está instalado"
    echo "Descárgalo desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Leer configuración
echo ""
read -p "Ingresa tu PROJECT_ID de Google Cloud: " PROJECT_ID
read -p "Ingresa la región (default: us-central1): " REGION
REGION=${REGION:-us-central1}

echo ""
echo "📝 Configuración:"
echo "  - Project: $PROJECT_ID"
echo "  - Region: $REGION"
echo ""

# Configurar proyecto
echo "🔧 Configurando proyecto..."
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

# Construir imagen
echo ""
echo "🏗️  Construyendo imagen de Docker..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/formulario-pagos

# Obtener variables de entorno
echo ""
read -p "Ingresa el nombre de tu instancia Cloud SQL: " SQL_INSTANCE
read -p "Ingresa el nombre de la base de datos: " DB_NAME
read -p "Ingresa el usuario de la base de datos: " DB_USER
read -sp "Ingresa la contraseña de la base de datos: " DB_PASSWORD
echo ""

# Construir connection name
CONNECTION_NAME="$PROJECT_ID:$REGION:$SQL_INSTANCE"

# Crear secreto para la contraseña
echo ""
echo "🔐 Creando secreto para la contraseña..."
echo -n "$DB_PASSWORD" | gcloud secrets create db-password --data-file=- --replication-policy="automatic" 2>/dev/null || echo "Secreto ya existe, actualizando..."
echo -n "$DB_PASSWORD" | gcloud secrets versions add db-password --data-file=- 2>/dev/null || true

# Obtener el número de proyecto
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Dar permisos al servicio
echo "🔑 Configurando permisos..."
gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" || true

# Desplegar
echo ""
echo "🚢 Desplegando en Cloud Run..."
gcloud run deploy formulario-pagos \
  --image gcr.io/$PROJECT_ID/formulario-pagos \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $CONNECTION_NAME \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DB_USER=$DB_USER \
  --set-env-vars DB_NAME=$DB_NAME \
  --set-env-vars DB_HOST=/cloudsql/$CONNECTION_NAME \
  --set-env-vars INSTANCE_CONNECTION_NAME=$CONNECTION_NAME \
  --set-env-vars SESSION_SECRET=$(openssl rand -base64 32) \
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

echo ""
echo "✅ Despliegue completado!"
echo ""
echo "🌐 Tu aplicación está disponible en:"
gcloud run services describe formulario-pagos --format="value(status.url)"
echo ""
