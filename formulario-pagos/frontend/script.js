// Elementos del DOM
const form = document.getElementById('pagoForm');
const submitBtn = document.getElementById('submitBtn');
const usernameDisplay = document.getElementById('username');
const confirmationPanel = document.getElementById('confirmationPanel');
const confirmBtn = document.getElementById('confirmBtn');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const successText = document.getElementById('successText');
const errorText = document.getElementById('errorText');

// Variables globales
let currentFormData = null;
let currentUser = null;
let selectedFiles = [];

// Variables para multiselect
let selectedLocales = [];

// Verificar autenticación al cargar
window.addEventListener('load', async () => {
  try {
    const response = await fetch('/api/check-auth');
    const data = await response.json();

    if (!data.authenticated) {
      window.location.href = '/login';
      return;
    }

    usernameDisplay.textContent = data.user.username;
    currentUser = data.user.username;
    document.getElementById('email-destinatario').textContent = 'gastosop10@gmail.com';

    // Inicializar multiselect
    initMultiselect();

    // Inicializar manejo de archivos
    initFileUpload();
  } catch (error) {
    console.error('Error al verificar autenticación:', error);
    window.location.href = '/login';
  }
});

// Establecer fechas actuales
document.getElementById('fechaPago').valueAsDate = new Date();
document.getElementById('fechaServicio').valueAsDate = new Date();

// Funciones para multiselect
function initMultiselect() {
  const button = document.getElementById('local-button');
  const dropdown = document.getElementById('local-dropdown');
  const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');

  // Toggle dropdown
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
    button.classList.toggle('open', !isOpen);
  });

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#local-multiselect')) {
      dropdown.style.display = 'none';
      button.classList.remove('open');
    }
  });

  // Manejar cambios en checkboxes
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectedLocales);
  });
}

function updateSelectedLocales() {
  const checkboxes = document.querySelectorAll('input[name="local"]:checked');
  selectedLocales = Array.from(checkboxes).map(cb => cb.value);

  const selectedText = document.getElementById('local-selected-text');
  const button = document.getElementById('local-button');

  if (selectedLocales.length === 0) {
    selectedText.textContent = 'Seleccione uno o más locales';
    button.classList.remove('error');
  } else if (selectedLocales.length === 1) {
    selectedText.textContent = selectedLocales[0];
    button.classList.remove('error');
  } else {
    selectedText.textContent = `${selectedLocales.length} locales seleccionados`;
    button.classList.remove('error');
  }
}

function getSelectedLocales() {
  return selectedLocales;
}

// ===== MANEJO DE ARCHIVOS =====

function initFileUpload() {
  const fileInput = document.getElementById('archivos');
  const fileUploadText = document.querySelector('.file-upload-text');
  const archivosPreview = document.getElementById('archivos-preview');

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);

    // Validar número de archivos
    if (files.length > 5) {
      alert('Máximo 5 archivos permitidos');
      fileInput.value = '';
      return;
    }

    // Validar tamaño de archivos
    const maxSize = 10 * 1024 * 1024; // 10MB
    const invalidFiles = files.filter(file => file.size > maxSize);

    if (invalidFiles.length > 0) {
      alert(`Los siguientes archivos exceden el tamaño máximo de 10MB:\n${invalidFiles.map(f => f.name).join('\n')}`);
      fileInput.value = '';
      return;
    }

    selectedFiles = files;
    updateFilePreview(files);

    // Actualizar texto del botón
    if (files.length > 0) {
      fileUploadText.textContent = `${files.length} archivo(s) seleccionado(s)`;
    } else {
      fileUploadText.textContent = 'Seleccionar archivos (imágenes o PDF)';
    }
  });
}

