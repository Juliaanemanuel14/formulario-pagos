# Guía de Normalización de Productos - Mejores Prácticas

## 🎯 Objetivo
Estandarizar nombres de productos para que "Coca Cola 500ml", "COCA-COLA 500ML" y "coca cola 500" sean reconocidos como el mismo producto: **COCA COLA 500ML**

---

## 📋 PARTE 1: Construcción de Tabla Auxiliar

### Estructura Recomendada

```excel
| Nombre Gestion              | Base                | Categoria | Proveedor | Activo |
|-----------------------------|---------------------|-----------|-----------|--------|
| Coca cola 500ml             | COCA COLA 500ML     | Bebidas   | GENERAL   | SI     |
| COCA COLA 500ML PACK X6     | COCA COLA 500ML     | Bebidas   | COCACOLA  | SI     |
| Coca-Cola 500 ML            | COCA COLA 500ML     | Bebidas   | GENERAL   | SI     |
```

### Reglas para Nombres Base (Columna "Base")

✅ **FORMATO ESTÁNDAR:**
```
[PRODUCTO] [MARCA] [TAMAÑO][UNIDAD] [TIPO/VARIANTE]
```

**Ejemplos:**
- ✅ `ACEITE GIRASOL COCINERO 900ML`
- ✅ `GASEOSA COCA COLA 500ML`
- ✅ `ARROZ GALLO ORO 1KG LARGO FINO`
- ❌ `Aceite 900ml Cocinero` (mal orden, minúsculas)
- ❌ `ACEITE DE GIRASOL COCINERO 0.9L` (usar ML no L)

✅ **CONSISTENCIA:**
- SIEMPRE EN MAYÚSCULAS
- Sin acentos (á→A, é→E), excepto Ñ
- Unidades estandarizadas:
  - ML (no ml, Ml, mL)
  - KG (no kg, Kg)
  - GR (no gr, g, G)
  - LT (no lt, l, L)
  - UN (no u, uni, unidad)
- Números sin separadores: 1500ML (no 1.500ML, 1,5L)

✅ **ABREVIATURAS ESTÁNDAR:**
```
PACK → PK
UNIDADES → UN
LITRO → LT (pero usar ML para consistencia)
GRAMOS → GR
KILOGRAMOS → KG
EXTRA → XTR
GRANDE → GDE
CHICO → CHI
```

---

## 🔧 PARTE 2: Estrategia de Matching

### Niveles de Matching (en orden)

#### Nivel 1: Match Exacto Normalizado (100% confianza)
```
Descripción factura: "coca cola 500ml"
Normalizado: "COCACOLA500ML" (quitar espacios/puntuación)
Tabla normalizado: "COCACOLA500ML"
→ Match! Retorna: COCA COLA 500ML
```

#### Nivel 2: Fuzzy Match Alto (>90% confianza)
```
Descripción: "coca-cola 500 ml"
Mejor match: "COCA COLA 500ML" (similitud: 95%)
→ Match! Retorna: COCA COLA 500ML
```

#### Nivel 3: Fuzzy Match Moderado (75-90% confianza)
```
Descripción: "gaseosa coca 500"
Mejor match: "COCA COLA 500ML" (similitud: 82%)
→ Match con advertencia. Usuario debería validar.
```

#### Nivel 4: Sin Match (<75% confianza)
```
Descripción: "producto nuevo xyz"
Mejor match: "COCA COLA 500ML" (similitud: 45%)
→ Sin match. Agregar manualmente a tabla.
```

---

## 🚀 PARTE 3: Proceso de Trabajo Recomendado

### Flujo Operativo

```mermaid
1. Extraer Facturas
   ↓
2. Normalización Automática (fuzzy matching)
   ↓
3. Revisar "Sin Match" y "Fuzzy <85%"
   ↓
4. Agregar nuevas variantes a tabla auxiliar
   ↓
5. (Opcional) Re-procesar para mejorar stats
   ↓
6. Exportar Excel final
```

### Mantenimiento Semanal de Tabla

**Día Lunes** (o después de procesar facturas):
1. Revisar reporte de normalización
2. Filtrar items con `Metodo_Match = "Sin match"`
3. Para cada uno:
   - ¿Es un producto nuevo? → Crear entrada nueva en tabla
   - ¿Es variante de existente? → Agregar a "Nombre Gestion"
4. Actualizar `tabla_normalizacion.xlsx`
5. Subir a GitHub
6. Re-ejecutar extracción (opcional)

---

## 📊 PARTE 4: Mejora del Algoritmo

### Configuración Recomendada

**Umbrales por Tipo de Producto:**

| Tipo de Producto | Umbral Recomendado | Razón |
|------------------|-------------------|-------|
| Con números (500ML, 1KG) | 85% | Los números deben coincidir |
| Sin números (ACEITE) | 70% | Más flexibilidad |
| Marcas registradas | 90% | Evitar confusiones |

### Pre-procesamiento Mejorado

