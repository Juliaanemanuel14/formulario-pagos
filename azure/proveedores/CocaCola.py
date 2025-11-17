 # proveedores/coca_cola.py
# -*- coding: utf-8 -*-

PATTERNS = [
    r"(?i)\bCOCA\s*COLA\b",
    r"(?i)\bCOCA-COLA\b",
    r"(?i)\bCOCA\s*COLA\s*(?:FEMSA|COMPANY|SERVICES)?\b",
]

PROMPT = """
Proveedor: COCA-COLA FEMSA de Buenos Aires S.A.

Objetivo: Extraer y procesar la información de la factura/remito con cálculos de costeo precisos.
Devolver un JSON con la siguiente estructura:
{
  "invoice_number": "<número de factura en la esquina superior derecha, ej: 0607-00375731>",
  "invoice_total": <número entero del IMP.TOTAL o TOTAL de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Codigo","Descripcion","Cantidad","PrecioUnitario","Subtotal","bulto","px_bulto","desc","neto","imp_int","iva_21","total","porc_desc","neto_mas_imp_int","iibb_caba","iibb_reg_3337","total_final","costo_x_bulto"]

REGLAS FUNDAMENTALES:
- Trabajar con anclas semánticas (texto clave), NO posiciones visuales
- Números en formato estándar: SIN símbolos $, SIN separadores de miles, SIN decimales (solo enteros)
- Si un valor no se encuentra: null
- Interpretación local argentina: "7.092.636,97" => 7092637 (redondeado a entero)
- No añadir texto fuera del JSON

ESTRUCTURA DE LA FACTURA COCA-COLA FEMSA:
Tabla de productos con columnas:
| CANTIDAD | CODIGO | PRODUCTO | P.UNITARIO | PRECIO NETO | DESCUENTO | SUBTOTAL | IVA 21% | I.INTERNOS | SUB+TOTAL |

ENCABEZADO DE FACTURA:
- invoice_number: Buscar en la esquina SUPERIOR DERECHA el texto "NUMERO:" seguido del número de factura.
  Formato típico: "NUMERO: 0607-00375731" → extraer "0607-00375731" (como string, con guiones)
  Si no se encuentra, buscar cualquier patrón similar a "XXXX-XXXXXXXX" en el encabezado.

PIE DE FACTURA (buscar fila "IB.DN"):
- IB_CAP_FED_TOTAL: Primer valor numérico en la zona de IB.DN (buscar texto "IB.CAP.FED")
- PERC_RG_3337_TOTAL: Tercer valor numérico en esa zona (buscar texto "PERC.RG.3337")
- invoice_total: IMPORTANTE - Buscar el texto exacto "IMP.TOTAL" seguido de "$" y extraer ese número.
  Es el ÚLTIMO valor numérico en el pie de la factura, después de todos los impuestos.
  Ejemplo: "IMP.TOTAL $ 8.708.199,47" → extraer 8708199 (sin decimales)

PASO 1: CÁLCULOS GLOBALES (hacer primero, antes de procesar ítems)
1. SUMA_NETO_ITEMS = Sumar columna "SUBTOTAL" de todos los artículos
2. SUMA_NETO_MAS_IMP_INT_ITEMS = Sumar (SUBTOTAL + I.INTERNOS) de todos los artículos
3. porc_iibb_caba = IB_CAP_FED_TOTAL / SUMA_NETO_ITEMS
4. porc_iibb_reg_3337 = PERC_RG_3337_TOTAL / SUMA_NETO_MAS_IMP_INT_ITEMS

PASO 2: PROCESAMIENTO POR ÍTEM
Para CADA artículo en la tabla, extraer y calcular:

A. EXTRACCIÓN DIRECTA:
- Codigo: De columna CODIGO (ej: "2843", "194904")
- Descripcion: De columna PRODUCTO (ej: "CC80 600CCX6.")
- producto: Igual que Descripcion
- bulto: De columna CANTIDAD (ej: 2016, 1)
- Cantidad: Igual que bulto
- px_bulto: De columna P.UNITARIO (convertir a entero sin decimales)
- PrecioUnitario: Igual que px_bulto
- desc: De columna DESCUENTO (convertir a entero)
- neto: De columna SUBTOTAL (primer subtotal, convertir a entero)
- Subtotal: Igual que neto
- imp_int: De columna I.INTERNOS (convertir a entero)
- iva_21: De columna IVA 21% (convertir a entero)

B. CÁLCULOS POR ÍTEM:
- total = bulto * px_bulto (entero)
- porc_desc = desc / total (si total es 0, devolver null)
- neto_mas_imp_int = neto + imp_int

C. PRORRATEO DE IMPUESTOS:
- iibb_caba = neto * porc_iibb_caba (redondear a entero)
- iibb_reg_3337 = neto_mas_imp_int * porc_iibb_reg_3337 (redondear a entero)

D. TOTALIZACIÓN FINAL:
- total_final = neto_mas_imp_int + iva_21 + iibb_caba + iibb_reg_3337
- costo_x_bulto = total_final / bulto (redondear a entero)

CASOS ESPECIALES:
- Incluir "Servicios Administrativos" si tiene código y valores numéricos
- Ignorar totales del pie, encabezados, sellos manuscritos
- NO incluir líneas de resumen (TOT BULTOS/UNID., etc.)
- Mantener orden exacto de aparición

SALIDA:
JSON con "invoice_number", "invoice_total" y "items".

CRÍTICO - invoice_total:
- Buscar el texto "IMP.TOTAL" o "IMPORTE TOTAL" en el pie de la factura
- Es el valor que aparece después de sumar todos los impuestos
- Está marcado claramente como "IMP.TOTAL $" seguido del número
- Convertir a entero sin decimales
- Si no encuentras este valor, busca el último total después de "TRANSFERENCIA BANCO"

Ejemplo de estructura (con valores reales basados en la imagen):
{
  "invoice_number": "0607-00375731",
  "invoice_total": 8708199,
  "items": [
    {
      "Codigo": "2843",
      "Descripcion": "CC80 600CCX6.",
      "Cantidad": 2016,
      "PrecioUnitario": 8581,
      "Subtotal": 7092637,
      "bulto": 2016,
      "px_bulto": 8581,
      "desc": 914935,
      "neto": 7092637,
      "imp_int": 79563,
      "iva_21": 192136,
      "total": 17299296,
      "porc_desc": 0.0529,
      "neto_mas_imp_int": 7172200,
      "iibb_caba": 14863,
      "iibb_reg_3337": 1000,
      "total_final": 7380199,
      "costo_x_bulto": 3661
    }
  ]
}
"""
