import { route, notFound, navigate, startRouter } from './router.js';
import { obtenirSession, obtenirProfil, surChangementAuth } from './auth.js';
import { getProfil, setProfil } from './store.js';
import { vueConnexion } from './views/client/connexion.js';
import { vueMesDemandes } from './views/client/mes-demandes.js';
import { vueAccueilDemande } from './views/client/accueil.js';
import { vueSection } from './views/client/section.js';
import { vueRecap } from './views/client/recap.js';
import { vueGlossaire } from './views/client/glossaire.js';
import { vueCadrageClient } from './views/client/cadrage.js';
import { vueTableauDeBord } from './views/consultant/tableau-de-bord.js';
import { vueListeDemandes } from './views/consultant/liste.js';
import { vueCreationDemande } from './views/consultant/creation.js';
import { vueVue360 } from './views/consultant/vue-360.js';
import { vueEntretien } from './views/consultant/entretien.js';
import { vueEditeurNote } from './views/consultant/editeur-note.js';

async function garantirProfil() {
  if (getProfil()) return getProfil();
  const session = await obtenirSession();
  if (!session) return null;
  const profil = await obtenirProfil();
  setProfil(profil);
  return profil;
}

async function garantirStaff() {
  const profil = await garantirProfil();
  if (!profil || profil.role === 'client') {
    navigate('/connexion');
    return null;
  }
  return profil;
}

route('/connexion', async () => {
  const profil = await garantirProfil();
  if (profil) {
    navigate(profil.role === 'client' ? '/mes-demandes' : '/tableau-de-bord');
    return;
  }
  vueConnexion();
});

route('/mes-demandes', async () => {
  const profil = await garantirProfil();
  if (!profil) {
    navigate('/connexion');
    return;
  }
  vueMesDemandes();
});

route('/d/:ref', async ({ ref }) => {
  const profil = await garantirProfil();
  if (!profil) {
    navigate('/connexion');
    return;
  }
  vueAccueilDemande(ref);
});

route('/d/:ref/s/:section', async ({ ref, section }) => {
  const profil = await garantirProfil();
  if (!profil) {
    navigate('/connexion');
    return;
  }
  vueSection(ref, section);
});

route('/d/:ref/recap', async ({ ref }) => {
  const profil = await garantirProfil();
  if (!profil) {
    navigate('/connexion');
    return;
  }
  vueRecap(ref);
});

route('/d/:ref/cadrage', async ({ ref }) => {
  const profil = await garantirProfil();
  if (!profil) {
    navigate('/connexion');
    return;
  }
  vueCadrageClient(ref);
});

route('/glossaire', async () => {
  const profil = await garantirProfil();
  if (!profil) {
    navigate('/connexion');
    return;
  }
  vueGlossaire();
});

route('/tableau-de-bord', async () => {
  if (!(await garantirStaff())) return;
  vueTableauDeBord();
});

route('/demandes/nouvelle', async () => {
  if (!(await garantirStaff())) return;
  vueCreationDemande();
});

route('/demandes/:ref/entretien', async ({ ref }) => {
  if (!(await garantirStaff())) return;
  vueEntretien(ref);
});

route('/demandes/:ref/cadrage', async ({ ref }) => {
  if (!(await garantirStaff())) return;
  vueEditeurNote(ref);
});

route('/demandes/:ref', async ({ ref }) => {
  if (!(await garantirStaff())) return;
  vueVue360(ref);
});

route('/demandes', async () => {
  if (!(await garantirStaff())) return;
  vueListeDemandes();
});

route('/', async () => {
  const profil = await garantirProfil();
  navigate(profil ? (profil.role === 'client' ? '/mes-demandes' : '/tableau-de-bord') : '/connexion');
});

notFound(() => {
  document.getElementById('app').innerHTML = '<main class="conteneur"><h1>Page introuvable</h1></main>';
});

surChangementAuth((evenement, session) => {
  if (evenement === 'SIGNED_IN') {
    // Termine le retour de lien magique : location.hash contient encore
    // access_token/refresh_token, on le remplace par une route propre.
    setProfil(null);
    navigate('/');
  } else if (!session) {
    setProfil(null);
  }
});

if (window.lucide) window.lucide.createIcons();

startRouter();
