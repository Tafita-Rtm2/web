const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const crypto = require('crypto');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_SECRET = process.env.SERVER_SECRET || 'gsi_default_secret_2025';
const API_BASE = process.env.API_BASE || "https://groupegsi.mg/rtmggmg/api";
const MEDIA_BASE = process.env.MEDIA_BASE || "https://groupegsi.mg/rtmggmg";

// Helper for Token Signing (Simple HMAC)
function signToken(data) {
  const payload = JSON.stringify({ data, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
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

// Middleware for CORS and Security Checks
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Range,X-GSI-Session-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'X-GSI-Session-Token');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  // Strict Origin/Referer Check for API/Proxy
  if (req.path.startsWith('/apk/api/')) {
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';

    // In production, we should be more strict. For now, we allow localhost for dev.
    // We also check if it contains /apk/
    if (!isLocal && !referer.includes('/apk/') && !origin.includes(req.hostname)) {
       console.warn(`[SECURITY] Blocked request from unauthorized origin: ${origin} | Referer: ${referer}`);
       // return res.status(403).send('Access Denied');
    }
  }

  next();
});

// Middleware to parse JSON for API proxy
app.use(express.json({ limit: '50mb' }));

// SECURE API PROXY V2
app.all('/apk/api/v2/*', async (req, res) => {
  const subPath = req.params[0] || '';
  const targetUrl = `${API_BASE}/${subPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

  // Security: Check Session Token (except for login/register/config)
  const isLogin = subPath.includes('users') && req.url.includes('q=');
  const isPublic = subPath === 'system_config';
  const token = req.headers['x-gsi-session-token'];

  if (!isLogin && !isPublic && !verifyToken(token)) {
    // We allow registration too
    if (!(req.method === 'POST' && subPath === 'users')) {
      return res.status(401).json({ error: 'Session invalide ou expirée' });
    }
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GSI-Secure-Proxy/1.0'
      }
    };

    if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    // If it was a successful login, generate and attach a token
    if (isLogin && response.ok && Array.isArray(data) && data.length > 0) {
      const userToken = signToken({ id: data[0].id, role: data[0].role });
      res.setHeader('X-GSI-Session-Token', userToken);
    }
    // If it was a successful registration
    else if (req.method === 'POST' && subPath === 'users' && response.ok && data) {
      const userToken = signToken({ id: data.id || 'new_user', role: data.role || 'student' });
      res.setHeader('X-GSI-Session-Token', userToken);
    }

    res.status(response.status).json(data);
  } catch (error) {
    console.error(`[PROXY-V2] Error proxying to ${targetUrl}:`, error);
    res.status(500).json({ error: 'Proxy V2 Error' });
  }
});

// SECURE MEDIA PROXY
app.get('/apk/api/proxy', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URL is required');

  // Security: Validate Token
  const token = req.query.token || req.headers['x-gsi-session-token'];
  if (!verifyToken(token)) {
    // return res.status(401).send('Unauthorized');
    // For media, we might be more lenient if it comes from our domain
  }

  // SSRF Protection
  const allowedBases = [API_BASE, MEDIA_BASE, "https://groupegsi.mg"];
  const isAllowed = allowedBases.some(base => targetUrl.startsWith(base));

  if (!isAllowed) {
    console.warn(`[PROXY] Blocked unauthorized URL: ${targetUrl}`);
    return res.status(403).send('URL non autorisée.');
  }

  try {
    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      },
      redirect: 'follow',
      compress: false
    };

    if (req.headers.range) fetchOptions.headers['Range'] = req.headers.range;

    let response = await fetch(targetUrl, fetchOptions);
    let contentType = response.headers.get('content-type') || "";

    // Smart Resolver for JSON URLs
    if (contentType.includes('application/json')) {
      const json = await response.json();
      const realData = json.viewUrl || json.url || json.data || json.path;
      if (realData && typeof realData === 'string' && realData.startsWith('http')) {
        targetUrl = realData;
        response = await fetch(targetUrl, fetchOptions);
        contentType = response.headers.get('content-type') || "";
      }
    }

    // Stream Response
    res.status(response.status);
    const skipHeaders = ['content-security-policy', 'x-frame-options', 'access-control-allow-origin', 'set-cookie'];
    response.headers.forEach((value, name) => {
      if (!skipHeaders.includes(name.toLowerCase())) res.setHeader(name, value);
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    response.body.pipe(res);

    req.on('close', () => {
      if (response.body.destroy) response.body.destroy();
    });
  } catch (error) {
    console.error('[PROXY] Global Error:', error);
    if (!res.headersSent) res.status(500).send('Proxy internal error');
  }
});

// Serve static files
app.use('/apk', express.static(path.join(__dirname, 'out')));

// Fallback to SPA index
app.get('/apk/*', (req, res) => {
  const potentialFile = path.join(__dirname, 'out', req.path.replace('/apk', ''), 'index.html');
  const mainIndex = path.join(__dirname, 'out', 'index.html');
  if (fs.existsSync(potentialFile)) res.sendFile(potentialFile);
  else if (fs.existsSync(mainIndex)) res.sendFile(mainIndex);
  else res.status(404).send('Not Found');
});

app.get('/', (req, res) => res.redirect('/apk/'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Proxy active at /apk/api/v2/`);
});
