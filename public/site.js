/**
 * site.js — Fonctions partagées pour le site test-charge.com
 * - Gestion du thème clair/sombre (même logique que app.js mais utilisée par toutes les pages)
 * - Menu mobile (burger) et mise en surbrillance du lien actif
 * - Mise à jour des chiffres en direct sur la page d'accueil (index.html)
 */

const PORT = 3000;
const SERVEUR_URL = `http://localhost:${PORT}`;

// ------------------------------- Thème -------------------------------
function appliquerTheme(thème) {
  document.documentElement.setAttribute('data-theme', thème);
}
function chargerTheme() {
  const sauvegarde = localStorage.getItem('theme-serveur-test');
  if (sauvegarde) {
    appliquerTheme(sauvegarde);
  } else {
    appliquerTheme('sombre');
  }
}
function basculerTheme() {
  const actuel = document.documentElement.getAttribute('data-theme');
  const nouveau = actuel === 'sombre' ? 'clair' : 'sombre';
  appliquerTheme(nouveau);
  localStorage.setItem('theme-serveur-test', nouveau);
}

// Bouton de bascule thème (présent dans toutes les pages)
document.addEventListener('DOMContentLoaded', () => {
  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) {
    chargerTheme();
    btnTheme.addEventListener('click', basculerTheme);
  }

  // ------------------------------- Menu mobile -------------------------------
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.nav');
  if (burger && nav) {
    burger.addEventListener('click', () => {
      nav.classList.toggle('ouvert');
      burger.classList.toggle('actif');
    });
  }

  // ------------------------------- Lien actif -------------------------------
  const liens = document.querySelectorAll('.nav a');
  liens.forEach(lien => {
    if (lien.href === window.location.href) {
      lien.classList.add('actif');
    }
  });

  // ------------------------------- Chiffres en direct (index.html uniquement) -------------------------------
  if (document.getElementById('valeur-etat')) {
    // Page d'accueil : mettre à jour les chiffres en direct toutes les 2 secondes (ou intervalle du serveur)
    async function mettreAJourChiffres() {
      try {
        const reponse = await fetch(`${SERVEUR_URL}/api/stats`);
        if (!reponse.ok) throw new Error('Réponse non OK');
        const data = await reponse.json();

        // État du serveur (on suppose en ligne si on a eu une réponse)
        document.getElementById('valeur-etat').textContent = 'En ligne';
        document.getElementById('valeur-etat').className = 'valeur etat-en-ligne';

        // Uptime
        document.getElementById('valeur-uptime').textContent = formaterUptime(data.uptimeSecondes ?? 0);

        // Requêtes totales et API
        document.getElementById('valeur-requetes').textContent = data.requetesTotales ?? '-';
        document.getElementById('valeur-api').textContent = data.requetesApi ?? '-';

        // RPS et CPU
        document.getElementById('valeur-rps').textContent = `${data.requetesParSeconde ?? '-'} / s`;
        document.getElementById('valeur-cpu').textContent = `${data.chargeCpu?.toFixed(1) ?? '-'} %`;
      } catch (e) {
        // Serveur hors ligne
        document.getElementById('valeur-etat').textContent = 'Hors ligne';
        document.getElementById('valeur-etat').className = 'valeur etat-hors-ligne';
        document.getElementById('valeur-uptime').textContent = '-';
        document.getElementById('valeur-requetes').textContent = '-';
        document.getElementById('valeur-api').textContent = '-';
        document.getElementById('valeur-rps').textContent = '- / s';
        document.getElementById('valeur-cpu').textContent = '- %';
      }
    }

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

    // Première mise à jour
    mettreAJourChiffres();
    // Rafraîchissement périodique (2 secondes par défaut, on pourrait lire l'intervalle depuis le serveur)
    setInterval(mettreAJourChiffres, 2000);
  }
});
