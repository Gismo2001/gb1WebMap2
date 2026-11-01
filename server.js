
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Pool } from 'pg';

const app = express();
const dbPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;

// --------------------------------------------------
// 1. Proxy-Verbindungen (bisherige Vite-Proxys)
// --------------------------------------------------

app.use('/lgln-stac', createProxyMiddleware({
  target: 'https://dgm.stac.lgln.niedersachsen.de',
  changeOrigin: true,
  secure: true,
  pathRewrite: { '^/lgln-stac': '' }
}));

app.use('/dgm', createProxyMiddleware({
  target: 'https://dgm1.s3.eu-de.cloud-object-storage.appdomain.cloud',
  changeOrigin: true,
  secure: true,
  pathRewrite: { '^/dgm': '' }
}));

app.use('/dom', createProxyMiddleware({
  target: 'https://dom1.s3.eu-de.cloud-object-storage.appdomain.cloud',
  changeOrigin: true,
  secure: true,
  pathRewrite: { '^/dom': '' }
}));

app.use('/wfs-proxy', createProxyMiddleware({
  target: 'https://www.inspire.niedersachsen.de',
  changeOrigin: true,
  secure: false,
  pathRewrite: { '^/wfs-proxy': '' }
}));

// --------------------------------------------------
// 2. Test-Endpunkt für unser Backend
// --------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'GB1 Web Map Backend läuft'
  });
});

app.get('/api/db-health', async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({
      status: 'ERROR',
      message: 'DATABASE_URL ist nicht konfiguriert'
    });
  }

  try {
    await dbPool.query('SELECT 1');
    res.json({ status: 'OK', message: 'PostgreSQL-Verbindung erfolgreich' });
  } catch (error) {
    console.error('PostgreSQL-Verbindung fehlgeschlagen:', error);
    res.status(503).json({
      status: 'ERROR',
      message: 'PostgreSQL-Verbindung fehlgeschlagen'
    });
  }
});

// --------------------------------------------------
// 3. OpenLayers-Anwendung ausliefern
// --------------------------------------------------

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --------------------------------------------------
// 4. Server starten
// --------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GB1 Web Map Server läuft auf Port ${PORT}`);
});
