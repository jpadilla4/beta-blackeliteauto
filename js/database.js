// Manejo de la base de datos a través de Backend Python (Flask API)

class Database {
  constructor() {
    this.apiUrl = '/api/';
  }

  // init y seed ya no manejan IndexedDB. Todo lo hace app.py.
  // Mantenemos los métodos vacíos o que retornen promise resuelta
  // para no romper app.js, auth.js, etc.
  async init() {
    console.log('API Client inicializado');
    return Promise.resolve();
  }

  async seed() {
    console.log('Seeding es manejado por el backend Python');
    return Promise.resolve();
  }

  // Funciones utilitarias CRUD haciendo fetch al backend
  async add(storeName, data) {
    try {
      const response = await fetch(`${this.apiUrl}${storeName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Error en add ' + storeName);
      return await response.json();
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async get(storeName, key) {
    try {
      const response = await fetch(`${this.apiUrl}${storeName}/${key}`);
      if (response.status === 404) return null; // No encontrado
      if (!response.ok) throw new Error('Error en get ' + storeName);
      return await response.json();
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async getAll(storeName) {
    try {
      const response = await fetch(`${this.apiUrl}${storeName}`);
      if (!response.ok) throw new Error('Error en getAll ' + storeName);
      return await response.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async count(storeName) {
    try {
      const all = await this.getAll(storeName);
      return all.length;
    } catch (e) {
      return 0;
    }
  }

  async delete(storeName, key) {
    try {
      const response = await fetch(`${this.apiUrl}${storeName}/${key}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Error en delete ' + storeName);
      return await response.json();
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}

// Exportamos instancia global para usar en el navegador
window.DB = new Database();


