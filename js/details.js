// Lógica de Detalles de Vehículo y Calculadora

let currentCar = null;
let allCars = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  await window.DB.init();
  await window.DB.seed(); // Asegurar que hay datos
  checkAuth();
  updateCartNav();

  // Obtener ID del URL
  const params = new URLSearchParams(window.location.search);
  const carId = params.get('id');

  if (!carId) {
    document.getElementById('detailsContainer').innerHTML = '<p>Vehículo no encontrado.</p>';
    return;
  }

  allCars = await window.DB.getAll('cars');
  currentCar = allCars.find(c => c.id === carId);

  if (!currentCar) {
    document.getElementById('detailsContainer').innerHTML = '<p>Vehículo no encontrado.</p>';
    return;
  }

  renderDetails();
  renderRelated();
});

function checkAuth() {
  const userStr = localStorage.getItem('currentUser');
  if (userStr) {
    currentUser = JSON.parse(userStr);

    const userDisplay = document.getElementById('userNameDisplay');
    if (userDisplay) {
      const roleName = currentUser.role === 'admin' ? 'Admin' : (currentUser.role === 'agent' ? 'Agente' : 'Cliente');
      userDisplay.innerText = `Hola, ${currentUser.name} (${roleName})`;
      userDisplay.style.display = 'inline-block';
    }

    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'inline-block';

    if (currentUser.role === 'buyer') {
      document.getElementById('cartBtn').style.display = 'inline-block';
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });
}

function showToast(msg) {
  const toast = document.getElementById('toastMessage');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function renderDetails() {
  const container = document.getElementById('detailsContainer');
  const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(currentCar.price);

  let imagesHtml = '';
  if (currentCar.images && currentCar.images.length > 0) {
    imagesHtml = `
      <img src=\"${currentCar.images[0]}\" id=\"mainImage\" class=\"main-image\">
      <div class=\"thumbnails\">
        ${currentCar.images.map((img, idx) => `<img src=\"${img}\" class=\"${idx === 0 ? 'active' : ''}\" onclick=\"changeMainImage(this, '${img}')\">`).join('')}
      </div>
    `;
  } else {
    imagesHtml = `<img src=\"https://via.placeholder.com/800x600?text=No+Image\" class=\"main-image\">`;
  }

  const disableBuy = currentCar.status !== 'disponible';
  let buyBtnHtml = '';

  if (currentUser && currentUser.role === 'buyer') {
    buyBtnHtml = `
      <button 
        class=\"btn btn-primary\" 
        style=\"width:100%; padding: 1rem; font-size: 1.1rem;\" 
        onclick=\"addToCart('${currentCar.id}')\" 
        ${disableBuy ? 'disabled' : ''}>
        ${disableBuy ? 'No Disponible' : 'Añadir al Carrito'}
      </button>`;
  } else if (!currentUser) {
    buyBtnHtml = `<div style=\"padding:1rem; background:rgba(255,255,255,0.05); text-align:center; border: 1px solid var(--border-color);\">Inicia sesión como comprador para adquirir este vehículo.</div>`;
  }

  container.innerHTML = `
    <div class=\"images-section\">
      ${imagesHtml}
    </div>
    <div class=\"info-section\">
      <span class=\"car-badge\" style=\"position:static; display:inline-block; margin-bottom:1rem;\">${currentCar.condition}</span>
      <h1 style=\"font-size: 2.5rem; margin-bottom: 0.5rem;\">${currentCar.brand} ${currentCar.model}</h1>
      <div class=\"price-tag\">${formattedPrice}</div>
      <p style=\"color: var(--text-muted); font-size: 1.1rem; margin-bottom: 2rem;\">${currentCar.description}</p>
      
      <div class=\"specs-grid\">
        <div class=\"spec-item\"><span>Año</span><strong>${currentCar.year}</strong></div>
        <div class=\"spec-item\"><span>Millaje</span><strong>${currentCar.mileage.toLocaleString()} mi</strong></div>
        <div class=\"spec-item\"><span>Categoría</span><strong>${currentCar.category}</strong></div>
        <div class=\"spec-item\"><span>Estado</span><strong>${currentCar.status.toUpperCase()}</strong></div>
      </div>

      ${buyBtnHtml}
    </div>
  `;

  // Attach event listeners for Buy and Reserve if they existed
  if (currentUser && currentUser.role === 'buyer' && !disableBuy) {
    document.getElementById('actionButtonsContainer').style.display = 'block';
    document.getElementById('btnBuyNow').addEventListener('click', () => processAction('Comprado'));
    document.getElementById('btnReserve').addEventListener('click', () => processAction('Reservado'));
  }
}

async function processAction(actionType) {
  try {
    currentCar.status = 'pendiente';
    await window.DB.add('cars', currentCar);
    showToast(`¡Vehículo ${actionType} exitosamente! Nos contactaremos pronto.`);
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2500);
  } catch (e) {
    console.error(e);
    showToast('Error procesando la solicitud.');
  }
}

