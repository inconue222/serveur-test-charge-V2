/*
 * serveur-test-charge — server.js
 * Petit serveur de test local, Node.js PUR (modules intégrés uniquement :
 * http, fs, os, path). Aucune dépendance externe, aucun npm install.
 * Usage : node server.js  (ou double-clic sur allumer.bat)
 */

'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const DOSSIER_PUBLIC = path.join(__dirname, 'public');
const FICHIER_CONFIG_SERVEUR = path.join(__dirname, 'config-serveur.txt');
const FICHIER_CONFIG_SITE = path.join(__dirname, 'config-site.txt');
const FICHIER_PID = path.join(__dirname, 'serveur.pid');
const TYPES_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---------------------------------------------------------------------------
// Lecture du fichier de configuration du serveur (CLE=valeur, # = commentaire)
// ---------------------------------------------------------------------------
function lireConfigServeur() {
  const defauts = {
    PORT: 3000,
    HOTE: '127.0.0.1',
    INTERVALLE_ACTUALISATION: 2000,
    CORS: 'oui',
    COMPTER_DASHBOARD: 'non',
  };
  try {
    const lignes = fs.readFileSync(FICHIER_CONFIG_SERVEUR, 'utf8').split(/\r?\n/);
    for (const ligne of lignes) {
      const nettoyee = ligne.trim();
      if (!nettoyee || nettoyee.startsWith('#')) continue;
      const egal = nettoyee.indexOf('=');
      if (egal < 0) continue;
      const cle = nettoyee.slice(0, egal).trim().toUpperCase();
      const valeur = nettoyee.slice(egal + 1).trim();
      if (!valeur) continue;
      defauts[cle] = valeur;
    }
  } catch (e) {
    // Fichier absent : on reste sur les valeurs par défaut.
  }
  return defauts;
}

const config = lireConfigServeur();
const PORT = parseInt(config.PORT, 10) || 3000;
const HOTE = config.HOTE || '127.0.0.1';
const ACTUALISATION_MS = parseInt(config.INTERVALLE_ACTUALISATION, 10) || 2000;
const CORS_ACTIF = String(config.CORS).toLowerCase() === 'oui';
// Si "oui", les requêtes du tableau de bord et les fichiers statiques
// sont comptés dans les compteurs principaux (comme avant).
const COMPTER_DASHBOARD = String(config.COMPTER_DASHBOARD).toLowerCase() === 'oui';

// ---------------------------------------------------------------------------
// Compteurs en mémoire
// ---------------------------------------------------------------------------
const stats = {
  requetesTotales: 0,
  requetesApi: 0,
  requetesDashboard: 0,
  horodatages: [],          // horodatages des requêtes COMPTÉES (10 dernières s)
  latences: [],             // latences des requêtes COMPTÉES, en ms
  demarrage: Date.now(),
};

function cpuEntreDeuxMesures() {
  // os.loadavg() n'est pas fiable sous Windows : on mesure le CPU réel
  // en comparant les temps d'occupation des cœurs entre deux appels.
  const cpus = os.cpus();
  let inactif = 0, total = 0;
  for (const cpu of cpus) {
    for (const t of Object.values(cpu.times)) total += t;
    inactif += cpu.times.idle;
  }
  return { inactif, total };
}
let mesureCpu = cpuEntreDeuxMesures();

// ---------------------------------------------------------------------------
// Journalisation sobre (limite le spam : au-delà de 20 requêtes/seconde)
// ---------------------------------------------------------------------------
function horodatage() {
  return new Date().toLocaleTimeString('fr-FR', { hour12: false });
}
let derniereLog = 0;
function journaliser(message) {
  const maintenant = Date.now();
  if (maintenant - derniereLog < 50) return; // max ~20 lignes/s
  derniereLog = maintenant;
  console.log(`[${horodatage()}] ${message}`);
}

