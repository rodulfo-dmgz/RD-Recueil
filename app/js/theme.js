// Gestion du thème clair/sombre - script global (non-module), chargé avant
// js/main.js. Persistance localStorage, respect de prefers-color-scheme.
const CLE_THEME = 'rd-recueil-theme';

class GestionnaireTheme {
  constructor() {
    this.html = document.documentElement;
    this.themeActuel = this.themeStocke() || this.themeSysteme();
    this.init();
  }

  init() {
    this.appliquerTheme(this.themeActuel, false);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.attacherEvenements());
    } else {
      this.attacherEvenements();
    }
    this.observerSysteme();
  }

  themeStocke() {
    try {
      return localStorage.getItem(CLE_THEME);
    } catch {
      return null;
    }
  }

  themeSysteme() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  appliquerTheme(theme, sauvegarder = true) {
    this.html.classList.toggle('dark', theme === 'dark');
    this.themeActuel = theme;
    if (sauvegarder) {
      try {
        localStorage.setItem(CLE_THEME, theme);
      } catch {
        // Stockage indisponible (navigation privée) : le thème reste actif pour la session.
      }
    }
    this.mettreAJourBoutons();
  }

  basculer() {
    this.appliquerTheme(this.themeActuel === 'light' ? 'dark' : 'light');
  }

  attacherEvenements() {
    if (this._delegationAttachee) return;
    document.addEventListener('click', (evt) => {
      if (evt.target.closest('[data-theme-toggle]')) this.basculer();
    });
    this._delegationAttachee = true;
  }

  mettreAJourBoutons() {
    document.querySelectorAll('[data-theme-toggle]').forEach((bouton) => {
      const sombre = this.themeActuel === 'dark';
      bouton.setAttribute('aria-pressed', String(sombre));
      bouton.setAttribute('aria-label', sombre ? 'Passer au thème clair' : 'Passer au thème sombre');
      bouton.innerHTML = '';
      const icone = document.createElement('i');
      icone.setAttribute('data-lucide', sombre ? 'sun' : 'moon');
      bouton.appendChild(icone);
      if (window.lucide) window.lucide.createIcons({ root: bouton });
    });
  }

  observerSysteme() {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const gerer = (evt) => {
      if (!this.themeStocke()) this.appliquerTheme(evt.matches ? 'dark' : 'light', false);
    };
    mq.addEventListener ? mq.addEventListener('change', gerer) : mq.addListener(gerer);
  }
}

window.gestionnaireTheme = new GestionnaireTheme();
