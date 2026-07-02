const mysql = require('mysql2/promise');

// ==================== CONFIGURATION MYSQL ====================
// Pool de connexions optimisé pour 2000 utilisateurs simultanés
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gsi_database',
    waitForConnections: true,
    connectionLimit: 1000, // 1000 connexions pour 2000 utilisateurs
    queueLimit: 0,
    maxIdle: 500, // Maintenir 500 connexions idle
    idleTimeout: 60000, // 60 secondes
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    multipleStatements: false, // Sécurité SQL injection
    charset: 'utf8mb4', // Support Unicode complet
    timezone: '+00:00'
});

// ==================== TEST CONNEXION ====================
async function testConnection() {
    try {
        console.log('🔍 Tentative de connexion MySQL...');
        console.log('   Host:', process.env.DB_HOST || 'localhost');
        console.log('   Database:', process.env.DB_NAME || 'gsi_database');
        console.log('   User:', process.env.DB_USER || 'root');
        
        const connection = await pool.getConnection();
        console.log('✅ Connexion MySQL réussie');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Erreur connexion MySQL:', error.message);
        console.error('');
        console.error('🔧 VÉRIFICATIONS NÉCESSAIRES:');
        console.error('   1. Le fichier .env est-il dans le bon dossier ?');
        console.error('   2. Les identifiants MySQL sont-ils corrects ?');
        console.error('   3. MySQL est-il démarré sur le serveur ?');
        console.error('   4. La base de données existe-t-elle ?');
        console.error('');
        console.error('📁 Fichier .env attendu avec:');
        console.error('   DB_HOST=localhost');
        console.error('   DB_NAME=groupegs_messenger-ai-agent');
        console.error('   DB_USER=groupegs_messenger-ai-agent');
        console.error('   DB_PASSWORD=GSI-data-base');
        console.error('');
        return false;
    }
}

