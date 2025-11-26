# Instrucciones de Migración de Base de Datos

## Problema
La base de datos de PostgreSQL en Railway no tiene las columnas necesarias para almacenar:
- `proveedor`
- `fecha_pago`
- `fecha_servicio`
- `moneda`
- `concepto`
- `importe`
- `observacion`
- `op`

## Solución

### Opción 1: Ejecutar migración desde Railway CLI

1. **Instalar Railway CLI** (si no lo tienes):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login en Railway**:
   ```bash
   railway login
   ```

3. **Conectarte a tu proyecto**:
   ```bash
   railway link
   ```

4. **Ejecutar la migración**:
   ```bash
   railway run npm run migrate-pg
   ```

### Opción 2: Ejecutar migración desde el dashboard de Railway

1. Ve a tu proyecto en Railway
2. Abre la pestaña "Settings"
3. Busca la sección "Deploy Trigger"
4. Agrega un "Custom Start Command" temporal:
   ```
   npm run migrate-pg && npm start
   ```
5. Triggerea un nuevo deploy
6. Una vez que la migración se complete, vuelve a cambiar el comando a:
   ```
   npm start
   ```

### Opción 3: Conectarse directamente a PostgreSQL

1. En Railway, ve a tu servicio de PostgreSQL
2. Copia las credenciales de conexión
3. Conéctate usando `psql` o cualquier cliente de PostgreSQL
4. Ejecuta manualmente los siguientes comandos SQL:

```sql
-- Agregar columnas faltantes
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS proveedor VARCHAR(255);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS fecha_pago DATE;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS fecha_servicio DATE;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS moneda VARCHAR(50);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS concepto TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS importe DECIMAL(10, 2);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS observacion TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS op VARCHAR(50);

-- Copiar datos de fecha a las nuevas columnas
UPDATE pagos
SET fecha_pago = fecha, fecha_servicio = fecha
WHERE fecha_pago IS NULL AND fecha IS NOT NULL;
```

## Verificación

Después de ejecutar la migración, verifica que las columnas se hayan agregado:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pagos'
ORDER BY ordinal_position;
```

## Importante

⚠️ **Los registros antiguos mostrarán "-" en las fechas** porque no tienen datos en `fecha_pago` y `fecha_servicio`. Solo los nuevos registros tendrán estas fechas pobladas correctamente.
