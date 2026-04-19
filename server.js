const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT        = process.env.PORT        || 3000;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'contact@cemgroupe-site.com';
const DATA_DIR    = path.join(__dirname, 'data');

// Créer le dossier data si besoin
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.json': 'application/json',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

/* ── Helpers ── */
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function genRef() {
  const d = new Date();
  const yy = d.getFullYear().toString().slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `CEM-${yy}${mm}${dd}-${rand}`;
}

/* ── Envoi email (optionnel, si nodemailer installé) ── */
async function sendNotification(devis) {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const urgenceEmoji = devis.urgence === 'Urgent' ? '🔴' : devis.urgence === 'Prioritaire' ? '🟡' : '🟢';

    await transporter.sendMail({
      from: `"CEMGROUPE Site" <${process.env.SMTP_USER}>`,
      to:   NOTIFY_EMAIL,
      subject: `${urgenceEmoji} Nouvelle demande ${devis.reference} — ${devis.prenom} ${devis.nom} (${devis.societe})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#060F1F;padding:24px;border-radius:8px 8px 0 0;">
            <h2 style="color:#C9A227;margin:0;font-size:1.1rem;">📋 Nouvelle demande d'intervention</h2>
            <p style="color:#8fa4c0;margin:6px 0 0;font-size:.85rem;">Référence : <strong style="color:#fff">${devis.reference}</strong></p>
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
            <table style="width:100%;border-collapse:collapse;font-size:.88rem;">
              <tr><td style="padding:8px 0;color:#64748b;width:140px;">Contact</td><td style="padding:8px 0;font-weight:700;color:#060F1F;">${devis.prenom} ${devis.nom}</td></tr>
              <tr style="background:#f8fafc"><td style="padding:8px 4px;color:#64748b;">Société</td><td style="padding:8px 4px;font-weight:600;">${devis.societe}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;"><a href="mailto:${devis.email}" style="color:#C9A227;">${devis.email}</a></td></tr>
              <tr style="background:#f8fafc"><td style="padding:8px 4px;color:#64748b;">Téléphone</td><td style="padding:8px 4px;font-weight:600;">${devis.telephone}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;">Pays</td><td style="padding:8px 0;">${devis.pays || '—'}</td></tr>
              <tr style="background:#f8fafc"><td style="padding:8px 4px;color:#64748b;">Services</td><td style="padding:8px 4px;">${(devis.services || []).join(', ') || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;">Urgence</td><td style="padding:8px 0;">${urgenceEmoji} ${devis.urgence}</td></tr>
              ${devis.date_souhaitee ? `<tr style="background:#f8fafc"><td style="padding:8px 4px;color:#64748b;">Date souhaitée</td><td style="padding:8px 4px;">${devis.date_souhaitee}</td></tr>` : ''}
            </table>
            <div style="margin-top:16px;background:#f0f4ff;border-left:3px solid #060F1F;padding:12px 16px;border-radius:0 8px 8px 0;">
              <div style="font-size:.75rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Description</div>
              <div style="font-size:.88rem;color:#374151;line-height:1.6;">${devis.description}</div>
            </div>
            <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:.75rem;color:#94a3b8;">
              Reçu le ${new Date().toLocaleString('fr-FR')} · cemgroupe-site.com
            </div>
          </div>
        </div>
      `,
    });
    console.log(`📧 Email de notification envoyé pour ${devis.reference}`);
  } catch (e) {
    console.warn('⚠️  Email non envoyé (SMTP non configuré) :', e.message);
  }
}

/* ── Handler POST /api/devis ── */
async function handleDevis(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 100000) req.destroy(); });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);

      // Validation minimale
      const required = ['prenom', 'nom', 'societe', 'email', 'telephone', 'description'];
      for (const f of required) {
        if (!data[f] || !String(data[f]).trim()) {
          return json(res, 400, { success: false, error: `Champ requis manquant : ${f}` });
        }
      }

      const devis = {
        reference:    genRef(),
        created_at:   new Date().toISOString(),
        prenom:       String(data.prenom).trim(),
        nom:          String(data.nom).trim(),
        societe:      String(data.societe).trim(),
        email:        String(data.email).trim(),
        telephone:    String(data.telephone).trim(),
        pays:         String(data.pays || '').trim(),
        services:     Array.isArray(data.services) ? data.services : [],
        description:  String(data.description).trim(),
        urgence:      ['Normal','Prioritaire','Urgent'].includes(data.urgence) ? data.urgence : 'Normal',
        date_souhaitee: String(data.date_souhaitee || '').trim(),
        source:       'QR Code / Site vitrine',
        statut:       'Nouveau',
      };

      // Sauvegarde JSON
      const file = path.join(DATA_DIR, 'devis.json');
      let list = [];
      if (fs.existsSync(file)) {
        try { list = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch {}
      }
      list.unshift(devis);
      fs.writeFileSync(file, JSON.stringify(list, null, 2));
      console.log(`✅ Devis sauvegardé : ${devis.reference}`);

      // Notification email (asynchrone, ne bloque pas la réponse)
      sendNotification(devis);

      json(res, 200, { success: true, reference: devis.reference });
    } catch (e) {
      console.error('Erreur /api/devis :', e.message);
      json(res, 500, { success: false, error: 'Erreur serveur' });
    }
  });
}

/* ── Serveur HTTP ── */
const server = http.createServer((req, res) => {
  const method  = req.method;
  let urlPath   = req.url.split('?')[0];

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // ── API POST /api/devis
  if (method === 'POST' && urlPath === '/api/devis') return handleDevis(req, res);

  // ── Routes HTML
  if (urlPath === '/' || urlPath === '')  urlPath = '/index.html';
  if (urlPath === '/verify')              urlPath = '/verify.html';
  if (urlPath === '/devis')              urlPath = '/devis.html';

  const filePath = path.join(__dirname, urlPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); return res.end('Accès refusé');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'index.html'), (err2, html) => {
        if (err2) { res.writeHead(500); return res.end('Erreur serveur'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    if (['.jpg','.jpeg','.png','.webp','.svg','.ico'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Site CEMGROUPE démarré sur le port ${PORT}`);
  console.log(`📋 Formulaire devis : http://localhost:${PORT}/devis`);
});
