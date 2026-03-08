// Lógica de Autenticación

document.addEventListener('DOMContentLoaded', async () => {
  await window.DB.init();
  await window.DB.seed(); // Asegurar usuarios de prueba

  // Configurar Tabs
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Quitar active
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Poner active
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });

  // Formularios
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('buyerRegForm').addEventListener('submit', handleBuyerReg);
  document.getElementById('agentRegForm').addEventListener('submit', handleAgentReg);
});

function showToast(msg) {
  const toast = document.getElementById('toastMessage');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function handleLogin(e) {
  e.preventDefault();
  const userVal = document.getElementById('loginUser').value.trim().toLowerCase();
  const passVal = document.getElementById('loginPass').value;

  try {
    const user = await window.DB.get('users', userVal);
    if (user && user.password === passVal) {
      // Guardar sesión en localstorage
      localStorage.setItem('currentUser', JSON.stringify({
        username: user.username,
        role: user.role,
        name: user.name,
        lastName: user.lastName,
        employeeId: user.employeeId
      }));

      showToast('Inicio de sesión exitoso');
      setTimeout(() => {
        if (user.role === 'admin' || user.role === 'agent') {
          window.location.href = 'inventario.html';
        } else {
          window.location.href = 'index.html';
        }
      }, 1000);
    } else {
      showToast('Usuario o contraseña incorrectos');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Error al procesar el inicio de sesión');
  }
}

async function handleBuyerReg(e) {
  e.preventDefault();
  const name = document.getElementById('bName').value.trim();
  const lastName = document.getElementById('bLastName').value.trim();
  const username = document.getElementById('bUser').value.trim().toLowerCase();
  const password = document.getElementById('bPass').value;

  try {
    const existing = await window.DB.get('users', username);
    if (existing) {
      showToast('El usuario ya existe');
      return;
    }

    await window.DB.add('users', {
      username,
      password,
      role: 'buyer',
      name,
      lastName
    });

    showToast('Cuenta creada con éxito. Por favor inicia sesión.');
    document.getElementById('buyerRegForm').reset();
    document.querySelector('.tab[data-target=\"loginTab\"]').click();
  } catch (error) {
    showToast('Error al crear la cuenta');
  }
}

async function handleAgentReg(e) {
  e.preventDefault();
  const name = document.getElementById('aName').value.trim();
  const lastName = document.getElementById('aLastName').value.trim();
  const empId = document.getElementById('aEmpId').value.trim();
  const password = document.getElementById('aPass').value;

  // Generar username: jpadilla
  const firstNameChar = name.charAt(0).toLowerCase();
  const lastNameClean = lastName.replace(/\\s+/g, '').toLowerCase();
  const generatedUsername = firstNameChar + lastNameClean;

  try {
    const existing = await window.DB.get('users', generatedUsername);
    if (existing) {
      showToast(`El usuario ${generatedUsername} ya está en uso. Contacte al administrador.`);
      return;
    }

    await window.DB.add('users', {
      username: generatedUsername,
      password,
      role: 'agent',
      name,
      lastName,
      employeeId: empId
    });

    showToast(`Registro exitoso. Tu usuario es: ${generatedUsername}`);
    document.getElementById('agentRegForm').reset();

    // Llenar el login para facilitarle la vida
    document.getElementById('loginUser').value = generatedUsername;
    document.querySelector('.tab[data-target=\"loginTab\"]').click();
  } catch (error) {
    showToast('Error al registrar agente');
  }
}


