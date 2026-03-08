from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')

DB_PATH = 'database.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Tabla Users
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT,
            role TEXT,
            name TEXT,
            lastName TEXT,
            employeeId TEXT
        )
    ''')
    
    # Tabla Cars
    # Usamos JSON de texto para 'images' para simplificar
    c.execute('''
        CREATE TABLE IF NOT EXISTS cars (
            id TEXT PRIMARY KEY,
            agentId TEXT,
            brand TEXT,
            model TEXT,
            year INTEGER,
            price REAL,
            category TEXT,
            condition TEXT,
            mileage INTEGER,
            description TEXT,
            images TEXT,
            status TEXT,
            adminNote TEXT,
            soldPrice REAL
        )
    ''')
    
    conn.commit()
    
    # Semilla básica de Admin (si no hay)
    c.execute('SELECT COUNT(*) FROM users')
    if c.fetchone()[0] == 0:
        c.execute('''
            INSERT INTO users (username, password, role, name, lastName, employeeId)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ('admin', 'admin123', 'admin', 'Gerente', 'General', ''))
        
        c.execute('''
            INSERT INTO users (username, password, role, name, lastName, employeeId)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ('jpadilla', '123', 'agent', 'Jonathan', 'Padilla', 'EMP-001'))
        
        c.execute('''
            INSERT INTO users (username, password, role, name, lastName, employeeId)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ('jdoe', '123', 'buyer', 'John', 'Doe', ''))
        conn.commit()
        
    conn.close()

# ---- RUTAS FRONTEND ----
@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(BASE_DIR, path)


# ---- RUTAS API CARS ----
@app.route('/api/cars', methods=['GET'])
def get_cars():
    conn = get_db_connection()
    cars = conn.execute('SELECT * FROM cars').fetchall()
    conn.close()
    
    result = []
    for row in cars:
        car_dict = dict(row)
        # Parse images JSON string back to list
        if car_dict['images']:
            car_dict['images'] = json.loads(car_dict['images'])
        else:
            car_dict['images'] = []
        result.append(car_dict)
        
    return jsonify(result)

@app.route('/api/cars/<car_id>', methods=['GET'])
def get_car(car_id):
    conn = get_db_connection()
    car = conn.execute('SELECT * FROM cars WHERE id = ?', (car_id,)).fetchone()
    conn.close()
    
    if car is None:
        return jsonify({'error': 'Not found'}), 404
        
    car_dict = dict(car)
    if car_dict['images']:
        car_dict['images'] = json.loads(car_dict['images'])
    else:
        car_dict['images'] = []
        
    return jsonify(car_dict)

@app.route('/api/cars', methods=['POST'])
def add_or_update_car():
    data = request.json
    car_id = data.get('id')
    images_str = json.dumps(data.get('images', []))
    
    conn = get_db_connection()
    
    # Check if exists (for UPSERT behavior)
    existing = conn.execute('SELECT id FROM cars WHERE id = ?', (car_id,)).fetchone()
    
    if existing:
        conn.execute('''
            UPDATE cars SET 
            agentId=?, brand=?, model=?, year=?, price=?, category=?, 
            condition=?, mileage=?, description=?, images=?, status=?, 
            adminNote=?, soldPrice=?
            WHERE id=?
        ''', (
            data.get('agentId'), data.get('brand'), data.get('model'), data.get('year'),
            data.get('price'), data.get('category'), data.get('condition'), 
            data.get('mileage'), data.get('description'), images_str, 
            data.get('status', 'disponible'), data.get('adminNote'), data.get('soldPrice'),
            car_id
        ))
    else:
        conn.execute('''
            INSERT INTO cars 
            (id, agentId, brand, model, year, price, category, condition, mileage, description, images, status, adminNote, soldPrice)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            car_id, data.get('agentId'), data.get('brand'), data.get('model'), data.get('year'),
            data.get('price'), data.get('category'), data.get('condition'), 
            data.get('mileage'), data.get('description'), images_str, 
            data.get('status', 'disponible'), data.get('adminNote'), data.get('soldPrice')
        ))
        
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'id': car_id})

@app.route('/api/cars/<car_id>', methods=['DELETE'])
def delete_car(car_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM cars WHERE id = ?', (car_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ---- RUTAS API USERS ----
@app.route('/api/users', methods=['GET'])
def get_users():
    conn = get_db_connection()
    users = conn.execute('SELECT * FROM users').fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

@app.route('/api/users/<username>', methods=['GET'])
def get_user(username):
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    
    if user is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(user))

@app.route('/api/users', methods=['POST'])
def add_user():
    data = request.json
    username = data.get('username')
    
    conn = get_db_connection()
    existing = conn.execute('SELECT username FROM users WHERE username = ?', (username,)).fetchone()
    
    if existing:
         conn.execute('''
            UPDATE users SET 
            password=?, role=?, name=?, lastName=?, employeeId=?
            WHERE username=?
        ''', (
            data.get('password'), data.get('role'), data.get('name'), 
            data.get('lastName'), data.get('employeeId'), username
        ))
    else:
        conn.execute('''
            INSERT INTO users (username, password, role, name, lastName, employeeId)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            username, data.get('password'), data.get('role'), data.get('name'), 
            data.get('lastName'), data.get('employeeId')
        ))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'username': username})