// ==================== INITIALISATION TABLES ====================
async function initializeTables() {
    try {
        const connection = await pool.getConnection();
        
        // Table collections - Métadonnées des collections
        await connection.query(`
            CREATE TABLE IF NOT EXISTS collections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Table documents - Données JSON de chaque collection
        await connection.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                collection_name VARCHAR(255) NOT NULL,
                doc_id VARCHAR(255) NOT NULL,
                data JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_doc (collection_name, doc_id),
                INDEX idx_collection (collection_name),
                INDEX idx_doc_id (doc_id),
                FOREIGN KEY (collection_name) REFERENCES collections(name) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Table file_metadata - Métadonnées + contenu des fichiers (photos, PDF, etc.)
        // file_data LONGBLOB stocke le fichier directement dans MySQL (plus de fichiers disque)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS file_metadata (
                id INT AUTO_INCREMENT PRIMARY KEY,
                file_id VARCHAR(255) UNIQUE NOT NULL,
                originalname VARCHAR(500) NOT NULL,
                filename VARCHAR(500) NOT NULL,
                mimetype VARCHAR(100),
                size BIGINT,
                category VARCHAR(50),
                description TEXT,
                file_data LONGBLOB,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_file_id (file_id),
                INDEX idx_category (category),
                INDEX idx_uploaded_at (uploaded_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Migration : ajouter file_data si la table existait déjà sans cette colonne
        try {
            await connection.query(`ALTER TABLE file_metadata ADD COLUMN file_data LONGBLOB`);
            console.log('✅ Migration: colonne file_data ajoutée à file_metadata');
        } catch (alterErr) {
            if (alterErr.errno !== 1060) throw alterErr; // 1060 = colonne existe déjà, normal
        }

        console.log('✅ Tables MySQL initialisées (collections, documents, file_metadata)');
        connection.release();
    } catch (error) {
        console.error('❌ Erreur initialisation tables:', error.message);
        throw error;
    }
}

// ==================== FONCTIONS COLLECTIONS ====================

async function getCollections() {
    const [rows] = await pool.query(
        'SELECT name, description, created_at, updated_at FROM collections ORDER BY name'
    );
    return rows;
}

async function createCollection(name, description = '') {
    const [result] = await pool.query(
        'INSERT INTO collections (name, description) VALUES (?, ?)',
        [name, description]
    );
    return { name, description };
}

async function deleteCollection(name) {
    const [result] = await pool.query('DELETE FROM collections WHERE name = ?', [name]);
    return result.affectedRows > 0;
}

async function getCollectionStats(name) {
    const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM documents WHERE collection_name = ?',
        [name]
    );
    return rows[0].count;
}

// ==================== FONCTIONS DOCUMENTS ====================

async function getDocuments(collectionName, query = {}) {
    let sql = 'SELECT doc_id, data, created_at, updated_at FROM documents WHERE collection_name = ?';
    const params = [collectionName];
    
    const [rows] = await pool.query(sql, params);
    
    // Convertir JSON en objets et ajouter _id
    let documents = rows.map(row => {
        const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        doc._id = row.doc_id;
        return doc;
    });
    
    // Appliquer les filtres de recherche
    if (query && Object.keys(query).length > 0) {
        documents = documents.filter(doc => {
            return Object.keys(query).every(key => {
                const q = query[key];
                if (q && typeof q === 'object') {
                    if (q.$gt !== undefined) return doc[key] > q.$gt;
                    if (q.$lt !== undefined) return doc[key] < q.$lt;
                    if (q.$gte !== undefined) return doc[key] >= q.$gte;
                    if (q.$lte !== undefined) return doc[key] <= q.$lte;
                    if (q.$ne !== undefined) return doc[key] !== q.$ne;
                    if (q.$in !== undefined) return Array.isArray(q.$in) && q.$in.includes(doc[key]);
                    if (q.$nin !== undefined) return Array.isArray(q.$nin) && !q.$nin.includes(doc[key]);
                    if (q.$regex !== undefined) {
                        const regex = new RegExp(q.$regex, q.$options || 'i');
                        return regex.test(String(doc[key] || ''));
                    }
                }
                return doc[key] === q;
            });
        });
    }
    
    return documents;
}

async function insertDocument(collectionName, docId, data) {
    // S'assurer que la collection existe
    await pool.query(
        'INSERT IGNORE INTO collections (name) VALUES (?)',
        [collectionName]
    );
    
    const [result] = await pool.query(
        'INSERT INTO documents (collection_name, doc_id, data) VALUES (?, ?, ?)',
        [collectionName, docId, JSON.stringify(data)]
    );
    return { _id: docId, ...data };
}

async function updateDocument(collectionName, docId, data) {
    const [result] = await pool.query(
        'UPDATE documents SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE collection_name = ? AND doc_id = ?',
        [JSON.stringify(data), collectionName, docId]
    );
    return result.affectedRows > 0;
}

async function deleteDocument(collectionName, docId) {
    const [result] = await pool.query(
        'DELETE FROM documents WHERE collection_name = ? AND doc_id = ?',
        [collectionName, docId]
    );
    return result.affectedRows > 0;
}

async function deleteDocuments(collectionName, docIds) {
    if (!Array.isArray(docIds) || docIds.length === 0) return 0;
    
    const placeholders = docIds.map(() => '?').join(',');
    const [result] = await pool.query(
        `DELETE FROM documents WHERE collection_name = ? AND doc_id IN (${placeholders})`,
        [collectionName, ...docIds]
    );
    return result.affectedRows;
}

async function getDocumentById(collectionName, docId) {
    const [rows] = await pool.query(
        'SELECT data FROM documents WHERE collection_name = ? AND doc_id = ?',
        [collectionName, docId]
    );
    
    if (rows.length === 0) return null;
    
    const doc = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    doc._id = docId;
    return doc;
}

// ==================== FONCTIONS FICHIERS ====================

// Sauvegarder métadonnées + contenu binaire dans MySQL
// buffer = req.file.buffer (depuis multer memoryStorage)
async function saveFileMetadata(fileData, buffer) {
    const [result] = await pool.query(
        `INSERT INTO file_metadata 
        (file_id, originalname, filename, mimetype, size, category, description, file_data) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            fileData._id,
            fileData.originalname,
            fileData.filename,
            fileData.mimetype,
            fileData.size,
            fileData.category,
            fileData.description || null,
            buffer
        ]
    );
    return fileData;
}

