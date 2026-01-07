# Usar Node.js 18 LTS como imagen base
FROM node:18-slim

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY formulario-pagos/package*.json ./

# Instalar dependencias de producción (incluyendo resend)
RUN npm ci --only=production && npm cache clean --force

# Copiar el código de la aplicación
COPY formulario-pagos/backend ./backend
COPY formulario-pagos/frontend ./frontend

# Crear usuario no-root para mayor seguridad
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

# Cambiar al usuario no-root
USER appuser

# Exponer puerto
ENV PORT=8080
EXPOSE 8080

# Comando para iniciar la aplicación con Resend
CMD ["node", "backend/server-pg.js"]
