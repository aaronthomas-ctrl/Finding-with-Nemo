const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const proxyCode = `
app.get('/api/proxy-image', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch from target URL');
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.set('Content-Type', response.headers.get('content-type') || 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error("Proxy image error:", error);
    res.status(500).json({ error: String(error) });
  }
});

async function startServer() {`;

code = code.replace("async function startServer() {", proxyCode);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with proxy-image");
