const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  // Nettoyer l'URL (enlever query string, éviter path traversal)
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  if (urlPath === '/verify')            urlPath = '/verify.html';

  const filePath = path.join(__dirname, urlPath);

  // Sécurité : s'assurer qu'on reste dans le dossier du projet
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Accès refusé');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fichier non trouvé → servir index.html (SPA fallback)
      fs.readFile(path.join(__dirname, 'index.html'), (err2, html) => {
        if (err2) { res.writeHead(500); res.end('Erreur serveur'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Cache pour les images (1 semaine)
    if (['.jpg','.jpeg','.png','.webp','.svg','.ico'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Site CEMGROUPE démarré sur le port ${PORT}`);
});
