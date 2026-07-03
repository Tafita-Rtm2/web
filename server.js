require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const db = require('./database');
const {
    hashPassword,
    verifyPassword,
    looksLikeBcryptHash,
    signToken,
    authRequired,
    requireRole
} = require('./auth');
const { getPolicy, stripFields } = require('./policy');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
}));
app.use(compression());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Range, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const api = express.Router();

api.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de tentatives, réessaie plus tard' }
});

const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false });

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

api.post('/auth/register', authLimiter, async (req, res) => {
    try {
        const { fullName, email, password, campus, filiere, niveau, matricule, contact } = req.body;
        if (!fullName || !email || !password || password.length < 8) {
            return res.status(400).json({ error: 'Champs invalides (mot de passe: 8 caractères min.)' });
        }
        const cleanEmail = String(email).trim().toLowerCase();
        const existing = await db.getDocuments('users', { email: cleanEmail });
        if (existing.length > 0) return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });

        const passwordHash = await hashPassword(password);
        const id = uuidv4();
        const data = {
            id, fullName, email: cleanEmail, password: passwordHash, role: 'student',
            campus: campus || null, filiere: filiere || null, niveau: niveau || null,
            matricule: matricule || null, contact: contact || null
        };
        const docId = uuidv4();
        await db.insertDocument('users', docId, data);
        const user = { ...data, _id: docId };
        const token = signToken(user);
        res.status(201).json({ token, user: stripFields(user, ['password']) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/admin/users', authRequired, requireRole('admin'), async (req, res) => {
    try {
        const { fullName, email, password, role, campus, filiere, niveau, matricule, contact } = req.body;
        if (!fullName || !email || !password || password.length < 8) return res.status(400).json({ error: 'Champs invalides' });
        if (!['student', 'professor', 'admin'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
        const cleanEmail = String(email).trim().toLowerCase();
        const existing = await db.getDocuments('users', { email: cleanEmail });
        if (existing.length > 0) return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });

        const passwordHash = await hashPassword(password);
        const id = uuidv4();
        const data = {
            id, fullName, email: cleanEmail, password: passwordHash, role,
            campus: campus || null, filiere: filiere || null, niveau: niveau || null,
            matricule: matricule || null, contact: contact || null
        };
        const docId = uuidv4();
        await db.insertDocument('users', docId, data);
        res.status(201).json(stripFields({ ...data, _id: docId }, ['password']));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
        const cleanEmail = String(email).trim().toLowerCase();
        const matches = await db.getDocuments('users', { email: cleanEmail });
        if (matches.length === 0) return res.status(401).json({ error: 'Identifiants invalides' });
        const user = matches[0];

        let valid = false;
        if (looksLikeBcryptHash(user.password)) {
            valid = await verifyPassword(password, user.password);
        } else {
            valid = user.password === password;
            if (valid) {
                const newHash = await hashPassword(password);
                await db.updateDocument('users', user._id, { ...user, password: newHash });
            }
        }
        if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

        const token = signToken(user);
        res.json({ token, user: stripFields(user, ['password']) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.get('/auth/me', authRequired, async (req, res) => {
    try {
        const user = await db.getDocumentById('users', req.user.sub);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
        res.json(stripFields(user, ['password']));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/auth/change-password', authRequired, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Nouveau mot de passe trop court (8 min.)' });
        const user = await db.getDocumentById('users', req.user.sub);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
        const valid = looksLikeBcryptHash(user.password) ? await verifyPassword(currentPassword, user.password) : currentPassword === user.password;
        if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
        const newHash = await hashPassword(newPassword);
        await db.updateDocument('users', user._id, { ...user, password: newHash });
        res.json({ message: 'Mot de passe mis à jour' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/admin/users/:id/reset-password', authRequired, requireRole('admin'), async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Nouveau mot de passe trop court (8 min.)' });
        const user = await db.getDocumentById('users', req.params.id);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
        const newHash = await hashPassword(newPassword);
        await db.updateDocument('users', req.params.id, { ...user, password: newHash });
        res.json({ message: 'Mot de passe réinitialisé' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/setup/run', async (req, res) => {
    try {
        const SETUP_TOKEN = process.env.SETUP_TOKEN;
        if (!SETUP_TOKEN) return res.status(404).json({ error: 'Setup désactivé (SETUP_TOKEN absent du .env)' });
        if (req.body.token !== SETUP_TOKEN) return res.status(403).json({ error: 'Token de setup invalide' });

        const { action } = req.body;
        if (action === 'create-admin') {
            const { fullName, email, password } = req.body;
            if (!fullName || !email || !password || password.length < 8) return res.status(400).json({ error: 'fullName, email, password (8+) requis' });
            const cleanEmail = String(email).trim().toLowerCase();
            const passwordHash = await hashPassword(password);
            const existing = await db.getDocuments('users', { email: cleanEmail });
            if (existing.length > 0) {
                const user = existing[0];
                await db.updateDocument('users', user._id, { ...user, role: 'admin', password: passwordHash });
                return res.json({ message: `Compte existant ${cleanEmail} promu admin.` });
            } else {
                const data = { id: uuidv4(), fullName, email: cleanEmail, password: passwordHash, role: 'admin', campus: null, filiere: 'Direction', niveau: 'N/A' };
                await db.insertDocument('users', uuidv4(), data);
                return res.json({ message: `Nouveau compte admin créé : ${cleanEmail}` });
            }
        }
        if (action === 'migrate-passwords') {
            const users = await db.getDocuments('users', {});
            let migrated = 0;
            for (const user of users) {
                if (!user.password || looksLikeBcryptHash(user.password)) continue;
                const hash = await hashPassword(user.password);
                await db.updateDocument('users', user._id, { ...user, password: hash });
                migrated++;
            }
            return res.json({ message: `${migrated} mot(s) de passe migré(s) sur ${users.length} comptes.` });
        }
        return res.status(400).json({ error: "action invalide" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function applyClientQuery(documents, req) {
    let docs = documents;
    if (req.query.q) {
        try {
            const q = JSON.parse(req.query.q);
            docs = docs.filter(doc => Object.keys(q).every(k => doc[k] === q[k] || (q[k] && typeof q[k] === 'object')));
        } catch (e) {}
    }
    return docs;
}

api.get('/db/:collection', authRequired, async (req, res) => {
    try {
        const policy = getPolicy(req.params.collection);
        if (!policy) return res.status(403).json({ error: 'Collection non autorisée' });
        const canReadAll = policy.read.includes(req.user.role);
        const isOwnerScoped = !canReadAll && policy.ownerField;
        if (!canReadAll && !isOwnerScoped) return res.status(403).json({ error: 'Accès refusé' });

        let documents = await db.getDocuments(req.params.collection, {});
        if (isOwnerScoped) {
            const claim = policy.ownerClaim || 'sub';
            const myValue = req.user[claim];
            documents = myValue ? documents.filter(d => d[policy.ownerField] === myValue) : [];
        } else {
            documents = applyClientQuery(documents, req);
        }
        documents = documents.map(d => stripFields(d, policy.stripFields));
        res.json(documents);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.get('/db/:collection/:id', authRequired, async (req, res) => {
    try {
        const policy = getPolicy(req.params.collection);
        if (!policy) return res.status(403).json({ error: 'Collection non autorisée' });
        const doc = await db.getDocumentById(req.params.collection, req.params.id);
        if (!doc) return res.status(404).json({ error: 'Document non trouvé' });
        const canReadAll = policy.read.includes(req.user.role);
        const claim = policy.ownerField ? (policy.ownerClaim || 'sub') : null;
        const ownsIt = policy.ownerField && req.user[claim] && doc[policy.ownerField] === req.user[claim];
        if (!canReadAll && !ownsIt) return res.status(403).json({ error: 'Accès refusé' });
        res.json(stripFields(doc, policy.stripFields));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/db/:collection', authRequired, async (req, res) => {
    try {
        const policy = getPolicy(req.params.collection);
        if (!policy) return res.status(403).json({ error: 'Collection non autorisée' });
        const canWriteAll = policy.write.includes(req.user.role);
        const canOwnerWrite = policy.ownerField && policy.ownerWriteFields;
        if (!canWriteAll && !canOwnerWrite) return res.status(403).json({ error: 'Accès refusé' });

        const data = { ...req.body };
        delete data._id;
        delete data.password;

        if (!canWriteAll && canOwnerWrite) {
            const claim = policy.ownerClaim || 'sub';
            const myValue = req.user[claim];
            const restricted = {};
            policy.ownerWriteFields.forEach(f => { if (f in data) restricted[f] = data[f]; });
            restricted[policy.ownerField] = myValue;
            Object.assign(data, restricted, { [policy.ownerField]: myValue });
        }

        data.createdAt = new Date().toISOString();
        data.updatedAt = new Date().toISOString();
        const docId = uuidv4();
        const doc = await db.insertDocument(req.params.collection, docId, data);
        res.status(201).json(stripFields(doc, policy.stripFields));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.patch('/db/:collection/:id', authRequired, async (req, res) => {
    try {
        const policy = getPolicy(req.params.collection);
        if (!policy) return res.status(403).json({ error: 'Collection non autorisée' });
        const current = await db.getDocumentById(req.params.collection, req.params.id);
        if (!current) return res.status(404).json({ error: 'Document non trouvé' });

        const canWriteAll = policy.write.includes(req.user.role);
        const claim = policy.ownerField ? (policy.ownerClaim || 'sub') : null;
        const ownsIt = policy.ownerField && req.user[claim] && current[policy.ownerField] === req.user[claim];
        const canOwnerWrite = ownsIt && policy.ownerWriteFields;
        if (!canWriteAll && !canOwnerWrite) return res.status(403).json({ error: 'Accès refusé' });

        let patch = { ...req.body };
        delete patch._id;
        if (!canWriteAll && canOwnerWrite) {
            const restricted = {};
            policy.ownerWriteFields.forEach(f => { if (f in patch) restricted[f] = patch[f]; });
            patch = restricted;
        } else {
            delete patch.password;
        }

        const merged = { ...current, ...patch, updatedAt: new Date().toISOString() };
        delete merged._id;
        await db.updateDocument(req.params.collection, req.params.id, merged);
        res.json(stripFields({ ...merged, _id: req.params.id }, policy.stripFields));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.delete('/db/:collection/:id', authRequired, async (req, res) => {
    try {
        const policy = getPolicy(req.params.collection);
        if (!policy) return res.status(403).json({ error: 'Collection non autorisée' });
        if (!policy.delete.includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
        const deleted = await db.deleteDocument(req.params.collection, req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Document non trouvé' });
        res.json({ message: 'Document supprimé', deleted: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.delete('/db/:collection', authRequired, requireRole('admin'), async (req, res) => {
    try {
        const deleted = await db.deleteCollection(req.params.collection);
        res.json({ message: deleted ? 'Collection supprimée' : 'Introuvable', deleted });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/ai/chat', authRequired, aiLimiter, async (req, res) => {
    try {
        const { campus, subject, contextText, history, userMessage, imageDataUrl } = req.body;
        if (!userMessage && !imageDataUrl) return res.status(400).json({ error: 'Message requis' });
        const configDocs = await db.getDocuments('system_config', {});
        const aiConfig = (configDocs[0] && configDocs[0].AI_CONFIG) || {};
        if (!aiConfig.apiKey) return res.status(503).json({ error: 'Configuration IA manquante côté serveur.' });

        const promptKey = `${campus || ''}_${subject || ''}`;
        const defaultPrompt = "Tu es l'Agent Assistant, le conseiller IA personnel du Groupe GSI.";
        const systemPrompt = (aiConfig.prompts && (aiConfig.prompts[promptKey] || aiConfig.prompts[`${campus || ''}_Général`])) || defaultPrompt;

        const apiMessages = [{ role: 'system', content: `${systemPrompt}\n\n${contextText || ''}` }];
        (Array.isArray(history) ? history.slice(-10) : []).forEach(m => {
            if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') apiMessages.push({ role: m.role, content: m.content });
        });
        if (imageDataUrl) {
            apiMessages.push({ role: 'user', content: [{ type: 'text', text: userMessage || "Analyse cette image." }, { type: 'image_url', image_url: { url: imageDataUrl } }] });
        } else {
            apiMessages.push({ role: 'user', content: userMessage });
        }

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: aiConfig.apiKey });
        const completion = await openai.chat.completions.create({ model: imageDataUrl ? 'gpt-4o' : 'gpt-3.5-turbo', messages: apiMessages });
        res.json({ content: completion.choices[0]?.message?.content || '' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/upload', authRequired, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
        const fileId = uuidv4();
        const mimeBase = (req.file.mimetype || 'other').split('/')[0];
        const fileData = { _id: fileId, originalname: req.file.originalname, filename: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, category: mimeBase, description: req.body.description || '', uploadedBy: req.user.sub };
        await db.saveFileMetadata(fileData, req.file.buffer);
        const baseUrl = `${req.protocol}://${req.get('host')}/apk/api`;
        res.status(201).json({ message: 'Fichier uploadé', file: fileData, viewUrl: `${baseUrl}/files/view/${fileId}`, downloadUrl: `${baseUrl}/files/download/${fileId}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/upload/multiple', authRequired, upload.array('files', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Aucun fichier fourni' });
        const baseUrl = `${req.protocol}://${req.get('host')}/apk/api`;
        const uploadedFiles = [];
        for (const file of req.files) {
            const fileId = uuidv4();
            const mimeBase = (file.mimetype || 'other').split('/')[0];
            const fileData = { _id: fileId, originalname: file.originalname, filename: file.originalname, mimetype: file.mimetype, size: file.size, category: mimeBase, description: '', uploadedBy: req.user.sub };
            await db.saveFileMetadata(fileData, file.buffer);
            uploadedFiles.push({ ...fileData, viewUrl: `${baseUrl}/files/view/${fileId}`, downloadUrl: `${baseUrl}/files/download/${fileId}` });
        }
        res.status(201).json({ message: `${uploadedFiles.length} fichier(s) uploadé(s)`, files: uploadedFiles });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.get('/files', authRequired, requireRole('professor', 'admin'), async (req, res) => {
    try {
        const files = await db.getAllFileMetadata(req.query.category || null, req.query.search || null);
        const baseUrl = `${req.protocol}://${req.get('host')}/apk/api`;
        res.json(files.map(f => ({ ...f, viewUrl: `${baseUrl}/files/view/${f._id}`, downloadUrl: `${baseUrl}/files/download/${f._id}` })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.get('/files/view/:id', authRequired, async (req, res) => {
    try {
        const file = await db.getFileData(req.params.id);
        if (!file) return res.status(404).json({ error: 'Fichier non trouvé' });
        const buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.end(buffer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.get('/files/download/:id', authRequired, async (req, res) => {
    try {
        const file = await db.getFileData(req.params.id);
        if (!file) return res.status(404).json({ error: 'Fichier non trouvé' });
        const buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalname)}"`);
        res.setHeader('Content-Length', buffer.length);
        res.end(buffer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.delete('/files/:id', authRequired, requireRole('professor', 'admin'), async (req, res) => {
    try {
        const file = await db.getFileMetadata(req.params.id);
        if (!file) return res.status(404).json({ error: 'Fichier non trouvé' });
        await db.deleteFileMetadata(req.params.id);
        res.json({ message: 'Fichier supprimé', deleted: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.get('/status', authRequired, requireRole('admin'), async (req, res) => {
    try {
        const collections = await db.getCollections();
        const filesCount = await db.getFileCount();
        res.json({ status: 'online', timestamp: new Date().toISOString(), version: '5.0.0-merged', database: 'MySQL', collections: collections.map(c => c.name), collectionsCount: collections.length, filesCount, uptime: process.uptime() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.get('/collections', authRequired, requireRole('admin'), async (req, res) => {
    try {
        const collections = await db.getCollections();
        const enriched = await Promise.all(collections.map(async col => ({ name: col.name, description: col.description, count: await db.getCollectionStats(col.name), updatedAt: col.updated_at })));
        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.post('/search', authRequired, requireRole('admin'), async (req, res) => {
    try {
        const { query, collections } = req.body;
        const results = await db.globalSearch(query || {}, collections);
        Object.keys(results).forEach(col => { results[col] = results[col].map(d => stripFields(d, ['password'])); });
        const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
        res.json({ results, total });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

api.get('/', (req, res) => res.json({ status: 'online', message: 'API GSI sécurisée active' }));
api.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/apk/api', api);

// Compat avec l'ancien mécanisme initWebConfig() du frontend (optionnel, même origine désormais)
app.get('/apk/api/config', (req, res) => {
  res.json({
    API_BASE: process.env.NEXT_PUBLIC_API_BASE || `${req.protocol}://${req.get('host')}/apk/api`,
    MEDIA_BASE: process.env.NEXT_PUBLIC_MEDIA_BASE || `${req.protocol}://${req.get('host')}`
  });
});

app.get('/apk/api-legacy/proxy', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URL is required');
  const allowedBase = "https://groupegsi.mg";
  if (!targetUrl.startsWith(allowedBase)) return res.status(403).send('URL non autorisée.');
  try {
    const response = await fetch(targetUrl, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    res.status(response.status);
    response.headers.forEach((value, name) => {
      if (!['content-security-policy', 'x-frame-options', 'set-cookie', 'transfer-encoding', 'connection'].includes(name.toLowerCase())) res.setHeader(name, value);
    });
    response.body.pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(500).send('Proxy internal error');
  }
});

app.use('/apk', express.static(path.join(__dirname, 'out')));

app.get('/apk/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'out', 'manifest.json')));
app.get('/apk/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'out', 'sw.js')));
app.get('/', (req, res) => res.redirect('/apk/'));

app.get('/apk/*', (req, res) => {
  const requestedPath = req.path.replace('/apk', '');
  let potentialFile = path.normalize(path.join(__dirname, 'out', requestedPath));

  if (fs.existsSync(potentialFile) && fs.lstatSync(potentialFile).isDirectory()) {
    potentialFile = path.join(potentialFile, 'index.html');
  } else if (!fs.existsSync(potentialFile) && !requestedPath.includes('.')) {
    const withIndex = path.join(__dirname, 'out', requestedPath, 'index.html');
    potentialFile = fs.existsSync(withIndex) ? withIndex : path.join(__dirname, 'out', 'index.html');
  }

  if (fs.existsSync(potentialFile) && fs.lstatSync(potentialFile).isFile()) {
    res.sendFile(potentialFile);
  } else {
    const mainIndex = path.join(__dirname, 'out', 'index.html');
    if (fs.existsSync(mainIndex)) res.sendFile(mainIndex);
    else res.status(404).send('Error: out/index.html not found. Please ensure the project is built (npm run build).');
  }
});

async function startServer() {
    try {
        const connected = await db.testConnection();
        if (!connected) {
            console.error('❌ Impossible de se connecter à MySQL -- vérifie .env');
            process.exit(1);
        }
        await db.initializeTables();
        app.listen(PORT, () => {
            console.log('🔒 GSI Formation -- serveur unique (site + API sécurisée) actif sur le port ' + PORT);
            console.log('   Site : /apk/    API : /apk/api/');
        });
    } catch (error) {
        console.error('❌ Erreur au démarrage:', error.message);
        process.exit(1);
    }
}

startServer();

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
