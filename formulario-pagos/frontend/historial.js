// Elementos del DOM
const usernameDisplay = document.getElementById('username');
const searchInput = document.getElementById('searchInput');
const filterFechaPagoDesde = document.getElementById('filterFechaPagoDesde');
const filterFechaPagoHasta = document.getElementById('filterFechaPagoHasta');
const filterFechaServicioDesde = document.getElementById('filterFechaServicioDesde');
const filterFechaServicioHasta = document.getElementById('filterFechaServicioHasta');
const filterLocal = document.getElementById('filterLocal');
const filterUsuario = document.getElementById('filterUsuario');
const filterConcepto = document.getElementById('filterConcepto');
const loadingSpinner = document.getElementById('loadingSpinner');
const noDataMessage = document.getElementById('noDataMessage');
const pagosTable = document.getElementById('pagosTable');
const pagosTableBody = document.getElementById('pagosTableBody');
const totalRegistrosEl = document.getElementById('totalRegistros');
const importeTotalEl = document.getElementById('importeTotal');

// Variable para almacenar todos los pagos
let allPagos = [];
let filteredPagos = [];
let currentUser = null;

// Verificar autenticación al cargar
window.addEventListener('load', async () => {
  try {
    const response = await fetch('/api/check-auth', {
      credentials: 'include'
    });
    const data = await response.json();

    if (!data.authenticated) {
      window.location.href = '/login';
      return;
    }

    usernameDisplay.textContent = data.user.username;
    currentUser = data.user.username;

    // Cargar los pagos
    await loadPagos();
  } catch (error) {
    console.error('Error al verificar autenticación:', error);
    window.location.href = '/login';
  }
});

// Función de logout
async function logout() {
  try {
    const response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include'
    });

    const data = await response.json();

    if (data.success) {
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    window.location.href = '/login';
  }
}

// Cargar pagos desde la API
async function loadPagos() {
  try {
    loadingSpinner.style.display = 'block';
    noDataMessage.style.display = 'none';
    pagosTable.style.display = 'none';

    const response = await fetch('/api/pagos', {
      credentials: 'include'
    });

    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }

    const data = await response.json();

    if (data.success && data.data) {
      allPagos = data.data;
      filteredPagos = allPagos;

      if (allPagos.length === 0) {
        showNoData();
      } else {
        populateFilters();
        renderPagos(filteredPagos);
        updateStats(filteredPagos);
      }
    } else {
      showNoData();
    }
  } catch (error) {
    console.error('Error al cargar pagos:', error);
    showNoData();
  } finally {
    loadingSpinner.style.display = 'none';
  }
}

// Mostrar mensaje de sin datos
function showNoData() {
  loadingSpinner.style.display = 'none';
  noDataMessage.style.display = 'block';
  pagosTable.style.display = 'none';
  totalRegistrosEl.textContent = '0';
  importeTotalEl.textContent = '$0.00';
}

// Obtener importe del pago (ahora está directo en la tabla pagos)
function obtenerImportePago(pago) {
  // Si tiene el campo importe directamente, usarlo
  if (pago.importe !== undefined && pago.importe !== null) {
    return parseFloat(pago.importe) || 0;
  }
  // Fallback para compatibilidad con formato antiguo de items
  if (pago.items && pago.items.length > 0) {
    return pago.items.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0);
  }
  return 0;
}

