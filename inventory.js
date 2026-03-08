// Lógica de Inventario para Agentes y Administradores

let currentUser = null;
let currentView = 'inventory';
let allData = []; // Autos o usuarios dependiendo de la vista

document.addEventListener('DOMContentLoaded', async () => {
  await window.DB.init();
  await window.DB.seed();
  checkAccess();
  setupSidebar();

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });

  document.getElementById('btnAddCar').addEventListener('click', () => openCarModal());
  document.getElementById('carForm').addEventListener('submit', handleCarSubmit);

  const btnAddUser = document.getElementById('btnAddUser');
  if (btnAddUser) btnAddUser.addEventListener('click', () => openUserModal());

  const userForm = document.getElementById('userForm');
  if (userForm) userForm.addEventListener('submit', handleUserSubmit);

  const btnAI = document.getElementById('btnAIGenerate');
  if (btnAI) btnAI.addEventListener('click', generateDescriptionAI);

  const btnImportExcel = document.getElementById('btnImportExcel');
  const excelFileInput = document.getElementById('excelFileInput');

  if (btnImportExcel && excelFileInput) {
    btnImportExcel.addEventListener('click', () => excelFileInput.click());
    excelFileInput.addEventListener('change', handleExcelUpload);
  }
});

async function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  showToast('Subiendo archivo y procesando...');

  try {
    const response = await fetch('/api/import_excel', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();

    if (response.ok && result.success) {
      showToast(`¡Importación exitosa! Se importaron ${result.imported} vehículos.`);
      document.getElementById('excelFileInput').value = ''; // Limpiar input

      // Reload the data
      loadView(currentView);
    } else {
      showToast('Error importando: ' + (result.error || 'Desconocido'));
    }
  } catch (error) {
    console.error(error);
    showToast('Error de conexión o de servidor.');
  }
}

function checkAccess() {
  const userStr = localStorage.getItem('currentUser');
  if (!userStr) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = JSON.parse(userStr);

  if (currentUser.role === 'buyer') {
    window.location.href = 'index.html';
    return;
  }

  const userDisplay = document.getElementById('userNameDisplay');
  if (userDisplay) {
    const roleName = currentUser.role === 'admin' ? 'Admin' : 'Agente';
    userDisplay.innerText = `Hola, ${currentUser.name} (${roleName})`;
    userDisplay.style.display = 'inline-block';
  }

  if (currentUser.role === 'admin') {
    document.getElementById('adminMenu').style.display = 'block';

    // Solo mostrar el botón de importar al administrador
    const btnImportExcel = document.getElementById('btnImportExcel');
    if (btnImportExcel) btnImportExcel.style.display = 'inline-block';
  }

  loadView(currentView);
}

