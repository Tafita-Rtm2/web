const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const crypto = require('crypto');
const multer = require('multer');
const FormData = require('form-data');

dotenv.config();

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3000;
const SERVER_SECRET = process.env.SERVER_SECRET || 'gsi_default_secret_2025';
const API_BASE = process.env.API_BASE || "https://groupegsi.mg/rtmggmg/api";
const MEDIA_BASE = process.env.MEDIA_BASE || "https://groupegsi.mg/rtmggmg";

// HMAC Token signing
function signToken(data) {
  const payload = JSON.stringify({ data, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  const b64Payload = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(b64Payload).digest('hex');
  return `${b64Payload}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [b64Payload, signature] = token.split('.');
    const expectedSignature = crypto.createHmac('sha256', SERVER_SECRET).update(b64Payload).digest('hex');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload.data;
  } catch (e) {
    return null;
  }
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Range,X-GSI-Session-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'X-GSI-Session-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    next();
  } else {
    express.json({ limit: '50mb' })(req, res, next);
  }
});

// SECURE API PROXY V2
app.all('/apk/api/v2/*', upload.any(), async (req, res) => {
  const subPath = req.params[0] || '';
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `${API_BASE}/${subPath}${queryString}`;

  // Auth Detection
  const isLogin = subPath.includes('users') && (queryString.includes('q=') || req.method === 'GET');
  const isRegister = subPath.includes('users') && req.method === 'POST';
  const isPublic = subPath.includes('system_config');
  const token = req.headers['x-gsi-session-token'];

  // Security Enforcement
  if (!isLogin && !isRegister && !isPublic && !verifyToken(token)) {
    console.warn(`[SECURITY] Blocked unauthenticated request to: ${subPath}`);
    return res.status(401).json({ error: 'Session non autorisée ou expirée.' });
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers: { 'User-Agent': 'GSI-Secure-Proxy/2.0' }
    };

    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      const form = new FormData();
      if (req.body) {
        for (const key in req.body) form.append(key, req.body[key]);
      }
      if (req.files) {
        req.files.forEach(file => {
          form.append(file.fieldname, file.buffer, { filename: file.originalname, contentType: file.mimetype });
        });
      }
      fetchOptions.body = form;
    } else if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    let data;
    if (contentType.includes('application/json')) data = await response.json();
    else data = await response.text();

    if (response.ok && (isLogin || isRegister)) {
      const userData = isLogin ? (Array.isArray(data) ? data[0] : null) : data;
      if (userData && (userData.id || userData._id)) {
        const userToken = signToken({ id: userData.id || userData._id, role: userData.role });
        res.setHeader('X-GSI-Session-Token', userToken);
      }
    }

    if (typeof data === 'string') res.status(response.status).send(data);
    else res.status(response.status).json(data);

  } catch (error) {
    console.error(`[PROXY-ERROR] ${targetUrl}:`, error.message);
    res.status(500).json({ error: 'Database Connectivity Error' });
  }
});

app.get('/apk/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URL missing');
  const token = req.query.token || req.headers['x-gsi-session-token'];
  if (!verifyToken(token)) return res.status(403).send('Forbidden');

  try {
    const response = await fetch(targetUrl, { headers: { 'Range': req.headers.range || '' } });
    res.status(response.status);
    response.headers.forEach((v, n) => {
      if (!['content-security-policy', 'x-frame-options', 'access-control-allow-origin', 'set-cookie'].includes(n.toLowerCase())) {
        res.setHeader(n, v);
      }
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    response.body.pipe(res);
  } catch (e) {
    res.status(500).send('Media Error');
  }
});

app.use('/apk', express.static(path.join(__dirname, 'out')));
app.get('/apk/*', (req, res) => {
  const file = path.join(__dirname, 'out', req.path.replace('/apk', ''), 'index.html');
  if (fs.existsSync(file)) res.sendFile(file);
  else res.sendFile(path.join(__dirname, 'out', 'index.html'));
});
app.get('/', (req, res) => res.redirect('/apk/'));

app.listen(PORT, () => console.log(`GSI Ultra-Secure Server on port ${PORT}`));