// Renderizar tabla de pagos
function renderPagos(pagos) {
  if (pagos.length === 0) {
    showNoData();
    return;
  }

  pagosTable.style.display = 'table';
  noDataMessage.style.display = 'none';

  pagosTableBody.innerHTML = '';

  pagos.forEach(pago => {
    // Obtener importe del pago
    const totalPago = obtenerImportePago(pago);

    // Verificar si tiene concepto (formato nuevo) o items (formato antiguo)
    const tieneConcepto = pago.concepto && pago.concepto.trim() !== '';
    const tieneItems = pago.items && pago.items.length > 0;
    const cantidadItems = tieneItems ? pago.items.length : (tieneConcepto ? 1 : 0);

    // Crear fila principal
    const row = document.createElement('tr');
    row.className = 'pago-row';
    row.setAttribute('data-pago-id', pago.id);

    const expandIcon = cantidadItems > 0 ?
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="expand-icon"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' :
      '';

    // Determinar si el usuario puede editar el campo OP
    const canEditOP = currentUser === 'Julian Salvatierra';
    const opValue = pago.op || '';

    let opCell = '';
    if (canEditOP) {
      opCell = `
        <input
          type="text"
          class="op-input"
          data-pago-id="${pago.id}"
          value="${opValue}"
          placeholder="Nº OP"
          maxlength="10"
          style="width: 80px; text-align: center; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px;"
        >
        <button
          class="btn-save-op"
          data-pago-id="${pago.id}"
          style="margin-left: 4px; padding: 4px 8px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
        >
          ✓
        </button>
      `;
    } else {
      opCell = `<span style="color: #6b7280;">${opValue || '-'}</span>`;
    }

    row.innerHTML = `
      <td style="text-align: center; cursor: ${cantidadItems > 0 ? 'pointer' : 'default'};">
        ${expandIcon}
      </td>
      <td>${pago.id}</td>
      <td>${formatDate(pago.fecha_pago || pago.fecha)}</td>
      <td>${formatDate(pago.fecha_servicio || pago.fecha)}</td>
      <td>${pago.local}</td>
      <td>${pago.moneda || 'N/A'}</td>
      <td style="text-align: center;">
        <span class="badge-items">${cantidadItems}</span>
      </td>
      <td class="importe-cell">$${totalPago.toFixed(2)}</td>
      <td style="text-align: center;">${opCell}</td>
      <td>${pago.usuario_registro}</td>
    `;

    // Si tiene items o concepto, hacer la fila expandible
    if (cantidadItems > 0) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => toggleExpandRow(pago.id));
    }

    pagosTableBody.appendChild(row);

    // Agregar event listener para el botón de guardar OP (si existe)
    if (canEditOP) {
      const saveButton = row.querySelector('.btn-save-op');
      if (saveButton) {
        saveButton.addEventListener('click', (e) => {
          e.stopPropagation();
          saveOP(pago.id);
        });
      }
    }

    // Crear fila de detalles (oculta por defecto)
    if (cantidadItems > 0) {
      const detailRow = document.createElement('tr');
      detailRow.className = 'detail-row';
      detailRow.setAttribute('data-pago-id', pago.id);
      detailRow.style.display = 'none';

      let itemsHTML = '';

      // Si tiene items (formato antiguo)
      if (tieneItems) {
        pago.items.forEach((item) => {
          itemsHTML += `
            <tr>
              <td>${item.concepto}</td>
              <td>$${parseFloat(item.importe).toFixed(2)}</td>
              <td>${item.observacion || '-'}</td>
            </tr>
          `;
        });
      }
      // Si tiene concepto directo (formato nuevo)
      else if (tieneConcepto) {
        itemsHTML = `
          <tr>
            <td>${pago.concepto}</td>
            <td>$${totalPago.toFixed(2)}</td>
            <td>${pago.observacion || '-'}</td>
          </tr>
        `;
      }

      // Generar HTML de archivos adjuntos si existen
      let archivosHTML = '';
      if (pago.archivos_urls) {
        let archivos = [];

        try {
          // Parsear archivos_urls (puede ser string JSON o array)
          if (typeof pago.archivos_urls === 'string') {
            archivos = JSON.parse(pago.archivos_urls);
          } else if (Array.isArray(pago.archivos_urls)) {
            archivos = pago.archivos_urls;
          }

          if (archivos.length > 0) {
            archivosHTML = `
              <div class="archivos-section">
                <h5 style="margin: 0 0 10px 0; color: #4f46e5; font-size: 14px;">
                  📎 Archivos Adjuntos (${archivos.length})
                </h5>
                <div class="archivos-list">
                  ${archivos.map(archivo => {
                    const icono = archivo.mimeType === 'application/pdf' ? '📄' : '🖼️';
                    const sizeKB = archivo.size ? (archivo.size / 1024).toFixed(2) : 'N/A';
                    return `
                      <div class="archivo-item">
                        <span class="archivo-icon">${icono}</span>
                        <a href="${archivo.url}" target="_blank" class="archivo-link">
                          ${archivo.fileName}
                        </a>
                        <span class="archivo-size">${sizeKB} KB</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }
        } catch (e) {
          console.error('Error al parsear archivos_urls:', e);
        }
      }

      detailRow.innerHTML = `
        <td colspan="10" style="padding: 0; background-color: #f9fafb;">
          <div class="items-detail-container">
            <h4 class="items-detail-header">
              📝 Detalles del Pago #${pago.id}
            </h4>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Importe</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>
            ${archivosHTML}
          </div>
        </td>
      `;

      pagosTableBody.appendChild(detailRow);
    }
  });
}

