// Barre d'en-tête persistante (logo, navigation, compte) - visible sur
// toutes les pages protégées, masquée sur /connexion et /changer-mot-de-passe.
import { deconnecter } from '../auth.js';
import { setProfil, getApercuRole, setApercuRole } from '../store.js';
import { navigate } from '../router.js';
import { listerNotifications, compterNonLues, marquerLue, marquerToutesLues } from '../services/notifications.js';
import { listerDemandes } from '../services/demandes.js';

const LIENS_CLIENT = [
  { href: '#/mes-demandes', icone: 'layout-list', libelle: 'Mes demandes' },
  { href: '#/glossaire', icone: 'book-open', libelle: 'Glossaire' },
];

const LIENS_STAFF = [
  { href: '#/tableau-de-bord', icone: 'layout-dashboard', libelle: 'Tableau de bord' },
  { href: '#/demandes', icone: 'list', libelle: 'Demandes' },
  { href: '#/glossaire', icone: 'book-open', libelle: 'Glossaire' },
];

const LIBELLES_ROLE = { admin: 'Admin', consultant: 'Consultant', client: 'Client' };

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

  const selecteurDemandeApercu =
    estAdminReel && roleApercu === 'client'
      ? `
        <label class="entete__apercu">
          <span class="entete__apercu-etiquette">Demande</span>
          <select id="select-apercu-demande" class="entete__apercu-select">
            <option value="">Choisir une demande…</option>
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

  entete.hidden = false;
  entete.innerHTML = `
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
        ${selecteurDemandeApercu}
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

  const selectApercuDemande = document.getElementById('select-apercu-demande');
  if (selectApercuDemande) {
    initialiserSelecteurDemandeApercu(selectApercuDemande);
  }

  initialiserNotifications(profil);

  if (window.lucide) window.lucide.createIcons();
  if (window.gestionnaireTheme) window.gestionnaireTheme.mettreAJourBoutons();
}

// Mise en cache pour le module : la liste des demandes ne change pas assez
// souvent pour justifier un rechargement à chaque navigation en aperçu client.
let demandesApercuCache = null;

async function initialiserSelecteurDemandeApercu(select) {
  if (!demandesApercuCache) {
    try {
      demandesApercuCache = await listerDemandes();
    } catch {
      demandesApercuCache = [];
    }
  }
  const refCourante = (location.hash.match(/^#\/d\/([^/]+)/) || [])[1] || '';
  select.innerHTML =
    '<option value="">Choisir une demande…</option>' +
    demandesApercuCache
      .map(
        (d) =>
          `<option value="${d.reference}" ${d.reference === refCourante ? 'selected' : ''}>${d.reference} · ${d.clients?.raison_sociale ?? 'Sans nom'}</option>`
      )
      .join('');

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
}
