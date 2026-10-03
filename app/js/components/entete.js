// Barre d'en-tête persistante (logo, navigation, compte) - visible sur
// toutes les pages protégées, masquée sur /connexion et /changer-mot-de-passe.
import { deconnecter } from '../auth.js';
import { setProfil, getApercuRole, setApercuRole, getClientApercuId, setClientApercuId } from '../store.js';
import { navigate } from '../router.js';
import { listerNotifications, compterNonLues, marquerLue, marquerToutesLues } from '../services/notifications.js';
import { listerClientsApercu } from '../services/comptes.js';
import { echapperHtml } from '../engine/formatage.js';
import { monterRechercheGlobale } from './recherche-globale.js';
import { initialiserBoutonAllure } from './allure.js';
import { configurerPalette } from './palette-commandes.js';

const LIENS_CLIENT = [
  { href: '#/accueil', icone: 'layout-dashboard', libelle: 'Tableau de bord' },
  { href: '#/mes-demandes', icone: 'layout-list', libelle: 'Mes demandes' },
  { href: '#/documents', icone: 'folder-open', libelle: 'Mes documents' },
  { href: '#/rapport', icone: 'file-chart-column', libelle: 'Mon rapport' },
  { href: '#/glossaire', icone: 'book-open', libelle: 'Glossaire' },
  { href: '#/reclamation', icone: 'message-square-warning', libelle: 'Signaler un problème' },
  { href: '#/charte-rgpd', icone: 'shield-check', libelle: 'Charte RGPD' },
];

const LIENS_STAFF = [
  { href: '#/tableau-de-bord', icone: 'layout-dashboard', libelle: 'Tableau de bord' },
  { href: '#/clients', icone: 'building-2', libelle: 'Clients' },
  { href: '#/taches', icone: 'list-checks', libelle: 'Tâches' },
  { href: '#/reclamations', icone: 'message-square-warning', libelle: 'Réclamations' },
  { href: '#/demandes', icone: 'list', libelle: 'Demandes' },
  { href: '#/glossaire', icone: 'book-open', libelle: 'Glossaire' },
];

const LIENS_ADMIN = [
  { href: '#/comptes/nouveau', icone: 'user-plus', libelle: 'Créer un compte' },
  { href: '#/admin/utilisateurs', icone: 'users', libelle: 'Comptes' },
  { href: '#/indicateurs', icone: 'chart-column', libelle: 'Indicateurs' },
  { href: '#/admin/import-factures', icone: 'file-up', libelle: 'Import Shine' },
  { href: '#/admin/journal', icone: 'history', libelle: 'Journal d’audit' },
  { href: '#/admin/donnees-a-revoir', icone: 'shield-alert', libelle: 'Données à revoir' },
].map((l) => ({ ...l, admin: true }));

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

// Les liens d'administration sont précédés d'un titre de section (visible avec la
// nouvelle allure seulement).
function liensAvecSections(liens) {
  return liens.map((l, i) => (l.admin && !liens[i - 1]?.admin ? '<p class="menu-lateral__titre menu-lateral__titre--section">Administration</p>' : '') + lienLateral(l)).join('');
}

// Titre de la barre du haut, déduit de la route courante.
const TITRES_PAGE = [
  ['#/accueil', 'Tableau de bord'],
  ['#/tableau-de-bord', 'Tableau de bord'],
  ['#/mes-demandes', 'Mes demandes'],
  ['#/documents', 'Mes documents'],
  ['#/rapport', 'Mon rapport de projet'],
  ['#/indicateurs', 'Indicateurs'],
  ['#/glossaire', 'Glossaire'],
  ['#/charte-rgpd', 'Charte RGPD'],
  ['#/taches', 'Tâches'],
  ['#/reclamations', 'Réclamations'],
  ['#/reclamation', 'Signaler un problème'],
  ['#/clients/nouveau', 'Nouveau client'],
  ['#/clients/doublons', 'Doublons de clients'],
  ['#/clients/dormants', 'Clients dormants'],
  ['#/clients/', 'Fiche client'],
  ['#/clients', 'Clients'],
  ['#/demandes/nouvelle', 'Nouvelle demande'],
  ['#/demandes/', 'Demande'],
  ['#/demandes', 'Demandes'],
  ['#/comptes/nouveau', 'Créer un compte'],
  ['#/admin/utilisateurs', 'Comptes'],
  ['#/admin/import-factures', 'Import Shine'],
  ['#/admin/journal', 'Journal d’audit'],
  ['#/admin/donnees-a-revoir', 'Données à revoir'],
  ['#/d/', 'Ma demande'],
];

