const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for CORS (essential for some browsers)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Range');
  res.setHeader('Access-Control-Allow-Credentials', true);
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Config API for the frontend (Safe public config)
app.get('/apk/api/config', (req, res) => {
  res.json({
    API_BASE: process.env.API_BASE || "https://groupegsi.mg/rtmggmg/api",
    MEDIA_BASE: process.env.MEDIA_BASE || "https://groupegsi.mg/rtmggmg"
  });
});

// Proxy for media assets to avoid CORS issues
app.get('/apk/api/proxy', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URL is required');

  // Sécurité SSRF : On n'autorise que les URLs provenant du domaine officiel
  const allowedBase = "https://groupegsi.mg";
  if (!targetUrl.startsWith(allowedBase)) {
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

    // --- SMART RESOLVER ---
    // We check the content type. If it's JSON, we must resolve it.
    let contentType = response.headers.get('content-type') || "";

    if (contentType.includes('application/json')) {
      const json = await response.json();
      console.log(`[PROXY] Detected JSON response from API. Resolving...`);

      const realData = json.viewUrl || json.url || json.data || json.path || (json.data && json.data.url);

      if (realData) {
        if (typeof realData === 'string' && realData.startsWith('http')) {
          console.log(`[PROXY] Re-fetching nested URL: ${realData}`);
          targetUrl = realData;
          response = await fetch(targetUrl, fetchOptions);
          contentType = response.headers.get('content-type') || "";
        } else if (typeof realData === 'string' && realData.startsWith('data:')) {
          console.log(`[PROXY] Serving base64 data from JSON`);
          const matches = realData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            res.setHeader('Content-Type', matches[1]);
            const buffer = Buffer.from(matches[2], 'base64');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(buffer);
          }
        }
      }
    }

    // --- STREAMING OUTPUT ---
    // Handle 206 Partial Content for video seeking
    if (response.status === 206 || req.headers.range) {
      res.status(response.status);
    } else {
      res.status(response.status);
    }

    const skipHeaders = [
      'content-security-policy', 'x-frame-options', 'access-control-allow-origin',
      'set-cookie', 'transfer-encoding', 'connection'
    ];

    response.headers.forEach((value, name) => {
      if (!skipHeaders.includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });

    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');

    const finalContentType = (response.headers.get('content-type') || "").toLowerCase();
    if (finalContentType.includes('video') || finalContentType.includes('audio') || finalContentType.includes('pdf')) {
       res.setHeader('Accept-Ranges', 'bytes');
    }

    console.log(`[PROXY] Streaming binary: ${targetUrl} [Status: ${response.status}] [Type: ${finalContentType}]`);

    // Use response.body.pipe for Node v18+ fetch (via undici or node-fetch)
    if (response.body && typeof response.body.pipe === 'function') {
      response.body.pipe(res);
    } else {
      // Handle cases where body might be a ReadableStream (standard fetch)
      const reader = response.body.getReader();
      async function stream() {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      }
      stream().catch(err => {
        console.error('[PROXY] Stream Error:', err);
        res.end();
      });
    }

    response.body.on('error', (err) => {
      console.error('[PROXY] Pipe Error:', err);
      res.end();
    });

    req.on('close', () => {
      if (response.body.destroy) response.body.destroy();
    });

  } catch (error) {
    console.error('[PROXY] Global Error:', error);
    if (!res.headersSent) {
      res.status(500).send('Proxy internal error');
    }
  }
});

// Serve static files from the 'out' directory
// Note: Next.js 'out' directory will be served at /apk because of basePath
app.use('/apk', express.static(path.join(__dirname, 'out')));

// Handle PWA manifest
app.get('/apk/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'out', 'manifest.json'));
});

// Handle Service Worker
app.get('/apk/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'out', 'sw.js'));
});

// Redirect root to /apk/
app.get('/', (req, res) => {
  res.redirect('/apk/');
});

// Fallback to index.html for SPA routing
app.get('/apk/*', (req, res) => {
  console.log(`[DEBUG] Request for: ${req.path}`);
  const requestedPath = req.path.replace('/apk', '');

  // Try to find the file in the out directory
  // Next.js with trailingSlash: true creates folder/index.html
  let potentialFile = path.join(__dirname, 'out', requestedPath);

  // Clean up potential double slashes
  potentialFile = path.normalize(potentialFile);

  if (fs.existsSync(potentialFile) && fs.lstatSync(potentialFile).isDirectory()) {
    potentialFile = path.join(potentialFile, 'index.html');
  } else if (!fs.existsSync(potentialFile) && !requestedPath.includes('.')) {
    // If it doesn't exist and has no extension, it's likely a route
    const withIndex = path.join(__dirname, 'out', requestedPath, 'index.html');
    if (fs.existsSync(withIndex)) {
      potentialFile = withIndex;
    } else {
      potentialFile = path.join(__dirname, 'out', 'index.html');
    }
  }

  if (fs.existsSync(potentialFile) && fs.lstatSync(potentialFile).isFile()) {
    res.sendFile(potentialFile);
  } else {
    const mainIndex = path.join(__dirname, 'out', 'index.html');
    if (fs.existsSync(mainIndex)) {
      res.sendFile(mainIndex);
    } else {
      res.status(404).send('Error: out/index.html not found. Please ensure the project is built (npm run build).');
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access at http://localhost:${PORT}/apk/`);
});
