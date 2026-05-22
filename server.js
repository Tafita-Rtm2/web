const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_SECRET = process.env.SERVER_SECRET;
const API_BASE = process.env.API_BASE;
const MEDIA_BASE = process.env.MEDIA_BASE;

if (!SERVER_SECRET || !API_BASE || !MEDIA_BASE) {
    console.error("CRITICAL ERROR: Missing essential environment variables (SERVER_SECRET, API_BASE, MEDIA_BASE).");
    process.exit(1);
}

app.use(express.json());

// Middleware for CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Range,X-GSI-Proxy-Token');
  res.setHeader('Access-Control-Allow-Credentials', true);
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper to generate token
function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SERVER_SECRET, { expiresIn: '7d' });
}

// Safe public config
app.get('/apk/api/config', (req, res) => {
  res.json({
    PROXY_ENABLED: true,
    VERSION: "2.2.0-secure"
  });
});

// Universal Proxy Endpoint
app.all('/apk/api/v1/*', async (req, res) => {
    const subPath = req.params[0];
    const queryStr = req.url.split('?')[1] || '';
    const targetUrl = `${API_BASE}/${subPath}${queryStr ? '?' + queryStr : ''}`;

    const isLoginAttempt = subPath === 'db/users' && req.method === 'GET' && queryStr.includes('email') && queryStr.includes('password');
    const isRegistrationAttempt = subPath === 'db/users' && req.method === 'POST';
    const isPublic = isLoginAttempt || isRegistrationAttempt;

    if (!isPublic) {
        const token = req.headers['x-gsi-proxy-token'];
        if (!token) return res.status(401).json({ error: 'Authentification requise' });
        try {
            jwt.verify(token, SERVER_SECRET);
        } catch (e) {
            return res.status(403).json({ error: 'Session invalide' });
        }
    }

    try {
        const fetchOptions = {
            method: req.method,
            headers: {
                'Content-Type': req.headers['content-type'] || 'application/json',
                'User-Agent': 'GSI-Proxy/1.0'
            }
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(targetUrl, fetchOptions);
        const contentType = response.headers.get('content-type') || "";

        // Copy response headers
        const skipHeaders = ['content-security-policy', 'x-frame-options', 'access-control-allow-origin', 'set-cookie', 'transfer-encoding', 'connection'];
        response.headers.forEach((value, name) => {
            if (!skipHeaders.includes(name.toLowerCase())) res.setHeader(name, value);
        });
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (contentType.includes('application/json')) {
            const data = await response.json();
            // Inject token on login/register success
            if (isLoginAttempt && Array.isArray(data) && data.length > 0) {
                return res.status(response.status).json({ ...data[0], proxyToken: generateToken(data[0]) });
            }
            if (isRegistrationAttempt && data && data.id) {
                return res.status(response.status).json({ ...data, proxyToken: generateToken(data) });
            }
            return res.status(response.status).json(data);
        } else {
            // Stream binary data
            res.status(response.status);
            response.body.pipe(res);
        }
    } catch (error) {
        console.error(`[PROXY ERROR] ${targetUrl}:`, error);
        if (!res.headersSent) res.status(500).json({ error: 'Erreur proxy API' });
    }
});

// Media Proxy (Recovered with full features)
app.get('/apk/api/proxy', async (req, res) => {
  const token = req.query.token || req.headers['x-gsi-proxy-token'];
  if (!token) return res.status(401).send('Authentification requise');
  try { jwt.verify(token, SERVER_SECRET); } catch (e) { return res.status(403).send('Session invalide'); }

  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URL is required');

  if (targetUrl.startsWith('/')) targetUrl = `${MEDIA_BASE}${targetUrl}`;
  const allowedBase = "https://groupegsi.mg";
  if (!targetUrl.startsWith(allowedBase) && !targetUrl.startsWith(MEDIA_BASE)) {
    return res.status(403).send('URL non autorisée.');
  }

  try {
    const fetchOptions = {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0...', 'Accept': '*/*' },
      redirect: 'follow'
    };
    if (req.headers.range) fetchOptions.headers['Range'] = req.headers.range;

    let response = await fetch(targetUrl, fetchOptions);
    let contentType = response.headers.get('content-type') || "";

    if (contentType.includes('application/json')) {
      const json = await response.json();
      const realData = json.viewUrl || json.url || json.data || json.path || (json.data && json.data.url);
      if (realData && typeof realData === 'string' && realData.startsWith('http')) {
        targetUrl = realData;
        response = await fetch(targetUrl, fetchOptions);
        contentType = response.headers.get('content-type') || "";
      } else if (typeof realData === 'string' && realData.startsWith('data:')) {
          const matches = realData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            res.setHeader('Content-Type', matches[1]);
            return res.send(Buffer.from(matches[2], 'base64'));
          }
      }
    }

    res.status(response.status);
    const skipHeaders = ['content-security-policy', 'x-frame-options', 'access-control-allow-origin', 'set-cookie', 'transfer-encoding', 'connection'];
    response.headers.forEach((value, name) => {
      if (!skipHeaders.includes(name.toLowerCase())) res.setHeader(name, value);
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Disposition', 'inline');

    if (contentType.toLowerCase().match(/video|audio|pdf/)) res.setHeader('Accept-Ranges', 'bytes');

    if (response.body && typeof response.body.pipe === 'function') {
      response.body.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) res.status(500).send('Proxy internal error');
  }
});

// Serve static files
app.use('/apk', express.static(path.join(__dirname, 'out')));
app.get('/apk/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'out', 'manifest.json')));
app.get('/apk/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'out', 'sw.js')));
app.get('/', (req, res) => res.redirect('/apk/'));
app.get('/apk/*', (req, res) => {
  const requestedPath = req.path.replace('/apk', '');
  let potentialFile = path.join(__dirname, 'out', requestedPath);
  if (fs.existsSync(potentialFile) && fs.lstatSync(potentialFile).isDirectory()) {
    potentialFile = path.join(potentialFile, 'index.html');
  } else if (!fs.existsSync(potentialFile) && !requestedPath.includes('.')) {
    const withIndex = path.join(__dirname, 'out', requestedPath, 'index.html');
    potentialFile = fs.existsSync(withIndex) ? withIndex : path.join(__dirname, 'out', 'index.html');
  }
  if (fs.existsSync(potentialFile) && fs.lstatSync(potentialFile).isFile()) res.sendFile(potentialFile);
  else res.sendFile(path.join(__dirname, 'out', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