function titrePage() {
  const hash = location.hash || '#/';
  return TITRES_PAGE.find(([prefixe]) => hash.startsWith(prefixe))?.[1] ?? 'RD Recueil';
}

// Menu latéral façon RD_LMS (navigation, profil) et barre du haut (titre,
// notifications, thème), pour tous les rôles. Sur mobile le menu devient un
// tiroir ouvert par le bouton de la barre. Les identifiants (déconnexion,
// aperçu, notifications) sont ceux utilisés par les écouteurs de rendreEntete.
function gabaritLateral({ liens, profil, roleLibelle, selecteurApercu, selecteurClientApercu, estAdminReel, apercuActif, avecRecherche }) {
  const blocApercu = estAdminReel
    ? `<div class="menu-lateral__apercu">
        <details class="menu-lateral__details"${apercuActif ? ' open' : ''}>
          <summary class="menu-lateral__titre">Simuler une vue</summary>
          ${selecteurApercu}
          ${selecteurClientApercu}
          ${apercuActif ? '<button type="button" id="bouton-fin-apercu" class="menu-lateral__retour">Revenir à Admin</button>' : ''}
        </details>
      </div>`
    : '';
  return `
    <aside class="menu-lateral" id="menu-lateral">
      <a href="#/" class="menu-lateral__logo">
        <img src="assets/images/logo.svg" alt="" />
        <span>RD Recueil</span>
        <i data-lucide="chevrons-up-down" class="menu-lateral__chevron"></i>
      </a>
      <nav class="menu-lateral__nav" aria-label="Navigation principale">
        <p class="menu-lateral__titre"><span class="titre-actuel">Navigation</span><span class="titre-nouveau">Espace de travail</span></p>
        ${liensAvecSections(liens)}
      </nav>
      ${blocApercu}
      <div class="menu-lateral__pied">
        <div class="menu-lateral__profil">
          <span class="menu-lateral__avatar" aria-hidden="true">${initiales(profil)}</span>
          <span class="menu-lateral__identite"><strong>${profil.nom || profil.email}</strong><small>${roleLibelle}</small></span>
        </div>
        <button type="button" id="bouton-deconnexion" class="menu-lateral__deconnexion" title="Déconnexion">
          <i data-lucide="log-out"></i><span>Déconnexion</span>
        </button>
      </div>
    </aside>
    <div class="menu-voile" id="menu-voile"></div>
    <div class="barre-haut">
      <button type="button" id="bouton-menu" class="barre-haut__menu" aria-label="Afficher ou masquer le menu" aria-controls="menu-lateral" aria-expanded="true">
        <i data-lucide="panel-left-close" class="barre-haut__ico-fermer"></i>
        <i data-lucide="panel-left-open" class="barre-haut__ico-ouvrir"></i>
      </button>
      <span class="barre-haut__titre">${titrePage()}</span>
      ${avecRecherche ? '<div id="recherche-globale"></div>' : ''}
      <div class="barre-haut__outils">
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
        <button type="button" id="bouton-allure" class="entete__theme" aria-pressed="false" aria-label="Essayer la nouvelle allure (prototype)" title="Nouvelle allure (prototype)">
          <i data-lucide="sparkles"></i>
        </button>
        <button type="button" class="entete__theme" data-theme-toggle aria-label="Basculer entre mode clair et mode sombre" aria-pressed="false">
          <i data-lucide="moon"></i>
        </button>
        <div class="profil-haut">
          <button type="button" id="bouton-profil" class="profil-haut__bouton" aria-expanded="false" aria-haspopup="true">
            <span class="profil-haut__avatar" id="profil-avatar" aria-hidden="true"></span>
            <span class="profil-haut__nom" id="profil-nom"></span>
            <i data-lucide="chevron-down" class="profil-haut__chevron"></i>
          </button>
          <div id="menu-profil" class="profil-haut__menu" hidden>
            <div class="profil-haut__id">
              <span class="profil-haut__avatar" id="profil-avatar-menu" aria-hidden="true"></span>
              <span class="profil-haut__textes"><strong id="profil-nom-menu"></strong><small id="profil-email-menu"></small></span>
            </div>
            <button type="button" id="bouton-profil-deconnexion" class="profil-haut__action"><i data-lucide="log-out"></i><span>Déconnexion</span></button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Profil dans la barre du haut (nouvelle allure) : identité et déconnexion.
// La déconnexion réutilise le bouton du menu latéral (même écouteur).
function initialiserMenuProfil(profil) {
  const nom = profil.nom || profil.email || '';
  for (const [id, texte] of [['profil-avatar', initiales(nom)], ['profil-avatar-menu', initiales(nom)], ['profil-nom', nom], ['profil-nom-menu', nom], ['profil-email-menu', profil.email || '']]) {
    document.getElementById(id).textContent = texte;
  }
  const bouton = document.getElementById('bouton-profil');
  const menu = document.getElementById('menu-profil');
  const fermer = () => {
    menu.hidden = true;
    bouton.setAttribute('aria-expanded', 'false');
  };
  bouton.addEventListener('click', (evenement) => {
    evenement.stopPropagation();
    menu.hidden = !menu.hidden;
    bouton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', (evenement) => {
    if (!menu.hidden && !menu.contains(evenement.target)) fermer();
  });
  document.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Escape' && !menu.hidden) {
      fermer();
      bouton.focus();
    }
  });
  document.getElementById('bouton-profil-deconnexion').addEventListener('click', () => document.getElementById('bouton-deconnexion').click());
}

// Desktop : replie/déplie le menu (mémorisé). Mobile : ouvre/ferme le tiroir.
const CLE_MENU_REPLIE = 'rd-recueil-menu-replie';
const ECRAN_MOBILE = '(max-width: 900px)';

function initialiserMenu() {
  let replie = false;
  try {
    replie = localStorage.getItem(CLE_MENU_REPLIE) === '1';
  } catch {
    // stockage indisponible : le menu reste déplié.
  }
  document.body.classList.toggle('menu-replie', replie);
  document.body.classList.remove('menu-ouvert');

  const bouton = document.getElementById('bouton-menu');
  const majEtat = () => {
    const mobile = window.matchMedia(ECRAN_MOBILE).matches;
    const visible = mobile ? document.body.classList.contains('menu-ouvert') : !document.body.classList.contains('menu-replie');
    bouton.setAttribute('aria-expanded', String(visible));
  };
  majEtat();

  bouton.addEventListener('click', () => {
    if (window.matchMedia(ECRAN_MOBILE).matches) {
      document.body.classList.toggle('menu-ouvert');
      majEtat();
      return;
    }
    const nouveau = document.body.classList.toggle('menu-replie');
    try {
      localStorage.setItem(CLE_MENU_REPLIE, nouveau ? '1' : '0');
    } catch {
      // non mémorisé.
    }
    majEtat();
  });
  document.getElementById('menu-voile').addEventListener('click', () => {
    document.body.classList.remove('menu-ouvert');
    majEtat();
  });
}

export function rendreEntete(profil) {
  const entete = document.getElementById('entete');
  if (!entete || !profil) return;

  const estAdminReel = profil.role === 'admin';
  const roleApercu = estAdminReel ? getApercuRole() : null;
  const roleEffectif = roleApercu || profil.role;

  const liens = [...(roleEffectif === 'client' ? LIENS_CLIENT : LIENS_STAFF), ...(roleEffectif === 'admin' ? LIENS_ADMIN : [])];

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

  document.body.classList.add('layout-lateral');
  entete.classList.add('entete--lateral');
  entete.hidden = false;
  entete.innerHTML = gabaritLateral({
    liens,
    profil,
    roleLibelle: LIBELLES_ROLE[roleEffectif],
    selecteurApercu,
    selecteurClientApercu,
    estAdminReel,
    apercuActif: Boolean(roleApercu),
    avecRecherche: roleEffectif !== 'client',
  });

  initialiserMenu();
  const zoneRecherche = document.getElementById('recherche-globale');
  if (zoneRecherche) monterRechercheGlobale(zoneRecherche, { admin: roleEffectif === 'admin' });

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
  initialiserBoutonAllure(document.getElementById('bouton-allure'));
  initialiserMenuProfil(profil);
  // Menu de commandes (Ctrl+K) : réservé au personnel, comme la recherche de la barre du haut.
  const cliquer = (selecteur) => () => document.querySelector(selecteur)?.click();
  configurerPalette(
    roleEffectif === 'client'
      ? null
      : {
          liens,
          admin: roleEffectif === 'admin',
          actions: [
            { id: 'action:nouveau-client', libelle: 'Nouveau client ou prospect', icone: 'plus', mots: 'creer ajouter', href: '#/clients/nouveau' },
            ...(roleEffectif === 'admin' ? [{ id: 'action:doublons', libelle: 'Doublons de clients', icone: 'copy', mots: 'fusionner', href: '#/clients/doublons' }] : []),
            { id: 'action:theme', libelle: 'Changer de thème (clair ou sombre)', icone: 'moon', mots: 'sombre clair dark nuit', executer: cliquer('[data-theme-toggle]') },
            { id: 'action:allure', libelle: 'Changer d’allure (actuelle ou nouvelle)', icone: 'sparkles', mots: 'design look apparence', executer: cliquer('#bouton-allure') },
            { id: 'action:deconnexion', libelle: 'Se déconnecter', icone: 'log-out', mots: 'deconnexion quitter', executer: cliquer('#bouton-deconnexion') },
          ],
        }
  );

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
    option.value = c.user_id;
    const choisi = getClientApercuId();
    option.selected = choisi ? choisi === c.user_id : c.references.includes(refCourante);
    option.textContent = [c.nom, c.email, c.societes.join(', ')].filter(Boolean).join(' · ');
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    setClientApercuId(select.value || null);
    // Le tableau de bord du client choisi ; si on y est déjà, la route ne se
    // relance pas toute seule.
    if (location.hash === '#/accueil') window.dispatchEvent(new HashChangeEvent('hashchange'));
    else navigate('/accueil');
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
          <button type="button" class="panneau-notifications__item${n.lu ? '' : ' panneau-notifications__item--non-lue'}" data-id="${echapperHtml(n.id)}" data-reference="${echapperHtml(n.reference)}" data-lien="${echapperHtml(n.lien ?? '')}">
            <span class="panneau-notifications__titre">${echapperHtml(n.titre)}</span>
            <span class="panneau-notifications__meta">${echapperHtml(n.reference)} · ${formaterRelatif(n.created_at)}</span>
          </button>
        `
      )
      .join('');
    liste.querySelectorAll('.panneau-notifications__item').forEach((item) => {
      item.addEventListener('click', async () => {
        const { id, reference, lien } = item.dataset;
        panneau.hidden = true;
        bouton.setAttribute('aria-expanded', 'false');
        marquerLue(id)
          .then(rafraichirBadge)
          .catch(() => {});
        // Notification de tâche : chemin explicite ; sinon, la demande concernée.
        if (lien && lien.startsWith('/')) {
          navigate(lien);
          return;
        }
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
  document.body.classList.remove('layout-lateral', 'menu-replie', 'menu-ouvert');
}
