/**
 * app.js — Client JavaScript du tableau de bord.
 * Récupère les stats, dessine le graphique, gère le thème clair/sombre.
 * Utilisé par tableau-de-bord.html (et peut être réutilisé ailleurs).
 */

// Port par défaut ; remplacé par le serveur si livré via HTTP.
const PORT = 3000;
const SERVEUR_URL = `http://localhost:${PORT}`;

// Références DOM du tableau de bord
const $statTot = document.getElementById('stat-tot');
const $statApi = document.getElementById('stat-api');
const $statDash = document.getElementById('stat-dash'); // requêtes dashboard
const $statRps = document.getElementById('stat-rps');
const $statLat = document.getElementById('stat-lat');
const $statMem = document.getElementById('stat-mem');
const $statCpu = document.getElementById('stat-cpu');
const $statUpt = document.getElementById('stat-upt');
const $statNode = document.getElementById('stat-node');
const $intervalleEl = document.getElementById('intervalle');
const $heureMaj = document.getElementById('heure-maj');
const $btnTheme = document.getElementById('btn-theme');
const $canvas = document.getElementById('canvas-rps');
const $ctx = $canvas ? $canvas.getContext('2d') : null;

// Données temps réel pour le graphique (max 60 points)
let donneesRps = [];
let intervalleRafraichissement = 2000; // valeur par défaut

// ---------------------------------------------------------------------------
// Thème clair/sombre
// ---------------------------------------------------------------------------
const themeSombre = 'sombre';
function appliquerTheme(thème) {
  document.documentElement.setAttribute('data-theme', thème);
}
function chargerTheme() {
  const sauvegarde = localStorage.getItem('theme-serveur-test');
  if (sauvegarde) {
    appliquerTheme(sauvegarde);
  } else {
    appliquerTheme(themeSombre);
  }
}
function basculerTheme() {
  const actuel = document.documentElement.getAttribute('data-theme');
  const nouveau = actuel === 'sombre' ? 'clair' : 'sombre';
  appliquerTheme(nouveau);
  localStorage.setItem('theme-serveur-test', nouveau);
}
$btnTheme.addEventListener('click', basculerTheme);

