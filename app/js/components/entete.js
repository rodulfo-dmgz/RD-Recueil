// Barre d'en-tête persistante (logo, navigation, compte) - visible sur
// toutes les pages protégées, masquée sur /connexion et /changer-mot-de-passe.
import { deconnecter } from '../auth.js';
import { setProfil, getApercuRole, setApercuRole } from '../store.js';
import { navigate } from '../router.js';

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
      ? '<a href="#/comptes/nouveau" class="entete__lien"><i data-lucide="user-plus"></i><span>Créer un compte</span></a>'
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
      <a href="#/" class="entete__logo">RD Recueil</a>
      <nav class="entete__nav" aria-label="Navigation principale">
        ${liens.map((l) => `<a href="${l.href}" class="entete__lien"><i data-lucide="${l.icone}"></i><span>${l.libelle}</span></a>`).join('')}
        ${lienCompte}
      </nav>
      <div class="entete__compte">
        ${selecteurApercu}
        <span class="entete__nom">${profil.nom || profil.email}</span>
        <button type="button" class="theme-toggle entete__theme" data-theme-toggle aria-label="Basculer entre mode clair et mode sombre" aria-pressed="false">
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

  if (window.lucide) window.lucide.createIcons();
  if (window.gestionnaireTheme) window.gestionnaireTheme.mettreAJourBoutons();
}

export function viderEntete() {
  const entete = document.getElementById('entete');
  if (!entete) return;
  entete.hidden = true;
  entete.innerHTML = '';
}
