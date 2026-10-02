// Barre d'en-tête persistante (logo, navigation, compte) - visible sur
// toutes les pages protégées, masquée sur /connexion et /changer-mot-de-passe.
import { deconnecter } from '../auth.js';
import { setProfil, getApercuRole, setApercuRole } from '../store.js';
import { navigate } from '../router.js';
import { listerNotifications, compterNonLues, marquerLue, marquerToutesLues } from '../services/notifications.js';
import { listerClientsApercu } from '../services/comptes.js';

const LIENS_CLIENT = [
  { href: '#/accueil', icone: 'layout-dashboard', libelle: 'Tableau de bord' },
  { href: '#/mes-demandes', icone: 'layout-list', libelle: 'Mes demandes' },
  { href: '#/documents', icone: 'folder-open', libelle: 'Mes documents' },
  { href: '#/glossaire', icone: 'book-open', libelle: 'Glossaire' },
  { href: '#/charte-rgpd', icone: 'shield-check', libelle: 'Charte RGPD' },
];

const LIENS_STAFF = [
  { href: '#/tableau-de-bord', icone: 'layout-dashboard', libelle: 'Tableau de bord' },
  { href: '#/demandes', icone: 'list', libelle: 'Demandes' },
  { href: '#/glossaire', icone: 'book-open', libelle: 'Glossaire' },
];

const LIBELLES_ROLE = { admin: 'Admin', consultant: 'Consultant', client: 'Client' };

function estLienActif(href) {
  const hash = location.hash || '#/';
  if (href === '#/mes-demandes') return hash.startsWith('#/mes-demandes') || hash.startsWith('#/d/');
  return hash.startsWith(href);
}

function initiales(profil) {
  const mots = (profil.nom || profil.email || '?').trim().split(/[\s@.]+/).filter(Boolean);
  return ((mots[0]?.[0] || '?') + (mots[1]?.[0] || '')).toUpperCase();
}

function lienLateral(l) {
  const actif = estLienActif(l.href);
  return `<a href="${l.href}" class="menu-lateral__lien${actif ? ' menu-lateral__lien--actif' : ''}"${actif ? ' aria-current="page"' : ''}><i data-lucide="${l.icone}"></i><span>${l.libelle}</span></a>`;
}