// ---------------------------------------------------------------------------
// Lecture de config-site.txt (à CHAQUE requête /api/config → sans redémarrage)
// ---------------------------------------------------------------------------
function lireConfigSite() {
  const valeurs = {};
  try {
    const lignes = fs.readFileSync(FICHIER_CONFIG_SITE, 'utf8').split(/\r?\n/);
    for (const ligne of lignes) {
      const nettoyee = ligne.trim();
      if (!nettoyee || nettoyee.startsWith('#')) continue;
      const egal = nettoyee.indexOf('=');
      if (egal < 0) continue;
      const cle = nettoyee.slice(0, egal).trim().toUpperCase();
      const valeur = nettoyee.slice(egal + 1).trim();
      if (valeur) valeurs[cle] = valeur;
    }
  } catch (e) {
    // Fichier absent : le client utilisera ses valeurs par défaut.
  }
  return valeurs;
}

// ---------------------------------------------------------------------------
// Classification des requêtes
//   - "api-test"    : endpoints de test (ex. /api/health) → COMPTÉS
//   - "dashboard"   : /api/stats et /api/config (rafraîchissement auto)
//   - "statique"    : pages HTML, CSS, JS, images, favicon, etc.
// Seules les requêtes "api-test" alimentent les compteurs principaux,
// sauf si COMPTER_DASHBOARD=oui (comportage d'origine).
// ---------------------------------------------------------------------------
function classerRequete(url) {
  if (url === '/api/stats' || url === '/api/config') return 'dashboard';
  if (url.startsWith('/api/')) return 'api-test';
  return 'statique';
}

// ---------------------------------------------------------------------------
// Middleware maison : comptage des requêtes + CORS + mesure de latence
// ---------------------------------------------------------------------------
function middleware(req, res, suite) {
  const debut = Date.now();
  const categorie = classerRequete(req.url.split('?')[0]);

  // Le compteur du tableau de bord est TOUJOURS tenu, pour la visibilité.
  if (categorie === 'dashboard') stats.requetesDashboard++;

  const doitCompter = categorie === 'api-test' || COMPTER_DASHBOARD;
  if (doitCompter) {
    stats.requetesTotales++;
    const estApi = categorie !== 'statique';
    if (estApi) stats.requetesApi++;
    stats.horodatages.push(debut);

    res.on('finish', () => {
      const latence = Date.now() - debut;
      stats.latences.push(latence);
      if (stats.latences.length > 200) stats.latences.shift();
    });
  }

  if (CORS_ACTIF) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
  }

  suite();
}

// ---------------------------------------------------------------------------
// Nettoyage des URL pour empêcher la traversée de dossiers (../)
// ---------------------------------------------------------------------------
function cheminSecurise(url) {
  let decoded;
  try {
    decoded = decodeURIComponent(url.split('?')[0]);
  } catch (e) {
    return null; // URL malformée
  }
  const base = path.normalize(path.join(DOSSIER_PUBLIC, decoded));
  if (!base.startsWith(DOSSIER_PUBLIC + path.sep) && base !== DOSSIER_PUBLIC) {
    return null; // tentative de traversée
  }
  return base;
}

// ---------------------------------------------------------------------------
// Gestionnaires d'API
// ---------------------------------------------------------------------------
function envoyerJson(res, objet, code = 200) {
  const corps = JSON.stringify(objet);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(corps);
}

function gererHealth(res) {
  envoyerJson(res, { statut: 'ok', heure: new Date().toISOString() });
}

function gererStats(res) {
  // Requêtes par seconde : moyenne glissante sur les 10 dernières secondes.
  const limite = Date.now() - 10000;
  stats.horodatages = stats.horodatages.filter(t => t > limite);
  const requetesParSeconde = stats.horodatages.length / 10;

  const latenceMoyenne = stats.latences.length
    ? stats.latences.reduce((a, b) => a + b, 0) / stats.latences.length
    : 0;

  // Pourcentage CPU réel : différence entre deux mesures des cœurs.
  const maintenant = cpuEntreDeuxMesures();
  const dInactif = maintenant.inactif - mesureCpu.inactif;
  const dTotal = maintenant.total - mesureCpu.total;
  mesureCpu = maintenant;
  const pourcentageCpu = dTotal > 0 ? (1 - dInactif / dTotal) * 100 : 0;

  envoyerJson(res, {
    requetesTotales: stats.requetesTotales,
    requetesApi: stats.requetesApi,
    requetesDashboard: stats.requetesDashboard,
    requetesParSeconde: Math.round(requetesParSeconde * 100) / 100,
    latenceMoyenne: Math.round(latenceMoyenne * 100) / 100,
    memoireRssMo: Math.round((process.memoryUsage().rss / 1048576) * 100) / 100,
    chargeCpu: Math.round(pourcentageCpu * 10) / 10,
    uptimeSecondes: Math.round((Date.now() - stats.demarrage) / 1000),
    versionNode: process.version,
    heureDemarrage: new Date(stats.demarrage).toISOString(),
    intervalleActualisation: ACTUALISATION_MS,
    compterDashboard: COMPTER_DASHBOARD,
  });
}

