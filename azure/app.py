# app.py
# -*- coding: utf-8 -*-
"""
Interfaz web con Streamlit para extracción de datos de facturas.
Incluye extractor general y extractor especializado de Coca-Cola FEMSA.

Uso:
    streamlit run app.py
"""

import io
import os
import sys
import time
import json
import re
import importlib
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
from PIL import Image

import streamlit as st
import pandas as pd
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

# Importar módulos del proyecto
from config import (
    AZURE_ENDPOINT,
    AZURE_KEY,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    ALLOWED_MIME_TYPES,
)
from logger import get_logger
from connect_gemini import model
from test import _unwrap_azure_num

# Configurar logger
logger = get_logger(__name__)

# Configuración de la página
st.set_page_config(
    page_title="Extractor de Facturas - Gastro",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Estilos CSS personalizados
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 2rem;
        font-weight: bold;
    }
    .coca-cola-header {
        font-size: 2.8rem;
        color: #F40009;
        text-align: center;
        margin-bottom: 2rem;
        font-weight: 900;
        text-shadow: 3px 3px 6px rgba(0,0,0,0.2);
        letter-spacing: 1px;
    }
    .info-box {
        background-color: #e3f2fd;
        padding: 1.2rem;
        border-radius: 0.8rem;
        border-left: 5px solid #2196f3;
        margin: 1rem 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .success-box {
        background-color: #e8f5e9;
        padding: 1.2rem;
        border-radius: 0.8rem;
        border-left: 5px solid #4caf50;
        margin: 1rem 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .error-box {
        background-color: #ffebee;
        padding: 1.2rem;
        border-radius: 0.8rem;
        border-left: 5px solid #f44336;
        margin: 1rem 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .coca-cola-box {
        background: linear-gradient(135deg, #F40009 0%, #DC0000 50%, #C00000 100%);
        padding: 2rem;
        border-radius: 1.2rem;
        color: white;
        margin: 1.5rem 0;
        box-shadow: 0 6px 12px rgba(244,0,9,0.3);
    }
    .coca-cola-box h3 {
        color: white !important;
        margin: 0;
        font-size: 1.8rem;
        font-weight: 900;
    }
    .coca-cola-box p {
        color: white !important;
        margin: 0.8rem 0 0 0;
        font-size: 1.1rem;
    }
    .stButton>button {
        width: 100%;
        background-color: #1f77b4;
        color: white;
        font-weight: bold;
        border-radius: 0.8rem;
        padding: 0.7rem 1.2rem;
        transition: all 0.3s;
    }
    .stButton>button:hover {
        background-color: #1565c0;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    .coca-cola-button button {
        background: linear-gradient(135deg, #F40009 0%, #DC0000 100%) !important;
        color: white !important;
        font-weight: 900 !important;
        border: none !important;
        font-size: 1.1rem !important;
        padding: 1rem 1.5rem !important;
    }
    .coca-cola-button button:hover {
        background: linear-gradient(135deg, #DC0000 0%, #A00000 100%) !important;
        box-shadow: 0 6px 12px rgba(244,0,9,0.4) !important;
        transform: translateY(-2px) !important;
    }
    div[data-testid="stMetricValue"] {
        font-size: 1.8rem;
        font-weight: bold;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 2rem;
        background-color: #f5f5f5;
        padding: 1rem;
        border-radius: 0.5rem;
    }
    .stTabs [data-baseweb="tab"] {
        padding: 1rem 2rem;
        font-size: 1.2rem;
        font-weight: 700;
        border-radius: 0.5rem;
    }
    .stTabs [aria-selected="true"] {
        background-color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .stat-card {
        background: white;
        padding: 1.5rem;
        border-radius: 1rem;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        text-align: center;
        margin: 0.5rem;
    }
</style>
""", unsafe_allow_html=True)


def extract_items_azure(file_bytes: bytes) -> List[Dict]:
    """
    Extrae items usando Azure Document Intelligence (modelo prebuilt-invoice).

    Args:
        file_bytes: Contenido del archivo en bytes

    Returns:
        Lista de ítems extraídos
    """
    client = DocumentAnalysisClient(
        endpoint=AZURE_ENDPOINT,
        credential=AzureKeyCredential(AZURE_KEY)
    )

    poller = client.begin_analyze_document(
        model_id="prebuilt-invoice",
        document=file_bytes
    )
    result = poller.result()

    items = []
    for doc in result.documents:
        items_field = doc.fields.get("Items")
        if not items_field or not items_field.value:
            continue

        for it in items_field.value:
            flds = it.value or {}
            def v(name: str):
                fld = flds.get(name)
                return getattr(fld, "value", None) if fld else None

            qty = _unwrap_azure_num(v("Quantity"))
            unit_price = _unwrap_azure_num(v("UnitPrice"))
            amount = _unwrap_azure_num(v("Amount"))
            subtotal = amount if amount is not None else (
                qty * unit_price if (qty is not None and unit_price is not None) else None
            )

            items.append({
                "Codigo": v("ProductCode"),
                "Descripcion": v("Description"),
                "Cantidad": qty,
                "PrecioUnitario": unit_price,
                "Subtotal": subtotal,
            })

    return items


def extract_items_cocacola(file_bytes: bytes, filename: str) -> Dict:
    """
    Extrae items de facturas de Coca-Cola FEMSA usando el plugin específico + Gemini.

    Args:
        file_bytes: Contenido del archivo
        filename: Nombre del archivo

    Returns:
        Dict con {"items": lista de ítems, "invoice_total": total de factura, "invoice_number": número de factura}
    """
    try:
        # Cargar plugin de Coca-Cola
        coca_module = importlib.import_module("proveedores.CocaCola")
        prompt = getattr(coca_module, "PROMPT", "")

        if not prompt:
            raise ValueError("No se encontró el prompt de Coca-Cola")

        logger.info(f"Procesando factura Coca-Cola: {filename}")

        # Intentar cargar como imagen
        try:
            image = Image.open(io.BytesIO(file_bytes))
            logger.info("Archivo cargado como imagen")

            # Llamar a Gemini con imagen
            response = model.generate_content([prompt, image])
            response_text = response.text.strip()

        except Exception as img_error:
            logger.warning(f"No se pudo cargar como imagen: {img_error}")
            # Si es PDF, usar Azure para OCR
            client = DocumentAnalysisClient(
                endpoint=AZURE_ENDPOINT,
                credential=AzureKeyCredential(AZURE_KEY)
            )
            poller = client.begin_analyze_document(
                model_id="prebuilt-layout",
                document=file_bytes
            )
            result = poller.result()

            # Extraer texto completo del documento
            full_text = result.content if hasattr(result, 'content') else ""

            # Si no hay content, extraer de las líneas de cada página
            if not full_text:
                full_text = "\n".join([
                    line.content
                    for page in result.pages
                    for line in page.lines
                ])

            prompt_with_text = f"{prompt}\n\nTEXTO EXTRAÍDO:\n{full_text}"

            # Llamar a Gemini solo con texto
            response = model.generate_content(prompt_with_text)
            response_text = response.text.strip()

        # Limpiar respuesta (quitar ```json si existe)
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        # Parsear JSON
        result = json.loads(response_text)

        # Manejar ambos formatos: nuevo (con invoice_total) y antiguo (solo lista)
        if isinstance(result, dict) and "items" in result:
            items = result["items"]
            invoice_total = result.get("invoice_total", None)
            invoice_number = result.get("invoice_number", None)
        elif isinstance(result, list):
            items = result
            invoice_total = None
            invoice_number = None
        else:
            raise ValueError("La respuesta no tiene el formato esperado")

        if not isinstance(items, list):
            raise ValueError("Los items no son una lista")

        logger.info(f"Extracción exitosa: {len(items)} productos detectados")

        # Retornar items, total y número de factura
        return {
            "items": items,
            "invoice_total": invoice_total,
            "invoice_number": invoice_number
        }

    except json.JSONDecodeError as je:
        logger.error(f"Error parseando JSON: {je}")
        logger.error(f"Respuesta recibida: {response_text[:500]}")
        raise ValueError(f"Error al parsear respuesta de IA: {str(je)}")
    except Exception as e:
        logger.error(f"Error en extracción Coca-Cola: {e}", exc_info=True)
        raise e


def process_single_file_general(file_bytes: bytes, filename: str) -> tuple[List[Dict], str]:
    """
    Procesa un archivo con el extractor general (Azure).

    Args:
        file_bytes: Contenido del archivo en bytes
        filename: Nombre del archivo

    Returns:
        Tupla de (items, método_usado)
    """
    try:
        items = extract_items_azure(file_bytes)
        return items, "Azure Document Intelligence"
    except Exception as e:
        logger.error(f"Error procesando {filename}: {e}")
        raise e


def create_excel_download(items: List[Dict], filename_prefix: str = "facturas") -> bytes:
    """
    Crea un archivo Excel con los ítems extraídos.

    Args:
        items: Lista de ítems extraídos
        filename_prefix: Prefijo para el nombre del archivo

    Returns:
        Bytes del archivo Excel
    """
    df = pd.DataFrame(items)

    # Crear Excel en memoria
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Items')

        # Ajustar ancho de columnas
        worksheet = writer.sheets['Items']
        for idx, col in enumerate(df.columns, 1):
            max_length = max(
                df[col].astype(str).apply(len).max(),
                len(col)
            )
            worksheet.column_dimensions[chr(64 + idx)].width = min(max_length + 2, 50)

    output.seek(0)
    return output.getvalue()


def render_general_tab():
    """Renderiza la pestaña de extracción general."""

    st.markdown('<h1 class="main-header">📄 Extractor General de Facturas</h1>', unsafe_allow_html=True)
    st.markdown("---")

    # Sidebar - Información
    with st.sidebar:
        st.header("📋 Formatos Soportados")
        st.write("- 📷 Imágenes: JPG, JPEG, PNG")
        st.write("- 📄 Documentos: PDF")

        st.markdown("---")

        st.info("💡 Arrastra tus facturas o haz clic para seleccionarlas")

    # Área principal
    col1, col2 = st.columns([2, 1])

    with col1:
        st.header("📤 Cargar Facturas")

        # Modo de carga
        upload_mode = st.radio(
            "Selecciona el modo de carga:",
            ["Archivo único", "Múltiples archivos"],
            horizontal=True,
            key="upload_mode_general"
        )

        if upload_mode == "Archivo único":
            uploaded_file = st.file_uploader(
                "Arrastra tu factura aquí o haz clic para seleccionar",
                type=['jpg', 'jpeg', 'png', 'pdf'],
                help="Formatos soportados: JPG, PNG, PDF",
                key="general_single"
            )
            uploaded_files = [uploaded_file] if uploaded_file else []
        else:
            uploaded_files = st.file_uploader(
                "Arrastra tus facturas aquí o haz clic para seleccionar",
                type=['jpg', 'jpeg', 'png', 'pdf'],
                accept_multiple_files=True,
                help="Formatos soportados: JPG, PNG, PDF",
                key="general_multiple"
            )

    with col2:
        st.header("📊 Estadísticas")

        if uploaded_files and any(uploaded_files):
            st.metric("Archivos cargados", len([f for f in uploaded_files if f]))
            total_size = sum(f.size for f in uploaded_files if f) / 1024  # KB
            st.metric("Tamaño total", f"{total_size:.1f} KB")
        else:
            st.info("No hay archivos cargados")

    # Procesar archivos
    if uploaded_files and any(uploaded_files):
        st.markdown("---")

        if st.button("🚀 Procesar Facturas", type="primary", key="process_general"):
            all_items = []

            # Barra de progreso
            progress_bar = st.progress(0)
            status_text = st.empty()

            # Contenedor para resultados
            results_container = st.container()

            valid_files = [f for f in uploaded_files if f]

            for idx, uploaded_file in enumerate(valid_files):
                progress = (idx + 1) / len(valid_files)
                progress_bar.progress(progress)
                status_text.text(f"Procesando: {uploaded_file.name} ({idx + 1}/{len(valid_files)})")

                try:
                    # Leer bytes del archivo
                    file_bytes = uploaded_file.read()

                    # Procesar archivo
                    with st.spinner(f"Analizando {uploaded_file.name}..."):
                        items, method = process_single_file_general(file_bytes, uploaded_file.name)

                    # Agregar nombre de archivo a cada ítem
                    for item in items:
                        item['Archivo'] = uploaded_file.name

                    all_items.extend(items)

                    # Mostrar resultado individual
                    with results_container:
                        with st.expander(f"✅ {uploaded_file.name} - {len(items)} ítems extraídos"):
                            if items:
                                df_preview = pd.DataFrame(items)
                                st.dataframe(df_preview, use_container_width=True)
                            else:
                                st.warning("No se encontraron ítems en este archivo")

                except Exception as e:
                    with results_container:
                        st.error(f"❌ Error en {uploaded_file.name}: {str(e)}")
                    logger.error(f"Error procesando {uploaded_file.name}: {e}", exc_info=True)

            # Limpiar barra de progreso
            progress_bar.empty()
            status_text.empty()

            # Mostrar resultados finales
            st.markdown("---")
            st.header("📊 Resultados Finales")

            if all_items:
                st.success(f"✅ Procesamiento completado: {len(all_items)} ítems extraídos de {len(valid_files)} archivos")

                # DataFrame completo
                df_final = pd.DataFrame(all_items)

                # Mostrar tabla
                st.subheader("📋 Vista Previa de Datos")
                st.dataframe(df_final, use_container_width=True, height=400)

                # Estadísticas
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("Total Ítems", len(df_final))
                with col2:
                    st.metric("Total Facturas", df_final['Archivo'].nunique())
                with col3:
                    if 'Subtotal' in df_final.columns:
                        total_amount = df_final['Subtotal'].sum()
                        st.metric("Total $", f"${total_amount:,.2f}")
                with col4:
                    avg_items = len(df_final) / df_final['Archivo'].nunique()
                    st.metric("Promedio ítems/factura", f"{avg_items:.1f}")

                # Botón de descarga
                st.markdown("---")
                st.subheader("💾 Descargar Resultados")

                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"facturas_extraidas_{timestamp}.xlsx"

                excel_bytes = create_excel_download(all_items, "facturas")

                st.download_button(
                    label="📥 Descargar Excel",
                    data=excel_bytes,
                    file_name=filename,
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    type="primary",
                    key="download_general"
                )

                st.success(f"✅ Archivo listo para descargar: {filename}")
            else:
                st.warning("⚠️ No se pudieron extraer ítems de los archivos procesados")

    else:
        # Mensaje de bienvenida
        st.info("👋 ¡Bienvenido al Extractor General de Facturas!")

        st.markdown("""
        Este sistema utiliza **inteligencia artificial** para extraer automáticamente los datos de tus facturas.
        """)

        st.markdown("### 📝 Pasos para comenzar:")

        st.markdown("""
        1. **Selecciona el modo de carga** (único o múltiple)
        2. **Arrastra o selecciona** tus archivos de factura
        3. **Haz clic** en "Procesar Facturas"
        4. **Revisa los resultados** y descarga el Excel generado
        """)

        st.markdown("---")
        col1, col2, col3 = st.columns(3)
        with col1:
            st.success("✅ Imágenes claras")
        with col2:
            st.success("✅ JPG, PNG, PDF")
        with col3:
            st.success("✅ Campos definidos")


def render_cocacola_tab():
    """Renderiza la pestaña especializada de Coca-Cola FEMSA."""

    st.markdown('<h1 class="coca-cola-header">🥤 COCA-COLA FEMSA</h1>', unsafe_allow_html=True)

    # Banner informativo
    st.markdown("""
    <div class="coca-cola-box">
        <h3>🎯 Extracción Especializada de Alta Precisión</h3>
        <p>
        <b>Coca-Cola FEMSA de Buenos Aires S.A.</b><br>
        Sistema inteligente con 18 campos de datos incluyendo cálculos automáticos de costeo,
        impuestos (IIBB CABA, IIBB RG 3337), IVA 21%, Impuestos Internos y análisis financiero completo.
        </p>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("---")

    # Información en sidebar
    with st.sidebar:
        st.header("📋 Campos Extraídos (18)")

        with st.expander("📦 Datos Básicos", expanded=True):
            st.markdown("""
            - Código de Producto
            - Descripción
            - Cantidad / Bultos
            """)

        with st.expander("💵 Precios y Descuentos"):
            st.markdown("""
            - Precio Unitario
            - Precio por Bulto
            - Descuento ($)
            - % Descuento
            """)

        with st.expander("💰 Subtotales"):
            st.markdown("""
            - Neto
            - Subtotal
            - Neto + Imp. Internos
            - Total
            """)

        with st.expander("📊 Impuestos"):
            st.markdown("""
            - IVA 21%
            - Impuestos Internos
            - IIBB CABA
            - IIBB RG 3337
            """)

        with st.expander("🎯 Análisis Final"):
            st.markdown("""
            - **Total Final**
            - **Costo por Bulto**
            """)

    # Área principal
    col1, col2 = st.columns([2, 1])

    with col1:
        st.header("📤 Cargar Facturas Coca-Cola")

        uploaded_files = st.file_uploader(
            "Arrastra tus facturas de Coca-Cola FEMSA aquí",
            type=['jpg', 'jpeg', 'png', 'pdf'],
            accept_multiple_files=True,
            help="Soporta imágenes y PDFs de facturas Coca-Cola FEMSA",
            key="cocacola_uploader"
        )

    with col2:
        st.header("📊 Info de Archivos")

        if uploaded_files:
            st.metric("Archivos", len(uploaded_files))
            total_size = sum(f.size for f in uploaded_files) / 1024
            st.metric("Tamaño Total", f"{total_size:.1f} KB")
        else:
            st.info("📂 Sin archivos cargados")

    # Procesar archivos
    if uploaded_files:
        st.markdown("---")

        # Botón con estilo Coca-Cola
        col_btn1, col_btn2, col_btn3 = st.columns([1, 2, 1])
        with col_btn2:
            st.markdown('<div class="coca-cola-button">', unsafe_allow_html=True)
            process_button = st.button(
                f"🚀 PROCESAR {len(uploaded_files)} FACTURA(S) COCA-COLA",
                type="primary",
                use_container_width=True,
                key="process_cocacola"
            )
            st.markdown('</div>', unsafe_allow_html=True)

        if process_button:
            all_items = []
            all_validations = []

            # Barra de progreso
            progress_bar = st.progress(0)
            status_text = st.empty()

            for idx, uploaded_file in enumerate(uploaded_files):
                progress = (idx + 1) / len(uploaded_files)
                progress_bar.progress(progress)
                status_text.text(f"Procesando: {uploaded_file.name} ({idx + 1}/{len(uploaded_files)})")

                try:
                    # Leer bytes
                    file_bytes = uploaded_file.read()

                    # Procesar
                    with st.spinner(f"🔍 Analizando {uploaded_file.name}..."):
                        result = extract_items_cocacola(file_bytes, uploaded_file.name)

                    # Extraer items, total y número de factura
                    items = result.get("items", [])
                    invoice_total = result.get("invoice_total", None)
                    invoice_number = result.get("invoice_number", uploaded_file.name)  # Fallback al nombre de archivo

                    if items:
                        # Agregar número de factura a cada item
                        for item in items:
                            item['Nro_Factura'] = invoice_number

                        all_items.extend(items)

                        # Guardar validación
                        if 'total_final' in items[0]:
                            calculated_total = sum(item.get('total_final', 0) for item in items)
                            all_validations.append({
                                'Factura': invoice_number,  # Usar número de factura real
                                'Total_Papel': invoice_total,
                                'Total_Calculado': calculated_total,
                                'Diferencia': calculated_total - invoice_total if invoice_total else None
                            })

                except Exception as e:
                    st.error(f"❌ Error en {uploaded_file.name}: {str(e)}")

            # Limpiar barra de progreso
            progress_bar.empty()
            status_text.empty()

            if all_items:
                st.markdown("---")
                st.success(f"✅ Procesamiento completado: {len(all_items)} productos extraídos de {len(uploaded_files)} factura(s)")

                # Función para extraer cantidad del paquete desde descripción
                import re
                def extract_package_quantity(descripcion):
                    """Extrae la cantidad de unidades por paquete desde la descripción.
                    Ejemplo: 'CC80 600CCX6' -> 6, 'FN 500X12' -> 12
                    """
                    if not descripcion or not isinstance(descripcion, str):
                        return None
                    match = re.search(r'X(\d+)', descripcion, re.IGNORECASE)
                    if match:
                        return int(match.group(1))
                    return None

                # Agregar columna de Costo Unitario a cada item
                for item in all_items:
                    desc = item.get('Descripcion', '')
                    qty_package = extract_package_quantity(desc)
                    costo_bulto = item.get('costo_x_bulto')

                    if qty_package and costo_bulto and qty_package > 0:
                        item['costo_unitario'] = round(costo_bulto / qty_package, 2)
                    else:
                        item['costo_unitario'] = None

                # Convertir a DataFrame
                df = pd.DataFrame(all_items)

                # VALIDACIÓN: Tabla comparativa por factura
                if all_validations:
                    st.markdown("---")
                    st.subheader("✅ Validación de Totales por Factura")

                    df_val = pd.DataFrame(all_validations)

                    # Añadir columnas de diferencia y estado
                    df_val['Diferencia_Abs'] = df_val.apply(
                        lambda row: abs(row['Diferencia']) if pd.notna(row['Diferencia']) else None,
                        axis=1
                    )

                    def get_status(diff):
                        if pd.isna(diff):
                            return "Sin validación"
                        elif abs(diff) <= 50:
                            return "✅ Exacto"
                        elif abs(diff) <= 100:
                            return "✅ OK"
                        elif abs(diff) <= 500:
                            return "⚠️ Revisar"
                        else:
                            return "❌ Error"

                    df_val['Estado'] = df_val['Diferencia'].apply(get_status)

                    # Formatear para display
                    df_val_display = df_val.copy()
                    df_val_display['Total_Papel'] = df_val_display['Total_Papel'].apply(
                        lambda x: f"${int(x):,}" if pd.notna(x) else "N/A"
                    )
                    df_val_display['Total_Calculado'] = df_val_display['Total_Calculado'].apply(
                        lambda x: f"${int(x):,}" if pd.notna(x) else "N/A"
                    )
                    df_val_display['Diferencia'] = df_val_display['Diferencia'].apply(
                        lambda x: f"${int(x):,}" if pd.notna(x) else "N/A"
                    )

                    # Seleccionar columnas para mostrar
                    df_val_display = df_val_display[['Factura', 'Total_Papel', 'Total_Calculado', 'Diferencia', 'Estado']]

                    st.dataframe(df_val_display, use_container_width=True)

                # Tabla detallada de productos
                st.markdown("---")
                st.subheader("📋 Detalle Completo de Productos")

                # Formatear columnas numéricas para display
                df_display = df.copy()

                # Mapeo de columnas más amigable (incluye Nro_Factura y costo_unitario)
                column_mapping = {
                    'Nro_Factura': 'Nro. Factura',
                    'Codigo': 'Código',
                    'Descripcion': 'Descripción',
                    'Cantidad': 'Cant.',
                    'PrecioUnitario': 'P.Unit.',
                    'Subtotal': 'Subtotal',
                    'bulto': 'Bultos',
                    'px_bulto': 'P/Bulto',
                    'desc': 'Desc.',
                    'neto': 'Neto',
                    'imp_int': 'Imp.Int.',
                    'iva_21': 'IVA 21%',
                    'total': 'Total',
                    'porc_desc': '%Desc',
                    'neto_mas_imp_int': 'Neto+II',
                    'iibb_caba': 'IIBB CABA',
                    'iibb_reg_3337': 'IIBB 3337',
                    'total_final': 'Total Final',
                    'costo_x_bulto': 'Costo/Bulto',
                    'costo_unitario': 'Costo Unitario'
                }

                df_display = df_display.rename(columns=column_mapping)

                # Formatear números con punto decimal (ej: 4.535)
                numeric_cols = ['Cant.', 'P.Unit.', 'Subtotal', 'Bultos', 'P/Bulto',
                               'Desc.', 'Neto', 'Imp.Int.', 'IVA 21%', 'Total', 'Neto+II',
                               'IIBB CABA', 'IIBB 3337', 'Total Final', 'Costo/Bulto']

                for col in numeric_cols:
                    if col in df_display.columns:
                        df_display[col] = df_display[col].apply(
                            lambda x: f"{int(x):,.0f}".replace(",", ".") if pd.notna(x) and x != 0 else "-"
                        )

                # Formatear Costo Unitario con 2 decimales
                if 'Costo Unitario' in df_display.columns:
                    df_display['Costo Unitario'] = df_display['Costo Unitario'].apply(
                        lambda x: f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if pd.notna(x) else "-"
                    )

                if '%Desc' in df_display.columns:
                    df_display['%Desc'] = df_display['%Desc'].apply(
                        lambda x: f"{float(x)*100:.2f}%" if pd.notna(x) else "-"
                    )

                # Mostrar tabla con scroll
                st.dataframe(
                    df_display,
                    use_container_width=True,
                    height=500
                )

                # Botón de descarga
                st.markdown("---")
                st.subheader("💾 Descargar Resultados")

                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"cocacola_facturas_{timestamp}.xlsx"

                excel_bytes = create_excel_download(all_items, "cocacola")

                col_dl1, col_dl2, col_dl3 = st.columns([1, 2, 1])
                with col_dl2:
                    st.download_button(
                        label="📥 Descargar Excel Completo",
                        data=excel_bytes,
                        file_name=filename,
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        type="primary",
                        use_container_width=True,
                        key="download_cocacola"
                    )

                st.success(f"✅ Archivo Excel generado: {filename}")

            else:
                st.warning("⚠️ No se pudieron extraer ítems de las facturas")
                st.info("Verifica que los archivos sean facturas de Coca-Cola FEMSA con la estructura esperada.")

    else:
        # Mensaje de bienvenida
        st.markdown("---")

        col_welcome1, col_welcome2 = st.columns([1, 1])

        with col_welcome1:
            st.info("👋 ¡Bienvenido al Extractor Especializado de Coca-Cola FEMSA!")

            st.markdown("""
            ### 🎯 Características Especiales:

            - ✅ **18 campos de datos** extraídos automáticamente
            - ✅ **Cálculos automáticos** de impuestos y costos
            - ✅ **Prorrateo preciso** de IIBB CABA y RG 3337
            - ✅ **Análisis financiero** completo por producto
            - ✅ **Costo por bulto** calculado automáticamente
            - ✅ **Presión fiscal** y rentabilidad
            """)

        with col_welcome2:
            st.markdown("""
            ### 📝 Pasos para usar:

            1. **Carga tu factura** de Coca-Cola FEMSA (imagen o PDF)
            2. **Haz clic** en "Procesar Factura Coca-Cola"
            3. **Revisa** el análisis detallado con gráficos
            4. **Descarga** el Excel con todos los datos

            ### ✅ Formato Esperado:

            Facturas de **Coca-Cola FEMSA de Buenos Aires S.A.** con:

            - Tabla de productos con cantidad, código, descripción
            - Precio unitario, descuento, subtotal
            - IVA 21%, Impuestos Internos
            - Pie con IIBB (IB.DN) y total
            """)


def main():
    """Función principal de la aplicación."""

    # Header principal
    st.markdown("# 🏢 Sistema de Gestión de Facturas")
    st.markdown("### 🤖 Plataforma de Extracción Inteligente con IA")
    st.markdown("---")

    # Tabs principales
    tab1, tab2 = st.tabs([
        "📄 Extractor General",
        "🥤 Coca-Cola FEMSA"
    ])

    with tab1:
        render_general_tab()

    with tab2:
        render_cocacola_tab()

    # Footer
    st.markdown("---")
    st.markdown("""
    <div style="text-align: center; color: #666; font-size: 0.9rem; padding: 1rem;">
        <p style="margin: 0.5rem 0;">💡 <b>Consejo:</b> Para mejores resultados, asegúrate de que las facturas sean legibles y estén bien iluminadas.</p>
        <p style="margin: 0.5rem 0;">🔧 Desarrollado con <b>Azure Document Intelligence</b> y <b>Google Gemini AI</b></p>
        <p style="margin: 0.5rem 0; color: #999;">v2.0.0 | Sistema de Gestión Gastro</p>
    </div>
    """, unsafe_allow_html=True)


if __name__ == "__main__":
    main()