function updateFilePreview(files) {
  const preview = document.getElementById('archivos-preview');
  preview.innerHTML = '';

  if (files.length === 0) {
    return;
  }

  files.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-preview-item';

    const icon = file.type === 'application/pdf' ? '📄' : '🖼️';
    const sizeKB = (file.size / 1024).toFixed(2);

    fileItem.innerHTML = `
      <span class="file-icon">${icon}</span>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${sizeKB} KB</span>
      <button type="button" class="file-remove-btn" onclick="removeFile(${index})">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    preview.appendChild(fileItem);
  });
}

function removeFile(index) {
  const fileInput = document.getElementById('archivos');
  const dataTransfer = new DataTransfer();

  selectedFiles = selectedFiles.filter((_, i) => i !== index);

  selectedFiles.forEach(file => {
    dataTransfer.items.add(file);
  });

  fileInput.files = dataTransfer.files;
  updateFilePreview(selectedFiles);

  const fileUploadText = document.querySelector('.file-upload-text');
  if (selectedFiles.length > 0) {
    fileUploadText.textContent = `${selectedFiles.length} archivo(s) seleccionado(s)`;
  } else {
    fileUploadText.textContent = 'Seleccionar archivos (imágenes o PDF)';
  }
}

// ===== FIN MANEJO DE ARCHIVOS =====

// Función de logout
async function logout() {
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    const data = await response.json();
    if (data.success) {
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    window.location.href = '/login';
  }
}

// Formatear importe al salir del campo
document.getElementById('importe').addEventListener('blur', function() {
  if (this.value && !isNaN(this.value)) {
    this.value = parseFloat(this.value).toFixed(2);
  }
});

// Validación de campos principales
function validateMainFields() {
  let isValid = true;

  // Validar locales (multiselect)
  const localButton = document.getElementById('local-button');
  const localError = document.getElementById('error-local');
  if (selectedLocales.length === 0) {
    localButton.classList.add('error');
    localError.textContent = 'Debe seleccionar al menos un local';
    isValid = false;
  } else {
    localButton.classList.remove('error');
    localError.textContent = '';
  }

  // Validar proveedor
  const proveedor = document.getElementById('proveedor');
  const proveedorError = document.getElementById('error-proveedor');
  if (!proveedor.value.trim()) {
    proveedor.classList.add('error');
    proveedorError.textContent = 'El nombre del proveedor es requerido';
    isValid = false;
  } else {
    proveedor.classList.remove('error');
    proveedorError.textContent = '';
  }

  // Validar fecha pago
  const fechaPago = document.getElementById('fechaPago');
  const fechaPagoError = document.getElementById('error-fechaPago');
  if (!fechaPago.value) {
    fechaPago.classList.add('error');
    fechaPagoError.textContent = 'La fecha de pago es requerida';
    isValid = false;
  } else {
    const selectedDate = new Date(fechaPago.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
      fechaPago.classList.add('error');
      fechaPagoError.textContent = 'La fecha no puede ser futura';
      isValid = false;
    } else {
      fechaPago.classList.remove('error');
      fechaPagoError.textContent = '';
    }
  }

  // Validar fecha servicio
  const fechaServicio = document.getElementById('fechaServicio');
  const fechaServicioError = document.getElementById('error-fechaServicio');
  if (!fechaServicio.value) {
    fechaServicio.classList.add('error');
    fechaServicioError.textContent = 'La fecha de servicio es requerida';
    isValid = false;
  } else {
    fechaServicio.classList.remove('error');
    fechaServicioError.textContent = '';
  }

  // Validar moneda
  const moneda = document.getElementById('moneda');
  const monedaError = document.getElementById('error-moneda');
  if (!moneda.value) {
    moneda.classList.add('error');
    monedaError.textContent = 'Debe seleccionar una moneda';
    isValid = false;
  } else {
    moneda.classList.remove('error');
    monedaError.textContent = '';
  }

  // Validar concepto
  const concepto = document.getElementById('concepto');
  const conceptoError = document.getElementById('error-concepto');
  if (!concepto.value.trim()) {
    concepto.classList.add('error');
    conceptoError.textContent = 'El concepto es requerido';
    isValid = false;
  } else {
    concepto.classList.remove('error');
    conceptoError.textContent = '';
  }

  // Validar importe
  const importe = document.getElementById('importe');
  const importeError = document.getElementById('error-importe');
  const importeValue = parseFloat(importe.value);
  if (!importe.value || isNaN(importeValue) || importeValue <= 0) {
    importe.classList.add('error');
    importeError.textContent = 'El importe es requerido y debe ser mayor a 0';
    isValid = false;
  } else {
    importe.classList.remove('error');
    importeError.textContent = '';
  }

  return isValid;
}

// Manejar envío del formulario
form.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!validateMainFields()) {
    const firstError = document.querySelector('.error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstError.focus();
    }
    return;
  }

  // Recopilar datos
  currentFormData = {
    locales: selectedLocales,
    proveedor: document.getElementById('proveedor').value.trim(),
    fechaPago: document.getElementById('fechaPago').value,
    fechaServicio: document.getElementById('fechaServicio').value,
    moneda: document.getElementById('moneda').value,
    concepto: document.getElementById('concepto').value.trim(),
    importe: parseFloat(document.getElementById('importe').value),
    observacion: document.getElementById('observacion').value.trim()
  };

  showConfirmation(currentFormData);
});

// Mostrar confirmación
function showConfirmation(data) {
  form.style.display = 'none';

  // Llenar datos generales
  document.getElementById('confirm-local').textContent = data.locales.join(', ');
  document.getElementById('confirm-proveedor').textContent = data.proveedor;
  document.getElementById('confirm-fechaPago').textContent = formatDate(data.fechaPago);
  document.getElementById('confirm-fechaServicio').textContent = formatDate(data.fechaServicio);
  document.getElementById('confirm-moneda').textContent = data.moneda;
  document.getElementById('email-usuario').textContent = currentUser;

  // Llenar detalles del gasto
  document.getElementById('confirm-concepto').textContent = data.concepto;
  document.getElementById('confirm-observacion').textContent = data.observacion || '-';

  // Calcular importe por local si hay múltiples locales
  const importePorLocal = data.importe / data.locales.length;
  let importeText = `$${data.importe.toFixed(2)}`;

  if (data.locales.length > 1) {
    importeText += ` (${data.locales.length} locales × $${importePorLocal.toFixed(2)})`;
  }

  document.getElementById('confirm-importe').textContent = importeText;

  // Mostrar archivos adjuntos si hay
  const archivosCard = document.getElementById('confirm-archivos-card');
  const archivosList = document.getElementById('confirm-archivos-list');

  if (selectedFiles.length > 0) {
    archivosCard.style.display = 'block';
    archivosList.innerHTML = selectedFiles.map(file => {
      const icon = file.type === 'application/pdf' ? '📄' : '🖼️';
      const sizeKB = (file.size / 1024).toFixed(2);
      return `
        <div class="archivo-confirm-item">
          <span class="file-icon">${icon}</span>
          <span class="file-name">${file.name}</span>
          <span class="file-size">${sizeKB} KB</span>
        </div>
      `;
    }).join('');
  } else {
    archivosCard.style.display = 'none';
  }

  confirmationPanel.style.display = 'block';
  confirmationPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Formatear fecha
function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('es-ES', options);
}

// Cancelar confirmación
function cancelConfirmation() {
  confirmationPanel.style.display = 'none';
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Confirmar y enviar
async function confirmAndSend() {
  if (!currentFormData) return;

  confirmBtn.disabled = true;
  const btnText = confirmBtn.querySelector('.btn-text');
  const btnLoader = confirmBtn.querySelector('.btn-loader');
  btnText.style.display = 'none';
  btnLoader.style.display = 'block';

  try {
    // Crear FormData para enviar archivos
    const formData = new FormData();

    // Agregar datos del formulario
    formData.append('locales', JSON.stringify(currentFormData.locales));
    formData.append('proveedor', currentFormData.proveedor);
    formData.append('fechaPago', currentFormData.fechaPago);
    formData.append('fechaServicio', currentFormData.fechaServicio);
    formData.append('moneda', currentFormData.moneda);
    formData.append('concepto', currentFormData.concepto);
    formData.append('importe', currentFormData.importe);
    formData.append('observacion', currentFormData.observacion);

    // Agregar archivos
    selectedFiles.forEach(file => {
      formData.append('archivos', file);
    });

    const response = await fetch('/api/pagos', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok && data.success) {
      confirmationPanel.style.display = 'none';
      showSuccess(data);
    } else if (response.status === 401) {
      window.location.href = '/login';
    } else {
      confirmationPanel.style.display = 'none';
      showError(data.message || 'Error al registrar el gasto');
    }
  } catch (error) {
    console.error('Error:', error);
    confirmationPanel.style.display = 'none';
    showError('Error de conexión con el servidor');
  } finally {
    confirmBtn.disabled = false;
    btnText.style.display = 'flex';
    btnLoader.style.display = 'none';
  }
}

// Mostrar éxito
function showSuccess(data) {
  successMessage.style.display = 'block';
  errorMessage.style.display = 'none';

  let message = `El gasto ha sido registrado correctamente con ID #${data.pagoId}.`;
  if (data.emailSent) {
    message += ' Se ha enviado un email de confirmación.';
  } else {
    message += ' El email de confirmación no pudo ser enviado.';
  }

  successText.textContent = message;
  successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Mostrar error
function showError(message) {
  form.style.display = 'none';
  successMessage.style.display = 'none';
  confirmationPanel.style.display = 'none';
  errorMessage.style.display = 'block';
  errorText.textContent = message;
  errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Ocultar error
function hideError() {
  errorMessage.style.display = 'none';
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Resetear formulario
function resetForm() {
  // Limpiar multiselect de locales
  selectedLocales = [];
  document.querySelectorAll('input[name="local"]').forEach(cb => cb.checked = false);
  document.getElementById('local-selected-text').textContent = 'Seleccione uno o más locales';

  // Limpiar campos principales
  document.getElementById('proveedor').value = '';
  document.getElementById('fechaPago').valueAsDate = new Date();
  document.getElementById('fechaServicio').valueAsDate = new Date();
  document.getElementById('moneda').value = '';

  // Limpiar campos del gasto
  document.getElementById('concepto').value = '';
  document.getElementById('importe').value = '';
  document.getElementById('observacion').value = '';

  // Limpiar archivos
  selectedFiles = [];
  document.getElementById('archivos').value = '';
  document.getElementById('archivos-preview').innerHTML = '';
  document.querySelector('.file-upload-text').textContent = 'Seleccionar archivos (imágenes o PDF)';

  // Limpiar errores
  document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

  successMessage.style.display = 'none';
  errorMessage.style.display = 'none';
  confirmationPanel.style.display = 'none';
  form.style.display = 'block';

  currentFormData = null;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
