// Barre d'en-tête persistante (logo, navigation, compte) - visible sur
// toutes les pages protégées, masquée sur /connexion et /changer-mot-de-passe.
import { deconnecter } from '../auth.js';
import { setProfil } from '../store.js';
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

export function rendreEntete(profil) {
  const entete = document.getElementById('entete');
  if (!entete || !profil) return;

  const liens = profil.role === 'client' ? LIENS_CLIENT : LIENS_STAFF;
  const lienCompte =
    profil.role === 'admin'
      ? '<a href="#/comptes/nouveau" class="entete__lien"><i data-lucide="user-plus"></i><span>Créer un compte</span></a>'
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
        <span class="entete__nom">${profil.nom || profil.email}</span>
        <button type="button" id="bouton-deconnexion" class="btn btn--secondaire entete__deconnexion" title="Déconnexion">
          <i data-lucide="log-out"></i><span>Déconnexion</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('bouton-deconnexion').addEventListener('click', async () => {
    await deconnecter();
    setProfil(null);
    navigate('/connexion');
  });

  if (window.lucide) window.lucide.createIcons();
}

export function viderEntete() {
  const entete = document.getElementById('entete');
  if (!entete) return;
  entete.hidden = true;
  entete.innerHTML = '';
}