function gererConfig(res) {
  envoyerJson(res, lireConfigSite());
}

// ---------------------------------------------------------------------------
// Fichiers statiques et pages
// ---------------------------------------------------------------------------
function servirFichier(chemin, res, codeStatut = 200) {
  fs.readFile(chemin, (erreur, contenu) => {
    if (erreur) {
      // Page d'erreur 404 personnalisée, si elle existe.
      const chemin404 = path.join(DOSSIER_PUBLIC, '404.html');
      fs.readFile(chemin404, (err404, page404) => {
        if (err404) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('404 — Page non trouvée');
        }
        res.writeHead(404, { 'Content-Type': TYPES_MIME['.html'] });
        res.end(page404);
      });
      return;
    }
    const ext = path.extname(chemin).toLowerCase();
    res.writeHead(codeStatut, { 'Content-Type': TYPES_MIME[ext] || 'application/octet-stream' });
    res.end(contenu);
  });
}

// ---------------------------------------------------------------------------
// Serveur HTTP
// ---------------------------------------------------------------------------
const serveur = http.createServer((req, res) => {
  middleware(req, res, () => {
    const url = req.url.split('?')[0];
    journaliser(`${req.method} ${url}`);

    try {
      if (url === '/api/health') return gererHealth(res);
      if (url === '/api/stats') return gererStats(res);
      if (url === '/api/config') return gererConfig(res);

      // Icône de favicon : réponse 204 (pas de contenu, pas de 404 inutile).
      if (url === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
      }

      // Sinon : fichier statique du dossier public/
      const chemin = cheminSecurise(url);
      if (!chemin) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('403 — Accès refusé');
      }

      let cible = chemin;
      if (cible === DOSSIER_PUBLIC || cible.endsWith(path.sep)) {
        cible = path.join(cible, 'index.html');
      }
      // Si la cible est un dossier (ex. "/"), servir index.html.
      if (fs.existsSync(cible) && fs.statSync(cible).isDirectory()) {
        cible = path.join(cible, 'index.html');
      }
      return servirFichier(cible, res);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 — Erreur interne du serveur');
    }
  });
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
serveur.on('error', (erreur) => {
  if (erreur.code === 'EADDRINUSE') {
    console.error(`\n[ERREUR] Le port ${PORT} est déjà utilisé.`);
    console.error('Un autre serveur tourne peut-être déjà. Lancez eteindre.bat, ou changez PORT dans config-serveur.txt.');
  } else {
    console.error(`\n[ERREUR] ${erreur.message}`);
  }
  process.exit(1);
});

serveur.listen(PORT, HOTE, () => {
  fs.writeFileSync(FICHIER_PID, String(process.pid));
  console.log('');
  console.log('  Serveur de test démarré');
  console.log(`  URL locale   : http://localhost:${PORT}`);
  console.log(`  URL réseau   : http://${HOTE}:${PORT}${HOTE === '0.0.0.0' ? '  (exposé au réseau local !)' : ''}`);
  console.log(`  Dossier      : ${DOSSIER_PUBLIC}`);
  console.log(`  PID          : ${process.pid}`);
  console.log(`  COMPTER_DASHBOARD : ${COMPTER_DASHBOARD ? 'oui' : 'non'}`);
  console.log('  Ctrl+C pour arrêter (ou eteindre.bat)');
  console.log('');
});

// ---------------------------------------------------------------------------
// Arrêt propre : suppression du fichier PID
// ---------------------------------------------------------------------------
function arretPropre(signal) {
  console.log(`\n[${horodatage()}] Arrêt du serveur (${signal})...`);
  try { fs.unlinkSync(FICHIER_PID); } catch (e) { /* déjà absent */ }
  serveur.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref(); // filet de sécurité
}
process.on('SIGINT', () => arretPropre('SIGINT'));
process.on('SIGTERM', () => arretPropre('SIGTERM'));