// Métadonnées uniquement (sans le BLOB) - pour lister, supprimer, etc.
async function getFileMetadata(fileId) {
    const [rows] = await pool.query(
        'SELECT file_id, originalname, filename, mimetype, size, category, description, uploaded_at FROM file_metadata WHERE file_id = ?',
        [fileId]
    );
    
    if (rows.length === 0) return null;
    
    return {
        _id: rows[0].file_id,
        originalname: rows[0].originalname,
        filename: rows[0].filename,
        mimetype: rows[0].mimetype,
        size: rows[0].size,
        category: rows[0].category,
        description: rows[0].description,
        uploadedAt: rows[0].uploaded_at
    };
}

// Métadonnées + contenu binaire - pour view et download
async function getFileData(fileId) {
    const [rows] = await pool.query(
        'SELECT file_id, originalname, filename, mimetype, size, category, description, uploaded_at, file_data FROM file_metadata WHERE file_id = ?',
        [fileId]
    );
    
    if (rows.length === 0) return null;
    
    return {
        _id: rows[0].file_id,
        originalname: rows[0].originalname,
        filename: rows[0].filename,
        mimetype: rows[0].mimetype,
        size: rows[0].size,
        category: rows[0].category,
        description: rows[0].description,
        uploadedAt: rows[0].uploaded_at,
        data: rows[0].file_data ? Buffer.from(rows[0].file_data) : null
    };
}

async function getAllFileMetadata(category = null, searchTerm = null) {
    let sql = 'SELECT file_id, originalname, filename, mimetype, size, category, description, uploaded_at FROM file_metadata WHERE 1=1';
    const params = [];
    
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    
    if (searchTerm) {
        sql += ' AND (originalname LIKE ? OR description LIKE ?)';
        const searchPattern = `%${searchTerm}%`;
        params.push(searchPattern, searchPattern);
    }
    
    sql += ' ORDER BY uploaded_at DESC';
    
    const [rows] = await pool.query(sql, params);
    
    return rows.map(row => ({
        _id: row.file_id,
        originalname: row.originalname,
        filename: row.filename,
        mimetype: row.mimetype,
        size: row.size,
        category: row.category,
        description: row.description,
        uploadedAt: row.uploaded_at
    }));
}

async function deleteFileMetadata(fileId) {
    const [result] = await pool.query(
        'DELETE FROM file_metadata WHERE file_id = ?',
        [fileId]
    );
    return result.affectedRows > 0;
}

async function getFileCount() {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM file_metadata');
    return rows[0].count;
}

// ==================== RECHERCHE GLOBALE ====================

async function globalSearch(query, collectionNames = null) {
    const results = {};
    
    // Obtenir toutes les collections si non spécifié
    if (!collectionNames) {
        const collections = await getCollections();
        collectionNames = collections.map(c => c.name);
    }
    
    // Chercher dans chaque collection
    for (const collectionName of collectionNames) {
        const docs = await getDocuments(collectionName, query);
        if (docs.length > 0) {
            results[collectionName] = docs;
        }
    }
    
    return results;
}

// ==================== EXPORTS ====================

module.exports = {
    pool,
    testConnection,
    initializeTables,
    getCollections,
    createCollection,
    deleteCollection,
    getCollectionStats,
    getDocuments,
    insertDocument,
    updateDocument,
    deleteDocument,
    deleteDocuments,
    getDocumentById,
    saveFileMetadata,
    getFileMetadata,
    getFileData,
    getAllFileMetadata,
    deleteFileMetadata,
    getFileCount,
    globalSearch
};
