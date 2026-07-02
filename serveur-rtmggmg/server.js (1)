require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

// Import des fonctions MySQL
const db = require('./database');

const app = express();

// Trust proxy (requis quand derrière nginx/Apache)
app.set('trust proxy', true);

// ==================== CONFIGURATION ====================
const PORT = process.env.PORT || 3000;

// index.html se trouve dans public/
const PUBLIC_DIR = path.join(__dirname, 'public');
const BACKUP_DIR  = path.join(__dirname, 'data', 'backups');

// Créer les dossiers nécessaires
[PUBLIC_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('📁 Dossier créé:', dir);
    }
});

// ==================== MIDDLEWARES ====================
app.use(helmet({ 
    crossOriginResourcePolicy: { policy: 'cross-origin' }, 
    contentSecurityPolicy: false 
}));

app.use(cors({ 
    origin: '*', 
    methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'], 
    allowedHeaders: ['Content-Type','Authorization','X-Requested-With'] 
}));

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting pour 2000 utilisateurs
const limiter = rateLimit({ 
    windowMs: 15*60*1000, // 15 minutes
    max: 2000, // 2000 requêtes par 15 min
    standardHeaders: true, 
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

app.use('/api/', limiter);
app.use('/rtmggmg/api/', limiter);

// Logger toutes les requêtes
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ==================== MULTER (UPLOAD EN MÉMOIRE → MySQL BLOB) ====================
// Les fichiers transitent en RAM puis sont stockés dans MySQL LONGBLOB
// Plus aucun fichier écrit sur le disque
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

// ==================== HELPERS ====================
function fmtBytes(b) {
    if (!b) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
}

// ==================== DUAL ROUTE HELPER ====================
function R(method, route, ...handlers) {
    app[method](route, ...handlers);
    app[method]('/rtmggmg' + route, ...handlers);
}

// ==================== HTML (depuis public/) ====================
app.get(['/', '/index.html', '/dashboard', '/rtmggmg', '/rtmggmg/', '/rtmggmg/index.html', '/rtmggmg/dashboard'], (req, res) => {
    const p = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(p)) return res.sendFile(p);
    res.status(404).send('index.html introuvable');
});

// Fichiers statiques du dossier public/
app.use(express.static(PUBLIC_DIR));
app.use('/rtmggmg', express.static(PUBLIC_DIR));

// ==================== STATUS ====================
R('get', '/api/status', async (req, res) => {
    try {
        const collections = await db.getCollections();
        const filesCount = await db.getFileCount();
        
        res.json({ 
            status: 'online',
            timestamp: new Date().toISOString(),
            version: '3.1.0-MySQL',
            database: 'MySQL',
            collections: collections.map(c => c.name),
            collectionsCount: collections.length,
            filesCount: filesCount,
            uptime: process.uptime()
        });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// ==================== COLLECTIONS ====================
R('get', '/api/collections', async (req, res) => {
    try {
        const collections = await db.getCollections();
        
        const enriched = await Promise.all(collections.map(async (col) => {
            const count = await db.getCollectionStats(col.name);
            return {
                name: col.name,
                description: col.description,
                count: count,
                updatedAt: col.updated_at
            };
        }));
        
        res.json(enriched);
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

R('post', '/api/collections', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Nom requis' });
        
        await db.createCollection(name, description || '');
        res.status(201).json({ 
            message: 'Collection créée',
            name,
            description 
        });
    } catch(e) { 
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Collection existe déjà' });
        }
        res.status(500).json({ error: e.message }); 
    }
});

R('delete', '/api/collections/:name', async (req, res) => {
    try {
        const deleted = await db.deleteCollection(req.params.name);
        
        if (deleted) {
            res.json({ 
                message: 'Collection supprimée',
                deleted: true 
            });
        } else {
            res.status(404).json({ error: 'Collection non trouvée' });
        }
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// ==================== DOCUMENTS (Routes /api/db/) ====================
// GET /api/db/:collection - Lire tous les documents avec filtres
R('get', '/api/db/:collection', async (req, res) => {
    try {
        let query = {};
        
        // Filtre JSON
        if (req.query.q) {
            try {
                query = JSON.parse(req.query.q);
            } catch (e) {
                return res.status(400).json({ error: 'Format de filtre invalide' });
            }
        }
        
        // Recherche texte
        if (req.query.search) {
            // Recherche basique dans tous les champs
            query.$search = req.query.search;
        }
        
        let documents = await db.getDocuments(req.params.collection, query);
        
        // Recherche texte (implémentation simple)
        if (req.query.search) {
            const searchTerm = req.query.search.toLowerCase();
            documents = documents.filter(doc => {
                return Object.values(doc).some(val => 
                    String(val).toLowerCase().includes(searchTerm)
                );
            });
        }
        
        // Tri
        if (req.query.sort) {
            const sortField = req.query.sort;
            const order = req.query.order === 'desc' ? -1 : 1;
            documents.sort((a, b) => {
                if (a[sortField] < b[sortField]) return -1 * order;
                if (a[sortField] > b[sortField]) return 1 * order;
                return 0;
            });
        }
        
        // Pagination
        if (req.query.page && req.query.limit) {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const start = (page - 1) * limit;
            const end = start + limit;
            const total = documents.length;
            
            documents = documents.slice(start, end);
            
            return res.json({
                data: documents,
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            });
        }
        
        res.json(documents);
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// GET /api/db/:collection/:id - Lire un document
R('get', '/api/db/:collection/:id', async (req, res) => {
    try {
        const doc = await db.getDocumentById(req.params.collection, req.params.id);
        
        if (doc) {
            res.json(doc);
        } else {
            res.status(404).json({ error: 'Document non trouvé' });
        }
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// POST /api/db/:collection - Créer un document
R('post', '/api/db/:collection', async (req, res) => {
    try {
        const data = req.body;
        
        // Auto-générer _id, createdAt, updatedAt
        const docId = data._id || uuidv4();
        delete data._id;
        
        data.createdAt = new Date().toISOString();
        data.updatedAt = new Date().toISOString();
        
        const document = await db.insertDocument(req.params.collection, docId, data);
        res.status(201).json(document);
    } catch(e) { 
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Document avec cet ID existe déjà' });
        }
        res.status(500).json({ error: e.message }); 
    }
});

// PUT /api/db/:collection/:id - Remplacer un document
R('put', '/api/db/:collection/:id', async (req, res) => {
    try {
        const data = req.body;
        delete data._id;
        
        data.updatedAt = new Date().toISOString();
        
        const updated = await db.updateDocument(req.params.collection, req.params.id, data);
        
        if (updated) {
            res.json({ 
                message: 'Document mis à jour',
                _id: req.params.id,
                ...data 
            });
        } else {
            res.status(404).json({ error: 'Document non trouvé' });
        }
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// PATCH /api/db/:collection/:id - Modifier partiellement (merge)
R('patch', '/api/db/:collection/:id', async (req, res) => {
    try {
        const currentDoc = await db.getDocumentById(req.params.collection, req.params.id);
        
        if (!currentDoc) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }
        
        delete currentDoc._id;
        const mergedData = { ...currentDoc, ...req.body };
        mergedData.updatedAt = new Date().toISOString();
        
        await db.updateDocument(req.params.collection, req.params.id, mergedData);
        
        res.json({ 
            message: 'Document modifié',
            _id: req.params.id,
            ...mergedData 
        });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// DELETE /api/db/:collection/:id - Supprimer un document
R('delete', '/api/db/:collection/:id', async (req, res) => {
    try {
        const deleted = await db.deleteDocument(req.params.collection, req.params.id);
        
        if (deleted) {
            res.json({ 
                message: 'Document supprimé',
                deleted: true 
            });
        } else {
            res.status(404).json({ error: 'Document non trouvé' });
        }
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// DELETE /api/db/:collection - Supprimer toute la collection
R('delete', '/api/db/:collection', async (req, res) => {
    try {
        const deleted = await db.deleteCollection(req.params.collection);
        
        if (deleted) {
            res.json({ 
                message: 'Collection supprimée',
                deleted: true 
            });
        } else {
            res.status(404).json({ error: 'Collection non trouvée' });
        }
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// ==================== FICHIERS ====================
// POST /api/upload - Upload fichier unique → stocké dans MySQL BLOB
R('post', '/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier fourni' });
        }
        
        const fileId = uuidv4();
        const mimeBase = (req.file.mimetype || 'other').split('/')[0];
        
        const fileData = {
            _id: fileId,
            originalname: req.file.originalname,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            category: mimeBase,
            description: req.body.description || ''
        };
        
        await db.saveFileMetadata(fileData, req.file.buffer);
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const prefix = req.originalUrl.startsWith('/rtmggmg') ? '/rtmggmg' : '';
        
        res.status(201).json({
            message: 'Fichier uploadé',
            file: fileData,
            viewUrl: `${baseUrl}${prefix}/api/files/view/${fileId}`,
            downloadUrl: `${baseUrl}${prefix}/api/files/download/${fileId}`
        });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// POST /api/upload/multiple - Upload multiples fichiers → stockés dans MySQL BLOB
R('post', '/api/upload/multiple', upload.array('files', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Aucun fichier fourni' });
        }
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const prefix = req.originalUrl.startsWith('/rtmggmg') ? '/rtmggmg' : '';
        
        const uploadedFiles = [];
        
        for (const file of req.files) {
            const fileId = uuidv4();
            const mimeBase = (file.mimetype || 'other').split('/')[0];
            
            const fileData = {
                _id: fileId,
                originalname: file.originalname,
                filename: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                category: mimeBase,
                description: ''
            };
            
            await db.saveFileMetadata(fileData, file.buffer);
            
            uploadedFiles.push({
                ...fileData,
                viewUrl: `${baseUrl}${prefix}/api/files/view/${fileId}`,
                downloadUrl: `${baseUrl}${prefix}/api/files/download/${fileId}`
            });
        }
        
        res.status(201).json({
            message: `${uploadedFiles.length} fichier(s) uploadé(s)`,
            files: uploadedFiles
        });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// GET /api/files - Lister les fichiers
R('get', '/api/files', async (req, res) => {
    try {
        const category = req.query.category || null;
        const search = req.query.search || null;
        
        const files = await db.getAllFileMetadata(category, search);
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const prefix = req.originalUrl.startsWith('/rtmggmg') ? '/rtmggmg' : '';
        
        const enrichedFiles = files.map(f => ({
            ...f,
            viewUrl: `${baseUrl}${prefix}/api/files/view/${f._id}`,
            downloadUrl: `${baseUrl}${prefix}/api/files/download/${f._id}`
        }));
        
        res.json(enrichedFiles);
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// GET /api/files/view/:id - Prévisualiser (lu depuis MySQL BLOB)
R('get', '/api/files/view/:id', async (req, res) => {
    try {
        const file = await db.getFileData(req.params.id);
        
        if (!file) {
            return res.status(404).json({ error: 'Fichier non trouvé' });
        }
        
        const buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
        
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.end(buffer);
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// GET /api/files/download/:id - Télécharger (lu depuis MySQL BLOB)
R('get', '/api/files/download/:id', async (req, res) => {
    try {
        const file = await db.getFileData(req.params.id);
        
        if (!file) {
            return res.status(404).json({ error: 'Fichier non trouvé' });
        }
        
        const buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
        
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalname)}"`);
        res.setHeader('Content-Length', buffer.length);
        res.end(buffer);
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// DELETE /api/files/:id - Supprimer un fichier (supprime de MySQL)
R('delete', '/api/files/:id', async (req, res) => {
    try {
        const file = await db.getFileMetadata(req.params.id);
        
        if (!file) {
            return res.status(404).json({ error: 'Fichier non trouvé' });
        }
        
        // Supprimer de MySQL (métadonnées + BLOB)
        await db.deleteFileMetadata(req.params.id);
        
        res.json({ 
            message: 'Fichier supprimé',
            deleted: true 
        });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// ==================== BACKUP + SEARCH ====================
R('post', '/api/backup', async (req, res) => {
    try {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const dest = path.join(BACKUP_DIR, `backup-${ts}`);
        fs.mkdirSync(dest, { recursive: true });
        
        const collections = await db.getCollections();
        let totalDocs = 0;
        
        for (const col of collections) {
            const documents = await db.getDocuments(col.name);
            fs.writeFileSync(
                path.join(dest, `${col.name}.json`),
                JSON.stringify(documents, null, 2),
                'utf8'
            );
            totalDocs += documents.length;
        }
        
        const files = await db.getAllFileMetadata();
        fs.writeFileSync(
            path.join(dest, '_files.json'),
            JSON.stringify(files, null, 2),
            'utf8'
        );
        
        res.json({ 
            message: 'Sauvegarde créée',
            backup: `backup-${ts}`,
            collections: collections.length,
            documents: totalDocs,
            files: files.length
        });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

R('get', '/api/backups', (req, res) => {
    try {
        const list = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup-'))
            .map(f => {
                const s = fs.statSync(path.join(BACKUP_DIR, f));
                return {
                    name: f,
                    created: s.birthtime,
                    size: s.size
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));
        
        res.json(list);
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

R('post', '/api/search', async (req, res) => {
    try {
        const { query, collections } = req.body;
        const results = await db.globalSearch(query || {}, collections);
        
        const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
        
        res.json({ 
            results,
            total 
        });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// ==================== GALERIE INTÉGRABLE ====================
const handleGallery = async (req, res) => {
    try {
        const cat = req.query.category || '';
        const search = req.query.search || '';
        
        const files = await db.getAllFileMetadata(cat || null, search || null);
        const allFiles = await db.getAllFileMetadata();
        
        const base = `${req.protocol}://${req.get('host')}`;
        const pfx = (req.originalUrl || req.url).startsWith('/rtmggmg') ? '/rtmggmg' : '';
        const cats = [...new Set(allFiles.map(f => f.category).filter(Boolean))];
        const icons = { image: '🖼️', application: '📄', video: '🎥', audio: '🎵', text: '📝' };
        const fb = (b) => {
            if (!b) return '0 B';
            const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(b) / Math.log(k));
            return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
        };
        
        const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Galerie GSI</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#f0f4f8;padding:20px}.hdr{background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px;border-radius:12px;margin-bottom:16px;text-align:center}.hdr h1{font-size:1.6em;margin-bottom:4px}.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.fb{background:white;border:2px solid #e2e8f0;padding:7px 16px;border-radius:20px;cursor:pointer;font-weight:600;color:#4a5568;font-size:.85em;transition:.2s}.fb:hover,.fb.a{background:#667eea;color:white;border-color:#667eea}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}.card{background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);transition:.2s}.card:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,.14)}.prev{height:140px;background:#f7fafc;display:flex;align-items:center;justify-content:center;overflow:hidden}.prev img{width:100%;height:100%;object-fit:cover}.ico{font-size:3em}.body{padding:10px 12px}.nm{font-weight:600;color:#2d3748;font-size:.85em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mt{color:#718096;font-size:.78em;margin-top:3px}.acts{display:flex;gap:5px;padding:0 10px 10px}.btn{flex:1;padding:7px 4px;border:none;border-radius:7px;cursor:pointer;font-size:.8em;font-weight:600;transition:.2s}.bv{background:#ebf8ff;color:#2b6cb0}.bv:hover{background:#bee3f8}.bd{background:#f0fff4;color:#276749}.bd:hover{background:#c6f6d5}.empty{text-align:center;padding:60px;color:#718096}</style></head><body><div class="hdr"><h1>📁 Galerie de fichiers</h1><p>${files.length} fichier(s)</p></div><div class="filters"><button class="fb ${!cat ? 'a' : ''}" onclick="go('')">Tous (${allFiles.length})</button>${cats.map(c => `<button class="fb ${cat === c ? 'a' : ''}" onclick="go('${c}')">${icons[c] || '📎'} ${c}</button>`).join('')}</div>${files.length === 0 ? '<div class="empty">Aucun fichier disponible</div>' : `<div class="grid">${files.map(f => {
            const v = `${base}${pfx}/api/files/view/${f._id}`, d = `${base}${pfx}/api/files/download/${f._id}`, ic = icons[f.category] || '📎';
            return `<div class="card"><div class="prev">${f.category === 'image' ? `<img src="${v}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=ico>🖼️</span>'">` : `<span class="ico">${ic}</span>`}</div><div class="body"><div class="nm" title="${f.originalname}">${f.originalname}</div><div class="mt">${fb(f.size)} • ${new Date(f.uploadedAt).toLocaleDateString('fr')}</div></div><div class="acts"><button class="btn bv" onclick="window.open('${v}','_blank')">👁️ Voir</button><button class="btn bd" onclick="window.open('${d}','_blank')">⬇️ DL</button></div></div>`;
        }).join('')}</div>`}<script>function go(c){const u=new URL(window.location.href);c?u.searchParams.set('category',c):u.searchParams.delete('category');location.href=u.toString()}</script></body></html>`;
        
        res.send(html);
    } catch(e) { 
        res.status(500).send(`<p>Erreur: ${e.message}</p>`); 
    }
};

app.get('/embed/gallery', handleGallery);
app.get('/rtmggmg/embed/gallery', handleGallery);

// ==================== 404 ====================
app.use((req, res) => {
    if (req.path.includes('/api/') || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ 
            error: 'Route non trouvée',
            path: req.path,
            method: req.method 
        });
    }
    res.status(404).json({ error: 'Route non trouvée', path: req.path });
});

app.use((err, req, res, next) => {
    console.error('Erreur:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Fichier trop grand (max 200 MB)' });
    }
    res.status(500).json({ error: 'Erreur serveur', message: err.message });
});

// ==================== START ====================
async function startServer() {
    try {
        // Test connexion MySQL
        const connected = await db.testConnection();
        
        if (!connected) {
            console.error('❌ Impossible de se connecter à MySQL');
            console.error('Vérifiez votre fichier .env et votre connexion MySQL');
            process.exit(1);
        }
        
        // Initialiser les tables
        await db.initializeTables();
        
        // Démarrer le serveur
        app.listen(PORT, () => {
            console.log('╔══════════════════════════════════════════════╗');
            console.log('║   🚀  GSI Database System  v3.1.0           ║');
            console.log('║         💾 Powered by MySQL                 ║');
            console.log('║   👥 Optimisé pour 2000 élèves simultanés   ║');
            console.log('╠══════════════════════════════════════════════╣');
            console.log(`║  ✅  Port             : ${PORT.toString().padEnd(22)} ║`);
            console.log(`║  🗄️   MySQL Pool      : 1000 connexions      ║`);
            console.log(`║  ⚡  Rate Limit      : 2000 req/15min       ║`);
            console.log(`║  🖼️   Fichiers        : MySQL LONGBLOB       ║`);
            console.log(`║  📂  HTML            : public/index.html    ║`);
            console.log(`║  🌐  Dashboard       : http://localhost:${PORT}/   ║`);
            console.log(`║  📚  Routes API/DB   : /api/db/:collection   ║`);
            console.log(`║  📚  Galerie embed   : /embed/gallery        ║`);
            console.log('╚══════════════════════════════════════════════╝');
        });
    } catch (error) {
        console.error('❌ Erreur au démarrage:', error.message);
        process.exit(1);
    }
}

startServer();

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