window.changeMainImage = (elem, src) => {
  document.getElementById('mainImage').src = src;
  document.querySelectorAll('.thumbnails img').forEach(img => img.classList.remove('active'));
  elem.classList.add('active');
};

window.calculateLoan = () => {
  const price = currentCar.price;
  const down = parseFloat(document.getElementById('calcDown').value) || 0;
  const months = parseInt(document.getElementById('calcMonths').value);
  const apr = parseFloat(document.getElementById('calcAPR').value) || 0;

  const principal = price - down;
  if (principal <= 0) {
    document.getElementById('monthlyPayment').innerText = '$0.00';
    document.getElementById('calcResultBox').style.display = 'block';
    return;
  }

  const r = (apr / 100) / 12;
  const n = months;

  let monthly = 0;
  if (r === 0) {
    monthly = principal / n;
  } else {
    monthly = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  document.getElementById('monthlyPayment').innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(monthly);
  document.getElementById('calcResultBox').style.display = 'block';
};

function renderRelated() {
  const grid = document.getElementById('relatedGrid');
  // Filtrar carros de la misma categoría o marca, excluir el actual, max 3
  const related = allCars.filter(c => c.id !== currentCar.id && c.status === 'disponible' && (c.category === currentCar.category || c.brand === currentCar.brand)).slice(0, 3);

  if (related.length === 0) {
    grid.innerHTML = '<p style=\"color: var(--text-muted);\">No hay recomendaciones disponibles por el momento.</p>';
    return;
  }

  related.forEach(car => {
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(car.price);
    const card = document.createElement('div');
    card.className = 'car-card';
    card.innerHTML = `
      <div class=\"car-img-wrapper\">
        <img src=\"${car.images[0] || 'https://via.placeholder.com/400x300'}\" class=\"car-img\">
      </div>
      <div class=\"car-info\">
        <h3 class=\"car-title\">${car.brand} ${car.model}</h3>
        <div class=\"car-price\" style=\"font-size:1.2rem;\">${formattedPrice}</div>
        <a href=\"detalles.html?id=${car.id}\" class=\"btn btn-outline\" style=\"width:100%; padding:0.5rem;\">Ver Vehículo</a>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Cart Logic
window.addToCart = (carId) => {
  let cart = JSON.parse(localStorage.getItem('userCart')) || [];
  if (cart.includes(carId)) {
    showToast('El vehículo ya está en tu carrito');
    return;
  }
  cart.push(carId);
  localStorage.setItem('userCart', JSON.stringify(cart));
  showToast('Añadido al carrito con éxito');
  updateCartNav();
};

function updateCartNav() {
  if (currentUser && currentUser.role === 'buyer') {
    const cart = JSON.parse(localStorage.getItem('userCart')) || [];
    document.getElementById('cartCount').innerText = cart.length;
  }
}


