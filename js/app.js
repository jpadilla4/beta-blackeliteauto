// Lógica principal de la página de inicio (Renderizado y Búsqueda en Vivo)

let allCars = [];
let filteredCars = [];
let currentPage = 1;
const carsPerPage = 6;
let currentUser = null;
let compareList = JSON.parse(localStorage.getItem('compareList')) || [];

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar DB
  await window.DB.init();
  await window.DB.seed(); // Para insertar datos de prueba si no existen

  // Check auth
  checkAuth();
  updateCompareNav();

  // Cargar carros
  allCars = await window.DB.getAll('cars');
  // Mostrar solo los disponibles
  allCars = allCars.filter(c => c.status === 'disponible');
  filteredCars = [...allCars];

  renderCars();
  setupSearch();
});

function checkAuth() {
  const loggedInUserStr = localStorage.getItem('currentUser');
  if (loggedInUserStr) {
    currentUser = JSON.parse(loggedInUserStr);

    const userDisplay = document.getElementById('userNameDisplay');
    if (userDisplay) {
      const roleName = currentUser.role === 'admin' ? 'Admin' : (currentUser.role === 'agent' ? 'Agente' : 'Cliente');
      userDisplay.innerText = `Hola, ${currentUser.name} (${roleName})`;
      userDisplay.style.display = 'inline-block';
    }

    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'inline-block';

    if (currentUser.role === 'admin' || currentUser.role === 'agent') {
      document.getElementById('inventoryBtn').style.display = 'inline-block';
    }

    if (currentUser.role === 'buyer') {
      document.getElementById('compareLink').style.display = 'inline-block';
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const filterCategory = document.getElementById('filterCategory');
  const filterCondition = document.getElementById('filterCondition');
  const filterPrice = document.getElementById('filterPrice');

  const triggerSearch = () => {
    const query = searchInput.value.toLowerCase();
    const category = filterCategory.value;
    const condition = filterCondition.value;
    const priceRange = filterPrice.value;

    filteredCars = allCars.filter(car => {
      // Buscar por marca, modelo, categoria
      const matchesQuery = car.brand.toLowerCase().includes(query) ||
        car.model.toLowerCase().includes(query) ||
        car.category.toLowerCase().includes(query);

      const matchesCategory = category === '' || car.category === category;
      const matchesCondition = condition === '' || car.condition === condition;

      let matchesPrice = true;
      if (priceRange) {
        const price = car.price;
        if (priceRange === '0-100000') matchesPrice = price <= 100000;
        else if (priceRange === '100000-300000') matchesPrice = price > 100000 && price <= 300000;
        else if (priceRange === '300000-500000') matchesPrice = price > 300000 && price <= 500000;
        else if (priceRange === '500000+') matchesPrice = price > 500000;
      }

      return matchesQuery && matchesCategory && matchesCondition && matchesPrice;
    });

    currentPage = 1;
    renderCars();
  };

  // Live search
  searchInput.addEventListener('input', triggerSearch);
  filterCategory.addEventListener('change', triggerSearch);
  filterCondition.addEventListener('change', triggerSearch);
  filterPrice.addEventListener('change', triggerSearch);
}

function renderCars() {
  const grid = document.getElementById('inventoryGrid');
  grid.innerHTML = '';

  if (filteredCars.length === 0) {
    grid.innerHTML = '<p style=\"grid-column: 1 / -1; text-align: center; color: var(--text-muted);\">No se encontraron vehículos.</p>';
    renderPagination();
    return;
  }

  const startIndex = (currentPage - 1) * carsPerPage;
  const endIndex = startIndex + carsPerPage;
  const carsToShow = filteredCars.slice(startIndex, endIndex);

  carsToShow.forEach(car => {
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(car.price);

    const isCompared = compareList.some(c => c.id === car.id);
    let compareBtnHtml = '';
    if (currentUser && currentUser.role === 'buyer') {
      compareBtnHtml = `<button onclick=\"toggleCompare('${car.id}')\" class=\"btn ${isCompared ? 'btn-primary' : 'btn-outline'}\" style=\"flex: 1; padding: 0.5rem; justify-content: center; font-size: 0.9rem;\">${isCompared ? 'Comparando' : 'Comparar'}</button>`;
    }

    const card = document.createElement('div');
    card.className = 'car-card';
    card.innerHTML = `
      <div class=\"car-img-wrapper\">
        <span class=\"car-badge\">${car.condition}</span>
        <img src=\"${car.images[0] || 'https://via.placeholder.com/400x300?text=No+Image'}\" alt=\"${car.brand} ${car.model}\" class=\"car-img\">
      </div>
      <div class=\"car-info\">
        <h3 class=\"car-title\">${car.brand} ${car.model} (${car.year})</h3>
        <div class=\"car-price\">${formattedPrice}</div>
        <div class=\"car-specs\">
          <span>${car.mileage.toLocaleString()} mi</span>
          <span>${car.category}</span>
        </div>
        <p style=\"color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem; flex: 1;\">${car.description.substring(0, 60)}...</p>
        <div class=\"car-footer\" style=\"gap: 0.5rem;\">
          <a href=\"detalles.html?id=${car.id}\" class=\"btn btn-primary\" style=\"flex: 2; padding: 0.5rem;\">Ver Detalles</a>
          ${compareBtnHtml}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  renderPagination();
}

function renderPagination() {
  const controls = document.getElementById('paginationControls');
  controls.innerHTML = '';

  const totalPages = Math.ceil(filteredCars.length / carsPerPage);
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
    btn.innerText = i;
    btn.onclick = () => {
      currentPage = i;
      renderCars();
      window.scrollTo({ top: document.querySelector('.search-container').offsetTop - 100, behavior: 'smooth' });
    };
    controls.appendChild(btn);
  }
}

window.toggleCompare = (carId) => {
  if (!currentUser || currentUser.role !== 'buyer') {
    showToast('Inicia sesión como comprador para comparar.');
    return;
  }

  const index = compareList.findIndex(c => c.id === carId);
  if (index >= 0) {
    compareList.splice(index, 1);
    showToast('Removido de la lista de comparación');
  } else {
    if (compareList.length >= 3) {
      showToast('Puedes comparar hasta 3 vehículos a la vez');
      return;
    }
    const car = allCars.find(c => c.id === carId);
    compareList.push(car);
    showToast('Añadido a la lista de comparación');
  }

  localStorage.setItem('compareList', JSON.stringify(compareList));
  updateCompareNav();
  renderCars(); // re-render para actualizar el botón
};

function updateCompareNav() {
  if (currentUser && currentUser.role === 'buyer') {
    const compareCount = document.getElementById('compareCount');
    if (compareCount) compareCount.innerText = `(${compareList.length})`;
    const compareLink = document.getElementById('compareLink');
    if (compareLink && compareList.length > 0) {
      compareLink.href = 'comparar.html';
    }
  }
}

window.showToast = (msg) => {
  const toast = document.getElementById('toastMessage');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
};