// ---------------------------------------------------------------------------
// Mise en forme de l'uptime (1 h 23 min 05 s)
// ---------------------------------------------------------------------------
function formaterUptime(secondes) {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} h`);
  if (m > 0 || h > 0) parts.push(`${m.toString().padStart(2, '0')} min`);
  parts.push(`${s.toString().padStart(2, '0')} s`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Dessine le mini-graphique en temps réel
// ---------------------------------------------------------------------------
function rafraichirGraphique() {
  if (!$ctx) return;
  const largeur = $canvas.width;
  const hauteur = $canvas.height;
  const margin = 20;
  const w = largeur - 2 * margin;
  const h = hauteur - 2 * margin;

  $ctx.clearRect(0, 0, largeur, hauteur);

  // Ligne de fond
  $ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  $ctx.lineWidth = 1;
  $ctx.beginPath();
  $ctx.moveTo(margin, h / 2);
  $ctx.lineTo(largeur - margin, h / 2);
  $ctx.stroke();

  // Grille verticale
  for (let i = 0; i <= 3; i++) {
    const x = margin + (i * w) / 3;
    $ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    $ctx.beginPath();
    $ctx.moveTo(x, margin);
    $ctx.lineTo(x, hauteur - margin);
    $ctx.stroke();
  }

  // Courbe des RPS
  if (donneesRps.length === 0) return;
  const maxVisuel = Math.max(...donneesRps, 10);
  $ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00a2ff';
  $ctx.lineWidth = 2.5;
  $ctx.shadowBlur = 8;
  $ctx.shadowColor = $ctx.strokeStyle;
  $ctx.beginPath();
  donneesRps.forEach((valeur, i) => {
    const x = margin + (i / (donneesRps.length - 1)) * w;
    const y = hauteur - margin - (valeur / maxVisuel) * h;
    if (i === 0) $ctx.moveTo(x, y);
    else $ctx.lineTo(x, y);
  });
  $ctx.stroke();
  $ctx.shadowBlur = 0;
}

// ---------------------------------------------------------------------------
// Récupère la configuration du serveur (ou les valeurs par défaut)
// ---------------------------------------------------------------------------
async function verifierServeur() {
  try {
    const reponse = await fetch(`${SERVEUR_URL}/api/stats`);
    if (!reponse.ok) throw new Error('Réponse non OK');
    const data = await reponse.json();
    mettreAJourStats(data);
    mettreAJourEtat('en-ligne');
    return true;
  } catch (e) {
    mettreAJourEtat('hors-ligne');
    return false;
  }
}

// ---------------------------------------------------------------------------
// Met à jour l'affichage des stats du tableau de bord
// ---------------------------------------------------------------------------
function mettreAJourStats(data) {
  $statTot.textContent = data.requetesTotales ?? '-';
  $statApi.textContent = data.requetesApi ?? '-';
  $statDash.textContent = data.requetesDashboard ?? '-';
  $statRps.textContent = `${data.requetesParSeconde ?? '-'} / s`;
  $statLat.textContent = `${data.latenceMoyenne?.toFixed(1) ?? '-'} ms`;
  $statMem.textContent = `${data.memoireRssMo?.toFixed(1) ?? '-'} Mo`;
  $statCpu.textContent = `${data.chargeCpu?.toFixed(1) ?? '-'} %`;
  $statUpt.textContent = formaterUptime(data.uptimeSecondes ?? 0);
  $statNode.textContent = data.versionNode ?? '-';
  $intervalleEl.textContent = data.intervalleActualisation ?? intervalleRafraichissement;

  // Graphique
  if (donneesRps.length >= 60) donneesRps.shift();
  donneesRps.push(data.requetesParSeconde ?? 0);
  rafraichirGraphique();
}

// ---------------------------------------------------------------------------
// Change l'état (en ligne / hors ligne)
// ---------------------------------------------------------------------------
function mettreAJourEtat(etat) {
  const $pastille = document.getElementById('pastille-etat');
  if ($pastille) {
    if (etat === 'en-ligne') {
      $pastille.className = 'pastille pastille-en-ligne';
      $pastille.innerHTML = '<span class="point"></span>En ligne';
    } else {
      $pastille.className = 'pastille pastille-hors-ligne';
      $pastille.innerHTML = '<span class="point"></span>Hors ligne';
    }
  }
}

// ---------------------------------------------------------------------------
// Gestion des boutons "Tester" et "Copier l'URL"
// ---------------------------------------------------------------------------
function initBoutonsTester() {
  const endpoints = document.querySelectorAll('.endpoint');
  endpoints.forEach(el => {
    const btnTest = el.querySelector('.btn-tester');
    const btnCopier = el.querySelector('.btn-copier');
    const pre = el.querySelector('.reponse-json');

    btnTest.addEventListener('click', async () => {
      const chemin = el.dataset.path;
      try {
        btnTest.disabled = true;
        btnTest.textContent = 'Test...';
        const reponse = await fetch(`${SERVEUR_URL}${chemin}`);
        const texte = await reponse.text();
        pre.textContent = texte;
      } catch (e) {
        pre.textContent = `Erreur réseau : ${e.message}`;
      } finally {
        btnTest.disabled = false;
        btnTest.textContent = 'Tester';
      }
    });

    btnCopier.addEventListener('click', () => {
      const url = btnCopier.dataset.url;
      navigator.clipboard.writeText(url).then(() => {
        const orig = btnCopier.textContent;
        btnCopier.textContent = 'Copié !';
        setTimeout(() => btnCopier.textContent = orig, 1500);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // ------------------------------- Theme -------------------------------
  chargerTheme();
  if ($btnTheme) $btnTheme.addEventListener('click', basculerTheme);

  // Avertissement si file:// (non utilisé ici mais au cas où)
  const $avertissement = document.getElementById('avertissement');
  if ($avertissement && location.protocol === 'file:') {
    $avertissement.textContent = `Vous voyez ce site en direct depuis le disque.
Il se connecte automatiquement au serveur sur ${SERVEUR_URL}`;
  }

  // Détection du protocole
  if (location.protocol !== 'file:') {
    // Si livré par le serveur, on peut obtenir le vrai port
    try {
      const reponse = await fetch(`${SERVEUR_URL}/api/config`, { cache: 'no-store' });
      // OK, le serveur est joignable
    } catch (e) {
      mettreAJourEtat('hors-ligne');
    }
  }

  await verifierServeur(); // première charge
  initBoutonsTester();


  // Bouton Actualiser (clic unique)
  const $btnRefresh = document.getElementById('btn-refresh');
  if ($btnRefresh) {
    $btnRefresh.addEventListener('click', async () => {
      $btnRefresh.disabled = true;
      $btnRefresh.textContent = 'Actualisation...';
      await verifierServeur();
      $btnRefresh.disabled = false;
      $btnRefresh.textContent = 'Actualiser';
      if ($heureMaj) $heureMaj.textContent = new Date().toLocaleTimeString('fr-FR');
    });
  }
  // Raffraîchissement automatique (désactivé si intervalle = 0)
  if (intervalleRafraichissement > 0) {
    setInterval(async () => {
      await verifierServeur();
    }, intervalleRafraichissement);
  } else {
    const $msg = document.getElementById('msg-actualisation');
    if ($msg) {
      $msg.textContent = 'Actualisation automatique : désactivée';
      $msg.style.display = 'inline-block';
    }
  }

  // Première mise à jour du timestamp
  if ($heureMaj) $heureMaj.textContent = new Date().toLocaleTimeString('fr-FR');
});