// Espace client : menu latéral façon RD_LMS (sur mobile, le CSS le replie en
// barre du haut). Mêmes identifiants que l'en-tête classique, pour que les
// écouteurs de rendreEntete (déconnexion, aperçu, notifications) restent valables.
function gabaritLateral({ liens, profil, selecteurApercu, selecteurClientApercu, apercuActif }) {
  const blocApercu = apercuActif
    ? `<div class="menu-lateral__apercu">
        <p class="menu-lateral__titre">Simuler une vue</p>
        ${selecteurApercu}
        ${selecteurClientApercu}
        <button type="button" id="bouton-fin-apercu" class="menu-lateral__retour">Revenir à Admin</button>
      </div>`
    : '';
  return `
    <div class="menu-lateral">
      <a href="#/accueil" class="menu-lateral__logo">
        <img src="assets/images/logo.svg" alt="" />
        <span>RD Recueil</span>
      </a>
      <nav class="menu-lateral__nav" aria-label="Navigation principale">
        <p class="menu-lateral__titre">Navigation</p>
        ${liens.map(lienLateral).join('')}
      </nav>
      ${blocApercu}
      <div class="menu-lateral__pied">
        <div class="menu-lateral__profil">
          <span class="menu-lateral__avatar" aria-hidden="true">${initiales(profil)}</span>
          <span class="menu-lateral__identite"><strong>${profil.nom || profil.email}</strong><small>Client</small></span>
        </div>
        <div class="menu-lateral__outils">
          <div class="entete__notifications">
            <button type="button" id="bouton-notifications" class="entete__theme" aria-label="Notifications" aria-expanded="false">
              <i data-lucide="bell"></i>
              <span id="badge-notifications" class="entete__badge-notifications" hidden>0</span>
            </button>
            <div id="panneau-notifications" class="panneau-notifications" hidden>
              <div class="panneau-notifications__entete">
                <span>Notifications</span>
                <button type="button" id="bouton-tout-lu" class="panneau-notifications__tout-lu">Tout marquer lu</button>
              </div>
              <div id="liste-notifications" class="panneau-notifications__liste"></div>
            </div>
          </div>
          <button type="button" class="entete__theme" data-theme-toggle aria-label="Basculer entre mode clair et mode sombre" aria-pressed="false">
            <i data-lucide="moon"></i>
          </button>
          <button type="button" id="bouton-deconnexion" class="menu-lateral__deconnexion" title="Déconnexion">
            <i data-lucide="log-out"></i><span>Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function rendreEntete(profil) {
  const entete = document.getElementById('entete');
  if (!entete || !profil) return;

  const estAdminReel = profil.role === 'admin';
  const roleApercu = estAdminReel ? getApercuRole() : null;
  const roleEffectif = roleApercu || profil.role;

  const liens = roleEffectif === 'client' ? LIENS_CLIENT : LIENS_STAFF;
  const lienCompte =
    roleEffectif === 'admin'
      ? `
        <a href="#/comptes/nouveau" class="entete__lien"><i data-lucide="user-plus"></i><span>Créer un compte</span></a>
        <a href="#/admin/utilisateurs" class="entete__lien"><i data-lucide="users"></i><span>Comptes</span></a>
      `
      : '';

  const selecteurApercu = estAdminReel
    ? `
      <label class="entete__apercu">
        <span class="entete__apercu-etiquette">Aperçu</span>
        <select id="select-apercu-role" class="entete__apercu-select">
          <option value="admin" ${roleEffectif === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="consultant" ${roleEffectif === 'consultant' ? 'selected' : ''}>Consultant</option>
          <option value="client" ${roleEffectif === 'client' ? 'selected' : ''}>Client</option>
        </select>
      </label>
    `
    : '';

  const selecteurClientApercu =
    estAdminReel && roleApercu === 'client'
      ? `
        <label class="entete__apercu">
          <span class="entete__apercu-etiquette">Client</span>
          <select id="select-apercu-client" class="entete__apercu-select">
            <option value="">Choisir un client…</option>
          </select>
        </label>
      `
      : '';

  const banniereApercu =
    estAdminReel && roleApercu
      ? `
        <div class="entete__banniere-apercu">
          <i data-lucide="eye"></i>
          <span>Vous visualisez la navigation comme un compte <strong>${LIBELLES_ROLE[roleApercu]}</strong>. Vos droits réels restent Admin.</span>
          <button type="button" id="bouton-fin-apercu" class="btn btn--secondaire">Revenir à Admin</button>
        </div>
      `
      : '';

  const lateral = roleEffectif === 'client';
  document.body.classList.toggle('layout-lateral', lateral);
  entete.classList.toggle('entete--lateral', lateral);

  entete.hidden = false;
  entete.innerHTML = lateral
    ? gabaritLateral({ liens, profil, selecteurApercu, selecteurClientApercu, apercuActif: estAdminReel && Boolean(roleApercu) })
    : `
    <div class="entete__conteneur">
      <a href="#/" class="entete__logo">
        <img src="assets/images/logo.svg" alt="" class="entete__logo-image" />
        <span>RD Recueil</span>
      </a>
      <nav class="entete__nav" aria-label="Navigation principale">
        ${liens.map((l) => `<a href="${l.href}" class="entete__lien"><i data-lucide="${l.icone}"></i><span>${l.libelle}</span></a>`).join('')}
        ${lienCompte}
      </nav>
      <div class="entete__compte">
        ${selecteurApercu}
        ${selecteurClientApercu}
        <span class="entete__nom">${profil.nom || profil.email}</span>
        <div class="entete__notifications">
          <button type="button" id="bouton-notifications" class="entete__theme" aria-label="Notifications" aria-expanded="false">
            <i data-lucide="bell"></i>
            <span id="badge-notifications" class="entete__badge-notifications" hidden>0</span>
          </button>
          <div id="panneau-notifications" class="panneau-notifications" hidden>
            <div class="panneau-notifications__entete">
              <span>Notifications</span>
              <button type="button" id="bouton-tout-lu" class="panneau-notifications__tout-lu">Tout marquer lu</button>
            </div>
            <div id="liste-notifications" class="panneau-notifications__liste"></div>
          </div>
        </div>
        <button type="button" class="entete__theme" data-theme-toggle aria-label="Basculer entre mode clair et mode sombre" aria-pressed="false">
          <i data-lucide="moon"></i>
        </button>
        <button type="button" id="bouton-deconnexion" class="btn btn--secondaire entete__deconnexion" title="Déconnexion">
          <i data-lucide="log-out"></i><span>Déconnexion</span>
        </button>
      </div>
    </div>
    ${banniereApercu}
  `;

  document.getElementById('bouton-deconnexion').addEventListener('click', async () => {
    await deconnecter();
    setProfil(null);
    navigate('/connexion');
  });

  const selectApercu = document.getElementById('select-apercu-role');
  if (selectApercu) {
    selectApercu.addEventListener('change', () => {
      setApercuRole(selectApercu.value);
      rendreEntete(profil);
    });
  }

  const boutonFinApercu = document.getElementById('bouton-fin-apercu');
  if (boutonFinApercu) {
    boutonFinApercu.addEventListener('click', () => {
      setApercuRole(null);
      rendreEntete(profil);
    });
  }

  const selectApercuClient = document.getElementById('select-apercu-client');
  if (selectApercuClient) {
    initialiserSelecteurClientApercu(selectApercuClient);
  }

  initialiserNotifications(profil);

  if (window.lucide) window.lucide.createIcons();
  if (window.gestionnaireTheme) window.gestionnaireTheme.mettreAJourBoutons();
}

// Mise en cache pour le module : la liste des clients ne change pas assez
// souvent pour justifier un rechargement à chaque navigation en aperçu client.
let clientsApercuCache = null;

// Un compte client par ligne (nom, e-mail, société) ; le choix ouvre sa
// demande la plus récente, vue comme il la verrait.
async function initialiserSelecteurClientApercu(select) {
  if (!clientsApercuCache) {
    try {
      clientsApercuCache = await listerClientsApercu();
    } catch {
      clientsApercuCache = [];
    }
  }
  const refCourante = (location.hash.match(/^#\/d\/([^/]+)/) || [])[1] || '';
  select.innerHTML = '';
  const vide = document.createElement('option');
  vide.value = '';
  vide.textContent = 'Choisir un client…';
  select.appendChild(vide);
  for (const c of clientsApercuCache) {
    const option = document.createElement('option');
    option.value = c.references[0];
    option.selected = c.references.includes(refCourante);
    option.textContent = [c.nom, c.email, c.societes.join(', ')].filter(Boolean).join(' · ');
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    if (select.value) navigate(`/d/${select.value}`);
  });
}

function formaterRelatif(date) {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  return `il y a ${Math.round(heures / 24)} j`;
}

// Le panneau et le bouton sont recréés à chaque rendreEntete() (innerHTML
// régénéré à chaque navigation) : on relit les éléments courants par id à
// chaque clic plutôt que de garder une référence, et on n'attache le
// gestionnaire clic-en-dehors qu'une seule fois pour toute la session.
if (!window.__notifClicExterieurAttache) {
  window.__notifClicExterieurAttache = true;
  document.addEventListener('click', (evt) => {
    const panneau = document.getElementById('panneau-notifications');
    const bouton = document.getElementById('bouton-notifications');
    if (!panneau || panneau.hidden || !bouton) return;
    if (panneau.contains(evt.target) || bouton.contains(evt.target)) return;
    panneau.hidden = true;
    bouton.setAttribute('aria-expanded', 'false');
  });
}

function initialiserNotifications(profil) {
  const bouton = document.getElementById('bouton-notifications');
  const panneau = document.getElementById('panneau-notifications');
  const badge = document.getElementById('badge-notifications');
  const liste = document.getElementById('liste-notifications');
  const boutonToutLu = document.getElementById('bouton-tout-lu');
  if (!bouton) return;

  async function rafraichirBadge() {
    try {
      const n = await compterNonLues();
      badge.hidden = n === 0;
      badge.textContent = n > 9 ? '9+' : String(n);
    } catch {
      badge.hidden = true;
    }
  }

  async function rafraichirListe() {
    liste.innerHTML = '<p class="texte-doux panneau-notifications__vide">Chargement…</p>';
    let notifications;
    try {
      notifications = await listerNotifications();
    } catch {
      liste.innerHTML = '<p class="texte-doux panneau-notifications__vide">Impossible de charger les notifications.</p>';
      return;
    }
    if (notifications.length === 0) {
      liste.innerHTML = '<p class="texte-doux panneau-notifications__vide">Aucune notification.</p>';
      return;
    }
    liste.innerHTML = notifications
      .map(
        (n) => `
          <button type="button" class="panneau-notifications__item${n.lu ? '' : ' panneau-notifications__item--non-lue'}" data-id="${n.id}" data-reference="${n.reference}">
            <span class="panneau-notifications__titre">${n.titre}</span>
            <span class="panneau-notifications__meta">${n.reference} · ${formaterRelatif(n.created_at)}</span>
          </button>
        `
      )
      .join('');
    liste.querySelectorAll('.panneau-notifications__item').forEach((item) => {
      item.addEventListener('click', async () => {
        const { id, reference } = item.dataset;
        panneau.hidden = true;
        bouton.setAttribute('aria-expanded', 'false');
        marquerLue(id)
          .then(rafraichirBadge)
          .catch(() => {});
        const prefixe = profil.role === 'client' ? 'd' : 'demandes';
        navigate(`/${prefixe}/${reference}`);
      });
    });
  }

  bouton.addEventListener('click', () => {
    const etaitOuvert = !panneau.hidden;
    panneau.hidden = etaitOuvert;
    bouton.setAttribute('aria-expanded', String(!etaitOuvert));
    if (!etaitOuvert) rafraichirListe();
  });

  boutonToutLu.addEventListener('click', async () => {
    try {
      await marquerToutesLues();
      rafraichirBadge();
      rafraichirListe();
    } catch {
      // silencieux : l'utilisateur peut réessayer.
    }
  });

  rafraichirBadge();
}

export function viderEntete() {
  const entete = document.getElementById('entete');
  if (!entete) return;
  entete.hidden = true;
  entete.innerHTML = '';
  entete.classList.remove('entete--lateral');
  document.body.classList.remove('layout-lateral');
}