```python
def limpiar_descripcion(texto):
    """Limpia y normaliza descripción para matching."""
    import re
    from unidecode import unidecode

    # Mayúsculas
    texto = texto.upper()

    # Quitar acentos
    texto = unidecode(texto)

    # Normalizar unidades
    texto = re.sub(r'\bML\b|\bMILILITROS\b', 'ML', texto)
    texto = re.sub(r'\bKG\b|\bKILOS\b|\bKILOGRAMOS\b', 'KG', texto)
    texto = re.sub(r'\bGR\b|\bGRAMOS\b', 'GR', texto)
    texto = re.sub(r'\bLT\b|\bLITROS\b', 'LT', texto)

    # Normalizar separadores
    texto = re.sub(r'[^\w\s]', ' ', texto)  # Quita puntuación
    texto = re.sub(r'\s+', ' ', texto)       # Normaliza espacios

    return texto.strip()
```

---

## 🎯 PARTE 5: Casos Especiales

### Productos con Pack

**Problema:** "COCA COLA 500ML PACK X6" vs "COCA COLA 500ML"

**Solución 1 (Simple):** Normalizar todos a unidad base
```
COCA COLA 500ML PACK X6 → COCA COLA 500ML
COCA COLA 500ML X6 → COCA COLA 500ML
COCA COLA 500ML → COCA COLA 500ML
```

**Solución 2 (Compleja):** Mantener diferenciación
```
Base 1: COCA COLA 500ML UNIDAD
Base 2: COCA COLA 500ML PACK
```

### Productos con Variantes

**Problema:** "ACEITE GIRASOL 900ML" vs "ACEITE MAIZ 900ML"

**Solución:** Incluir variante en nombre base
```
Base 1: ACEITE GIRASOL 900ML
Base 2: ACEITE MAIZ 900ML
Base 3: ACEITE OLIVA 900ML
```

---

## 📈 PARTE 6: Métricas de Calidad

### Objetivos de Normalización

| Métrica | Objetivo | Excelente |
|---------|----------|-----------|
| % Match Exactos | >60% | >80% |
| % Fuzzy Match | 20-30% | <15% |
| % Sin Match | <20% | <5% |
| Similitud Promedio | >80% | >90% |

### Seguimiento Mensual

Crear dashboard con:
- Productos nuevos agregados este mes
- Productos con más variantes
- Proveedores con peor normalización
- Tendencia de mejora (% sin match mes a mes)

---

## 🔄 PARTE 7: Automatización Avanzada (Futuro)

### Sistema de Aprendizaje

```python
# Cuando usuario valida manualmente un match
def guardar_validacion_usuario(descripcion_original, nombre_base_correcto):
    """Aprende de validaciones del usuario."""
    # Agrega automáticamente a tabla auxiliar
    agregar_a_tabla(descripcion_original, nombre_base_correcto)
    # Re-entrena modelo fuzzy con nuevo ejemplo
    actualizar_modelo()
```

### Sugerencias Inteligentes

```python
def sugerir_normalizacion(descripcion_sin_match):
    """Sugiere posibles matches al usuario."""
    # Top 5 matches con similitud 60-74%
    sugerencias = obtener_top_matches(descripcion_sin_match, n=5)

    # Usuario elige o crea nuevo
    return mostrar_opciones_usuario(sugerencias)
```

---

## ✅ Checklist de Implementación

### Fase 1: Preparación (1 semana)
- [ ] Revisar todas las facturas del último mes
- [ ] Extraer lista de productos únicos
- [ ] Crear tabla auxiliar inicial (>100 productos)
- [ ] Definir estándar de nombres base
- [ ] Documentar abreviaturas

### Fase 2: Testing (1 semana)
- [ ] Procesar facturas antiguas con nueva tabla
- [ ] Validar % de matches
- [ ] Ajustar umbrales de fuzzy matching
- [ ] Corregir entradas en tabla auxiliar

### Fase 3: Producción (ongoing)
- [ ] Mantenimiento semanal de tabla
- [ ] Revisar reportes de calidad
- [ ] Agregar nuevos productos/variantes
- [ ] Monitorear métricas

---

## 📚 Recursos

### Herramientas Útiles

1. **Excel con Fuzzy Lookup** (para validar tabla manualmente)
2. **OpenRefine** (clustering automático de nombres)
3. **Power Query** (transformaciones de texto)
4. **Python + pandas** (análisis de frecuencias)

### Comandos Útiles

```python
# Ver productos con más variantes
df_auxiliar.groupby('Base').size().sort_values(ascending=False).head(20)

# Ver productos sin normalizar
df_facturas[df_facturas['Metodo_Match'] == 'Sin match']['Descripcion'].unique()

# Análisis de similitud promedio por proveedor
df_facturas.groupby('Proveedor')['Similitud_Match'].mean()
```

---

## 🎓 Resumen Ejecutivo

**Para tener una normalización de calidad:**

1. ✅ Tabla auxiliar con >100 productos base
2. ✅ Nombres base consistentes (MAYÚSCULAS, sin acentos)
3. ✅ Múltiples variantes por producto (>3 por producto)
4. ✅ Mantenimiento semanal (agregar nuevas variantes)
5. ✅ Umbrales de fuzzy matching ajustados (85% recomendado)
6. ✅ Monitoreo de métricas (<10% sin match)
7. ✅ Proceso definido para productos nuevos

**Tiempo estimado:** 2-3 semanas para tener sistema robusto
**Mantenimiento:** 30 min/semana

---

**Fecha:** 26/11/2025
**Versión:** 1.0