function setupSidebar() {
  const btns = document.querySelectorAll('.sidebar-menu button');
  btns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      btns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      loadView(e.target.dataset.view);
    });
  });
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function showToast(msg) {
  const toast = document.getElementById('toastMessage');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function loadView(view) {
  currentView = view;
  const title = document.getElementById('viewTitle');
  const thead = document.querySelector('#dataTable thead');
  const tbody = document.querySelector('#dataTable tbody');
  const stats = document.getElementById('statsContainer');

  thead.innerHTML = '';
  tbody.innerHTML = '';
  stats.style.display = 'none';

  const btnAddCar = document.getElementById('btnAddCar');
  const btnAddUser = document.getElementById('btnAddUser');

  if (btnAddCar) btnAddCar.style.display = 'block';
  if (btnAddUser) btnAddUser.style.display = 'none';

  let cars = [];
  if (view !== 'users') {
    cars = await window.DB.getAll('cars');
  }

  if (view === 'inventory') {
    title.innerText = 'Mi Inventario (Disponibles)';
    if (currentUser.role !== 'admin') {
      cars = cars.filter(c => c.agentId === currentUser.username && c.status === 'disponible');
    } else {
      cars = cars.filter(c => c.status === 'disponible'); // Admin ve todos disponibles en su inventory, o ver todos en AllCars
    }
    renderCarTable(cars, ['Vehículo', 'Precio', 'Condición', 'Acciones']);
  }
  else if (view === 'pending') {
    title.innerText = 'Carros en Pendiente (Papeles)';
    if (currentUser.role !== 'admin') {
      cars = cars.filter(c => c.agentId === currentUser.username && c.status === 'pendiente');
    } else {
      cars = cars.filter(c => c.status === 'pendiente');
    }
    renderCarTable(cars, ['Vehículo', 'Precio', 'Estado', 'Acciones']);
  }
  else if (view === 'sold') {
    title.innerText = 'Carros Vendidos & Ganancias';
    if (currentUser.role !== 'admin') {
      cars = cars.filter(c => c.agentId === currentUser.username && c.status === 'vendido');
    } else {
      cars = cars.filter(c => c.status === 'vendido');
    }

    const totalSales = cars.reduce((acc, c) => acc + (c.soldPrice || c.price), 0);
    const commission = totalSales * 0.05; // 5% comisión

    document.getElementById('statTotalSales').innerText = formatMoney(totalSales);
    document.getElementById('statCommission').innerText = formatMoney(commission);
    stats.style.display = 'grid';

    renderCarTable(cars, ['Vehículo', 'Precio de Venta', 'Estado de Ganancia']);
  }
  else if (view === 'allCars' && currentUser.role === 'admin') {
    title.innerText = 'Todo el Inventario (Global)';
    renderCarTable(cars, ['Vehículo', 'Precio', 'Est.', 'Agente', 'Acciones']);
  }
  else if (view === 'users' && currentUser.role === 'admin') {
    title.innerText = 'Gestión de Usuarios';
    if (btnAddCar) btnAddCar.style.display = 'none';
    if (btnAddUser) btnAddUser.style.display = 'block';

    let users = await window.DB.getAll('users');
    renderUserTable(users);
    allData = users; // allData is used for editing
    return;
  }

  allData = cars;
}

function renderUserTable(users) {
  const thead = document.querySelector('#dataTable thead');
  const tbody = document.querySelector('#dataTable tbody');

  thead.innerHTML = `<tr><th>Usuario (ID)</th><th>Nombre</th><th>Rol</th><th>ID Empleado</th><th>Acciones</th></tr>`;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan=\"5\" style=\"text-align:center;\">No hay usuarios.</td></tr>`;
    return;
  }

  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${u.username}</strong></td>
      <td>${u.name} ${u.lastName}</td>
      <td><span class=\"car-badge\" style=\"position:static; background:var(--primary);\">${u.role}</span></td>
      <td>${u.employeeId || '-'}</td>
      <td>
        <button class=\"btn btn-outline\" style=\"padding: 0.3rem 0.6rem; font-size: 0.8rem;\" onclick=\"editUser('${u.username}')\">Editar</button>
        ${u.username !== currentUser.username ? `<button class=\"btn btn-primary\" style=\"padding: 0.3rem 0.6rem; font-size: 0.8rem; background:red; color:white; border:none;\" onclick=\"deleteUser('${u.username}')\">Eliminar</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCarTable(cars, headers) {
  const thead = document.querySelector('#dataTable thead');
  const tbody = document.querySelector('#dataTable tbody');

  let headHtml = '<tr>';
  headers.forEach(h => headHtml += `<th>${h}</th>`);
  headHtml += '</tr>';
  thead.innerHTML = headHtml;

  if (cars.length === 0) {
    tbody.innerHTML = `<tr><td colspan=\"${headers.length}\" style=\"text-align:center;\">No hay vehículos en esta categoría.</td></tr>`;
    return;
  }

  cars.forEach(car => {
    const tr = document.createElement('tr');
    const name = `
      <div style=\"display:flex; align-items:center; gap:1rem;\">
        <img src=\"${car.images[0] || 'https://via.placeholder.com/50'}\" style=\"width:50px; height:50px; object-fit:cover; border-radius:4px;\">
        <div>
          <strong>${car.brand} ${car.model}</strong><br>
          <span style=\"font-size:0.8rem; color:var(--text-muted);\">${car.year} | ${car.category}</span>
          ${car.adminNote ? `<div style=\"color:var(--primary); font-size: 0.8rem; margin-top:2px;\">📝 Admin: ${car.adminNote}</div>` : ''}
        </div>
      </div>
    `;

    if (currentView === 'inventory' || currentView === 'pending') {
      tr.innerHTML = `
        <td>${name}</td>
        <td>${formatMoney(car.price)}</td>
        <td><span class=\"car-badge\" style=\"position:static;\">${car.status}</span></td>
        <td>
          <button class=\"btn btn-outline\" style=\"padding: 0.3rem 0.6rem; font-size: 0.8rem;\" onclick=\"editCar('${car.id}')\">Editar</button>
          ${car.status === 'disponible' ? `<button class=\"btn btn-primary\" style=\"padding: 0.3rem 0.6rem; font-size: 0.8rem;\" onclick=\"changeStatus('${car.id}', 'pendiente')\">Marcar Pendiente</button>` : ''}
          ${car.status === 'pendiente' ? `<button class=\"btn btn-primary\" style=\"padding: 0.3rem 0.6rem; font-size: 0.8rem;\" onclick=\"changeStatus('${car.id}', 'vendido')\">Marcar Vendido</button>` : ''}
        </td>
      `;
    } else if (currentView === 'sold') {
      tr.innerHTML = `
        <td>${name}</td>
        <td>${formatMoney(car.soldPrice || car.price)}</td>
        <td>+${formatMoney((car.soldPrice || car.price) * 0.05)} Com.</td>
      `;
    } else if (currentView === 'allCars') {
      tr.innerHTML = `
        <td>${name}</td>
        <td>${formatMoney(car.price)}</td>
        <td>${car.status}</td>
        <td>${car.agentId}</td>
        <td>
          <button class=\"btn btn-outline\" style=\"padding: 0.3rem 0.6rem; font-size: 0.8rem;\" onclick=\"editCar('${car.id}')\">Editar</button>
          <button class=\"btn btn-primary\" style=\"padding: 0.3rem 0.6rem; font-size: 0.8rem; background:red; color:white; border:none;\" onclick=\"deleteCar('${car.id}')\">Eliminar</button>
        </td>
      `;
    }
    tbody.appendChild(tr);
  });
}

async function changeStatus(carId, status) {
  const car = await window.DB.get('cars', carId);
  if (car) {
    car.status = status;
    if (status === 'vendido') {
      car.soldPrice = car.price; // simplificación
    }
    await window.DB.add('cars', car);
    showToast(`Vehículo marcado como ${status}`);
    loadView(currentView);
  }
}

async function deleteCar(carId) {
  if (confirm('¿Seguro quieres eliminar este auto?')) {
    await window.DB.delete('cars', carId);
    showToast('Auto eliminado');
    loadView(currentView);
  }
}

// Funciones del Modal Add/Edit
function openCarModal(carId = null) {
  document.getElementById('carForm').reset();
  document.getElementById('cId').value = '';

  if (currentUser.role === 'admin') {
    document.getElementById('adminCarOptions').style.display = 'block';
    document.getElementById('cAgentId').value = currentUser.username; // Default a sí mismo si no cambia
  }

  if (carId) {
    document.getElementById('modalCarTitle').innerText = 'Editar Vehículo';
    const car = allData.find(c => c.id === carId);
    if (car) {
      document.getElementById('cId').value = car.id;
      document.getElementById('cBrand').value = car.brand;
      document.getElementById('cModel').value = car.model;
      document.getElementById('cYear').value = car.year;
      document.getElementById('cPrice').value = car.price;
      document.getElementById('cCat').value = car.category;
      document.getElementById('cCond').value = car.condition;
      document.getElementById('cMiles').value = car.mileage;
      document.getElementById('cImgs').value = car.images.join(', ');
      document.getElementById('cDesc').value = car.description;

      if (currentUser.role === 'admin') {
        document.getElementById('cAgentId').value = car.agentId;
        document.getElementById('cAdminNote').value = car.adminNote || '';
      }
    }
  } else {
    document.getElementById('modalCarTitle').innerText = 'Añadir Vehículo';
  }
  document.getElementById('carModal').classList.add('active');
}

async function generateDescriptionAI() {
  const brand = document.getElementById('cBrand').value.trim();
  const model = document.getElementById('cModel').value.trim();
  const year = document.getElementById('cYear').value;
  const category = document.getElementById('cCat').value;
  const condition = document.getElementById('cCond').value;

  if (!brand || !model || !year) {
    showToast('Por favor llena Marca, Modelo y Año para generar.');
    document.getElementById('cBrand').focus();
    return;
  }

  showToast('Generando descripción profesional...');

  try {
    const response = await fetch('/api/generate_desc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, model, year, category, condition })
    });

    if (response.ok) {
      const data = await response.json();
      document.getElementById('cDesc').value = data.description;
      showToast('Descripción generada por IA');
    } else {
      throw new Error('Error API IA');
    }
  } catch (error) {
    console.error(error);
    showToast('No se pudo comunicar con el generador de IA.');
  }
}

window.closeCarModal = () => {
  document.getElementById('carModal').classList.remove('active');
};
window.editCar = openCarModal;

async function handleCarSubmit(e) {
  e.preventDefault();
  const idMode = document.getElementById('cId').value;
  const carId = idMode || 'CAR-' + Date.now();

  let agentId = currentUser.username;
  let adminNote = '';
  if (currentUser.role === 'admin') {
    agentId = document.getElementById('cAgentId').value || currentUser.username;
    adminNote = document.getElementById('cAdminNote').value;
  }

  // if editing, preserve status, else \"disponible\"
  let existingStatus = 'disponible';
  if (idMode) {
    const existing = await window.DB.get('cars', idMode);
    if (existing) existingStatus = existing.status;
  }

  const imgsArr = document.getElementById('cImgs').value.split(',').map(s => s.trim()).filter(s => s.length > 0);

  const carData = {
    id: carId,
    agentId,
    adminNote,
    brand: document.getElementById('cBrand').value,
    model: document.getElementById('cModel').value,
    year: parseInt(document.getElementById('cYear').value),
    price: parseFloat(document.getElementById('cPrice').value),
    category: document.getElementById('cCat').value,
    condition: document.getElementById('cCond').value,
    mileage: parseInt(document.getElementById('cMiles').value),
    images: imgsArr,
    description: document.getElementById('cDesc').value,
    status: existingStatus
  };

  await window.DB.add('cars', carData);
  showToast(idMode ? 'Auto actualizado' : 'Auto añadido exitosamente');
  closeCarModal();
  loadView(currentView);
}

// Funciones del Modal Add/Edit Usuario
function openUserModal(username = null) {
  document.getElementById('userForm').reset();
  document.getElementById('uOriginalUsername').value = '';
  document.getElementById('uUsername').disabled = false;

  if (username) {
    document.getElementById('modalUserTitle').innerText = 'Editar Usuario';
    const user = allData.find(u => u.username === username);
    if (user) {
      document.getElementById('uOriginalUsername').value = user.username;
      document.getElementById('uUsername').value = user.username;
      document.getElementById('uUsername').disabled = true; // No permitir cambiar username
      document.getElementById('uPassword').value = user.password;
      document.getElementById('uName').value = user.name;
      document.getElementById('uLastName').value = user.lastName;
      document.getElementById('uRole').value = user.role;
      document.getElementById('uEmpId').value = user.employeeId || '';
    }
  } else {
    document.getElementById('modalUserTitle').innerText = 'Añadir Usuario';
  }
  document.getElementById('userModal').classList.add('active');
}

window.closeUserModal = () => {
  document.getElementById('userModal').classList.remove('active');
};
window.editUser = openUserModal;

async function handleUserSubmit(e) {
  e.preventDefault();

  const originalUsername = document.getElementById('uOriginalUsername').value;
  const username = document.getElementById('uUsername').value.trim().toLowerCase();

  if (!username) {
    showToast('El nombre de usuario es requerido');
    return;
  }

  const userData = {
    username: username,
    password: document.getElementById('uPassword').value,
    name: document.getElementById('uName').value.trim(),
    lastName: document.getElementById('uLastName').value.trim(),
    role: document.getElementById('uRole').value,
    employeeId: document.getElementById('uEmpId').value.trim()
  };

  try {
    // Check if adding new and it already exists
    if (!originalUsername) {
      const existing = await window.DB.get('users', username);
      if (existing) {
        showToast('Ese nombre de usuario ya existe');
        return;
      }
    }

    await window.DB.add('users', userData);
    showToast(originalUsername ? 'Usuario actualizado' : 'Usuario añadido exitosamente');
    closeUserModal();
    loadView(currentView);
  } catch (error) {
    console.error(error);
    showToast('Error al guardar el usuario');
  }
}

window.deleteUser = async (username) => {
  if (confirm(`¿Seguro quieres eliminar al usuario ${username}?`)) {
    try {
      await window.DB.delete('users', username);
      showToast('Usuario eliminado');
      loadView(currentView);
    } catch (error) {
      console.error(error);
      showToast('Error al eliminar usuario');
    }
  }
};


