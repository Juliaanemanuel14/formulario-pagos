// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const btnText = document.querySelector('.btn-text');
const btnLoader = document.querySelector('.btn-loader');
const loginError = document.getElementById('loginError');
const errorText = document.getElementById('errorText');
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

// Toggle mostrar/ocultar contraseña
togglePassword.addEventListener('click', () => {
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);
});

// Validación de campos
const fields = ['username', 'password'];

fields.forEach(fieldName => {
  const field = document.getElementById(fieldName);

  field.addEventListener('blur', () => {
    validateField(fieldName);
  });

  field.addEventListener('input', () => {
    if (field.classList.contains('error')) {
      validateField(fieldName);
    }
    // Ocultar mensaje de error al escribir
    loginError.style.display = 'none';
  });
});

// Función para validar un campo individual
function validateField(fieldName) {
  const field = document.getElementById(fieldName);
  const errorElement = document.getElementById(`error-${fieldName}`);
  let isValid = true;
  let errorMsg = '';

  if (!field.value.trim()) {
    isValid = false;
    errorMsg = 'Este campo es requerido';
  }

  if (isValid) {
    field.classList.remove('error');
    errorElement.textContent = '';
  } else {
    field.classList.add('error');
    errorElement.textContent = errorMsg;
  }

  return isValid;
}

// Validar todos los campos
function validateForm() {
  let isValid = true;

  fields.forEach(fieldName => {
    if (!validateField(fieldName)) {
      isValid = false;
    }
  });

  return isValid;
}

// Mostrar error de login
function showLoginError(message) {
  loginError.style.display = 'flex';
  errorText.textContent = message;
}

// Manejar el envío del formulario
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validar formulario
  if (!validateForm()) {
    return;
  }

  // Deshabilitar botón y mostrar loader
  loginBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'block';
  loginError.style.display = 'none';

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Login exitoso - redirigir al formulario
      window.location.href = '/';
    } else {
      // Mostrar error
      showLoginError(data.message || 'Usuario o contraseña incorrectos');
    }
  } catch (error) {
    console.error('Error:', error);
    showLoginError('Error de conexión con el servidor');
  } finally {
    // Rehabilitar botón
    loginBtn.disabled = false;
    btnText.style.display = 'block';
    btnLoader.style.display = 'none';
  }
});

// Verificar si ya está logueado al cargar la página
window.addEventListener('load', async () => {
  try {
    const response = await fetch('/api/check-auth');
    const data = await response.json();

    if (data.authenticated) {
      // Ya está autenticado, redirigir al formulario
      window.location.href = '/';
    }
  } catch (error) {
    // No hacer nada, mantener en la página de login
  }
});

// Focus en el primer campo
document.getElementById('username').focus();