// Expandir/contraer fila de detalles
function toggleExpandRow(pagoId) {
  const mainRow = document.querySelector(`.pago-row[data-pago-id="${pagoId}"]`);
  const detailRow = document.querySelector(`.detail-row[data-pago-id="${pagoId}"]`);
  const icon = mainRow.querySelector('.expand-icon');

  if (detailRow.style.display === 'none') {
    detailRow.style.display = 'table-row';
    if (icon) {
      icon.style.transform = 'rotate(180deg)';
    }
  } else {
    detailRow.style.display = 'none';
    if (icon) {
      icon.style.transform = 'rotate(0deg)';
    }
  }
}

// Formatear fecha
function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Actualizar estadísticas
function updateStats(pagos) {
  const total = pagos.length;

  // Sumar todos los importes
  let importeTotal = 0;
  pagos.forEach(pago => {
    importeTotal += obtenerImportePago(pago);
  });

  totalRegistrosEl.textContent = total.toLocaleString('es-ES');
  importeTotalEl.textContent = `$${importeTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

// Poblar filtros con opciones únicas
function populateFilters() {
  // Obtener valores únicos
  const locales = new Set();
  const usuarios = new Set();
  const conceptos = new Set();

  allPagos.forEach(pago => {
    locales.add(pago.local);
    usuarios.add(pago.usuario_registro);

    // Agregar conceptos (formato nuevo - directo en pago)
    if (pago.concepto && pago.concepto.trim() !== '') {
      conceptos.add(pago.concepto);
    }

    // Agregar conceptos (formato antiguo - en items)
    if (pago.items && pago.items.length > 0) {
      pago.items.forEach(item => {
        if (item.concepto) {
          conceptos.add(item.concepto);
        }
      });
    }
  });

  // Poblar select de locales
  filterLocal.innerHTML = '<option value="">Todos</option>';
  Array.from(locales).sort().forEach(local => {
    const option = document.createElement('option');
    option.value = local;
    option.textContent = local;
    filterLocal.appendChild(option);
  });

  // Poblar select de usuarios
  filterUsuario.innerHTML = '<option value="">Todos</option>';
  Array.from(usuarios).sort().forEach(usuario => {
    const option = document.createElement('option');
    option.value = usuario;
    option.textContent = usuario;
    filterUsuario.appendChild(option);
  });

  // Poblar select de conceptos
  filterConcepto.innerHTML = '<option value="">Todos</option>';
  Array.from(conceptos).sort().forEach(concepto => {
    const option = document.createElement('option');
    option.value = concepto;
    option.textContent = concepto;
    filterConcepto.appendChild(option);
  });
}

// Aplicar filtros
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const fechaPagoDesde = filterFechaPagoDesde.value;
  const fechaPagoHasta = filterFechaPagoHasta.value;
  const fechaServicioDesde = filterFechaServicioDesde.value;
  const fechaServicioHasta = filterFechaServicioHasta.value;
  const localSeleccionado = filterLocal.value;
  const usuarioSeleccionado = filterUsuario.value;
  const conceptoSeleccionado = filterConcepto.value;

  filteredPagos = allPagos.filter(pago => {
    // Filtro de búsqueda general
    let matchesSearch = true;
    if (searchTerm) {
      const matchesLocal = pago.local.toLowerCase().includes(searchTerm);
      const matchesUsuario = pago.usuario_registro.toLowerCase().includes(searchTerm);
      let matchesConcepto = false;

      // Buscar en concepto directo (formato nuevo)
      if (pago.concepto) {
        matchesConcepto = pago.concepto.toLowerCase().includes(searchTerm);
      }
      // Buscar en observación directa (formato nuevo)
      if (!matchesConcepto && pago.observacion) {
        matchesConcepto = pago.observacion.toLowerCase().includes(searchTerm);
      }
      // Buscar en items (formato antiguo)
      if (!matchesConcepto && pago.items && pago.items.length > 0) {
        matchesConcepto = pago.items.some(item =>
          item.concepto.toLowerCase().includes(searchTerm) ||
          (item.observacion && item.observacion.toLowerCase().includes(searchTerm))
        );
      }

      matchesSearch = matchesLocal || matchesUsuario || matchesConcepto;
    }

    // Filtro de fecha pago desde
    let matchesFechaPagoDesde = true;
    if (fechaPagoDesde) {
      const pagoFecha = pago.fecha_pago || pago.fecha;
      matchesFechaPagoDesde = pagoFecha >= fechaPagoDesde;
    }

    // Filtro de fecha pago hasta
    let matchesFechaPagoHasta = true;
    if (fechaPagoHasta) {
      const pagoFecha = pago.fecha_pago || pago.fecha;
      matchesFechaPagoHasta = pagoFecha <= fechaPagoHasta;
    }

    // Filtro de fecha servicio desde
    let matchesFechaServicioDesde = true;
    if (fechaServicioDesde) {
      const servicioFecha = pago.fecha_servicio || pago.fecha;
      matchesFechaServicioDesde = servicioFecha >= fechaServicioDesde;
    }

    // Filtro de fecha servicio hasta
    let matchesFechaServicioHasta = true;
    if (fechaServicioHasta) {
      const servicioFecha = pago.fecha_servicio || pago.fecha;
      matchesFechaServicioHasta = servicioFecha <= fechaServicioHasta;
    }

    // Filtro de local
    let matchesLocal = true;
    if (localSeleccionado) {
      matchesLocal = pago.local === localSeleccionado;
    }

    // Filtro de usuario
    let matchesUsuario = true;
    if (usuarioSeleccionado) {
      matchesUsuario = pago.usuario_registro === usuarioSeleccionado;
    }

    // Filtro de concepto
    let matchesConcepto = true;
    if (conceptoSeleccionado) {
      matchesConcepto = false;

      // Verificar concepto directo (formato nuevo)
      if (pago.concepto === conceptoSeleccionado) {
        matchesConcepto = true;
      }

      // Verificar en items (formato antiguo)
      if (!matchesConcepto && pago.items && pago.items.length > 0) {
        matchesConcepto = pago.items.some(item => item.concepto === conceptoSeleccionado);
      }
    }

    return matchesSearch && matchesFechaPagoDesde && matchesFechaPagoHasta &&
           matchesFechaServicioDesde && matchesFechaServicioHasta &&
           matchesLocal && matchesUsuario && matchesConcepto;
  });

  renderPagos(filteredPagos);
  updateStats(filteredPagos);
}

// Event listeners para filtros
searchInput.addEventListener('input', applyFilters);
filterFechaPagoDesde.addEventListener('change', applyFilters);
filterFechaPagoHasta.addEventListener('change', applyFilters);
filterFechaServicioDesde.addEventListener('change', applyFilters);
filterFechaServicioHasta.addEventListener('change', applyFilters);
filterLocal.addEventListener('change', applyFilters);
filterUsuario.addEventListener('change', applyFilters);
filterConcepto.addEventListener('change', applyFilters);

// Limpiar filtros
function clearFilters() {
  searchInput.value = '';
  filterFechaPagoDesde.value = '';
  filterFechaPagoHasta.value = '';
  filterFechaServicioDesde.value = '';
  filterFechaServicioHasta.value = '';
  filterLocal.value = '';
  filterUsuario.value = '';
  filterConcepto.value = '';
  filteredPagos = allPagos;
  renderPagos(filteredPagos);
  updateStats(filteredPagos);
}

// Exportar a Excel (CSV)
function exportToExcel() {
  if (allPagos.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  // Preparar datos para exportar
  const csvRows = [];

  // Encabezados
  const headers = ['ID', 'Fecha Pago', 'Fecha Servicio', 'Proveedor', 'Moneda', 'Local', 'Concepto', 'Monto Peso', 'Monto Dolar', 'Observación', 'Usuario', 'Fecha Registro'];
  csvRows.push(headers.join(','));

  // Datos
  allPagos.forEach(pago => {
    // Si tiene items (formato antiguo)
    if (pago.items && pago.items.length > 0) {
      pago.items.forEach(item => {
        const importe = parseFloat(item.importe);
        const montoPeso = (pago.moneda === 'Peso') ? importe.toFixed(2) : '0.00';
        const montoDolar = (pago.moneda === 'Dolar') ? importe.toFixed(2) : '0.00';

        const row = [
          pago.id,
          formatDateForExcel(pago.fecha_pago || pago.fecha),
          formatDateForExcel(pago.fecha_servicio || pago.fecha),
          `"${pago.proveedor || 'Sin especificar'}"`,
          `"${pago.moneda || 'N/A'}"`,
          `"${pago.local}"`,
          `"${item.concepto}"`,
          montoPeso,
          montoDolar,
          `"${item.observacion || ''}"`,
          `"${pago.usuario_registro}"`,
          formatDateTimeForExcel(pago.fecha_registro)
        ];
        csvRows.push(row.join(','));
      });
    }
    // Si tiene concepto directo (formato nuevo)
    else if (pago.concepto && pago.concepto.trim() !== '') {
      const importe = parseFloat(pago.importe) || 0;
      const montoPeso = (pago.moneda === 'Peso') ? importe.toFixed(2) : '0.00';
      const montoDolar = (pago.moneda === 'Dolar') ? importe.toFixed(2) : '0.00';

      const row = [
        pago.id,
        formatDateForExcel(pago.fecha_pago || pago.fecha),
        formatDateForExcel(pago.fecha_servicio || pago.fecha),
        `"${pago.proveedor || 'Sin especificar'}"`,
        `"${pago.moneda || 'N/A'}"`,
        `"${pago.local}"`,
        `"${pago.concepto}"`,
        montoPeso,
        montoDolar,
        `"${pago.observacion || ''}"`,
        `"${pago.usuario_registro}"`,
        formatDateTimeForExcel(pago.fecha_registro)
      ];
      csvRows.push(row.join(','));
    }
    // Si no tiene ni items ni concepto
    else {
      const row = [
        pago.id,
        formatDateForExcel(pago.fecha_pago || pago.fecha),
        formatDateForExcel(pago.fecha_servicio || pago.fecha),
        `"${pago.proveedor || 'Sin especificar'}"`,
        `"${pago.moneda || 'N/A'}"`,
        `"${pago.local}"`,
        '',
        '0.00',
        '0.00',
        '',
        `"${pago.usuario_registro}"`,
        formatDateTimeForExcel(pago.fecha_registro)
      ];
      csvRows.push(row.join(','));
    }
  });

  // Crear archivo CSV
  const csvContent = '\uFEFF' + csvRows.join('\n'); // \uFEFF es el BOM para UTF-8
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Crear link de descarga
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `historial-gastos-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log('Archivo exportado exitosamente');
}