@app.route('/api/users/<username>', methods=['DELETE'])
def delete_user(username):
    conn = get_db_connection()
    conn.execute('DELETE FROM users WHERE username = ?', (username,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ---- RUTA SIMULADOR IA DE DESCRIPCIONES ----
@app.route('/api/generate_desc', methods=['POST'])
def generate_desc():
    data = request.json
    brand = data.get('brand', 'Vehículo')
    model = data.get('model', 'Exclusivo')
    year = data.get('year', '2023')
    category = data.get('category', 'Lujo')
    condition = data.get('condition', 'Usado')
    
    import random
    adjectives = ["impecable", "exclusivo", "potente", "elegante", "sofisticado", "incomparable", "de alto rendimiento"]
    adj1 = random.choice(adjectives)
    adj2 = random.choice([a for a in adjectives if a != adj1])
    
    if condition.lower() == 'nuevo':
        cond_text = "completamente nuevo (0 KM)"
    else:
        cond_text = "en condiciones prístinas y meticulosamente cuidado"
        
    desc = f"Presentamos este {adj1} {brand} {model} del año {year}. Un vehículo de la categoría {category} que redefine la experiencia de conducción. "
    desc += f"Se encuentra {cond_text}, ofreciendo un diseño {adj2} con acabados de primera calidad, tecnología de vanguardia y un motor diseñado para emociones puras. "
    desc += f"Una verdadera joya automotriz lista para ser entregada por Black Elite Auto, donde la exclusividad y el prestigio se encuentran."
    
    return jsonify({'description': desc})

# ---- RUTA IMPORTAR EXCEL ----
@app.route('/api/import_excel', methods=['POST'])
def import_excel():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    try:
        import pandas as pd
        import time
        import random
        
        # Leemos el excel
        df = pd.read_excel(file)
        
        # Normalize columns: lower case and strip
        df.columns = df.columns.astype(str).str.strip().str.lower()
        
        rename_map = {
            'marca': 'brand',
            'modelo': 'model',
            'año': 'year',
            'ano': 'year',
            'precio': 'price',
            'valor': 'price',
            'categoría': 'category',
            'categoria': 'category',
            'condición': 'condition',
            'condicion': 'condition',
            'millaje': 'mileage',
            'kilometraje': 'mileage',
            'descripción': 'description',
            'descripcion': 'description',
            'imágenes': 'images',
            'imagenes': 'images',
            'fotos': 'images',
            'estado': 'status',
            'agente': 'agentid',
            'vendedor': 'agentid',
            'id_agente': 'agentid',
            'id': 'id'
        }
        df = df.rename(columns=rename_map)
        
        # Convertimos NaN a None o valores por defecto
        df = df.fillna('')
        
        conn = get_db_connection()
        count = 0
        
        for index, row in df.iterrows():
            # Generar ID único si no viene en el excel
            car_id = str(row.get('id', ''))
            if not car_id:
                car_id = f"CAR-IMP-{int(time.time() * 1000)}-{random.randint(100,999)}"
            
            # Procesar imágenes (separar por comas si vienen en texto)
            imgs_str = str(row.get('images', ''))
            if imgs_str:
                img_list = [i.strip() for i in imgs_str.split(',') if i.strip()]
            else:
                img_list = []
                
            images_json = json.dumps(img_list)
            
            # Asegurar tipos correctos
            try:
                price = float(row.get('price', 0))
            except:
                price = 0.0
                
            try:
                year = int(row.get('year', 2024))
            except:
                year = 2024
                
            try:
                mileage = int(row.get('mileage', 0))
            except:
                mileage = 0
            
            # Valores por defecto o del excel
            agent_id = str(row.get('agentid', 'admin') or row.get('agentId', 'admin'))
            if not agent_id.strip(): agent_id = 'admin'
                
            brand = str(row.get('brand', 'Desconocido'))
            if not brand.strip(): brand = 'Desconocido'
            
            model = str(row.get('model', 'Auto'))
            if not model.strip(): model = 'Auto'
            
            category = str(row.get('category', 'Otro'))
            if not category.strip(): category = 'Otro'
            
            condition = str(row.get('condition', 'Usado'))
            if not condition.strip(): condition = 'Usado'
            
            description = str(row.get('description', ''))
            
            status = str(row.get('status', 'disponible')).lower()
            if not status.strip(): status = 'disponible'
            
            # Insertar en base de datos. Usamos REPLACE or IGNORE o UPDATE según lógica
            existing = conn.execute('SELECT id FROM cars WHERE id = ?', (car_id,)).fetchone()
            
            if existing:
                conn.execute('''
                    UPDATE cars SET 
                    agentId=?, brand=?, model=?, year=?, price=?, category=?, 
                    condition=?, mileage=?, description=?, images=?, status=?
                    WHERE id=?
                ''', (
                    agent_id, brand, model, year, price, category, 
                    condition, mileage, description, images_json, status, car_id
                ))
            else:
                conn.execute('''
                    INSERT INTO cars 
                    (id, agentId, brand, model, year, price, category, condition, mileage, description, images, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    car_id, agent_id, brand, model, year, price, category, condition, 
                    mileage, description, images_json, status
                ))
            count += 1
            
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'imported': count})
        
    except Exception as e:
        print("Error importing excel:", e)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    # Ejecutando en puerto 5000
    app.run(debug=True, port=5000)