// Formatear fecha para Excel
function formatDateForExcel(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Formatear fecha y hora para Excel
function formatDateTimeForExcel(dateTimeString) {
  if (!dateTimeString) return '';
  const date = new Date(dateTimeString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Guardar campo OP
async function saveOP(pagoId) {
  const input = document.querySelector(`.op-input[data-pago-id="${pagoId}"]`);
  const button = document.querySelector(`.btn-save-op[data-pago-id="${pagoId}"]`);

  if (!input) return;

  const opValue = input.value.trim();

  // Validar que sea solo números
  if (opValue && !/^\d+$/.test(opValue)) {
    alert('El campo OP debe contener solo números');
    return;
  }

  // Deshabilitar botón durante la petición
  button.disabled = true;
  button.textContent = '⏳';

  try {
    const response = await fetch(`/api/pagos/${pagoId}/op`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ op: opValue })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Actualizar el valor en allPagos
      const pago = allPagos.find(p => p.id === parseInt(pagoId));
      if (pago) {
        pago.op = opValue;
      }

      // Mostrar feedback visual
      button.textContent = '✓';
      button.style.background = '#10b981';
      setTimeout(() => {
        button.textContent = '✓';
        button.style.background = '#4f46e5';
        button.disabled = false;
      }, 1000);
    } else {
      alert(data.message || 'Error al guardar el campo OP');
      button.textContent = '✓';
      button.disabled = false;
    }
  } catch (error) {
    console.error('Error al guardar OP:', error);
    alert('Error de conexión al guardar el campo OP');
    button.textContent = '✓';
    button.disabled = false;
  }
}
