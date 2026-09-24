import { route, notFound, navigate, startRouter } from './router.js';
import { obtenirSession, obtenirProfil, surChangementAuth } from './auth.js';
import { getProfil, setProfil } from './store.js';
import { rendreEntete, viderEntete } from './components/entete.js';
import { vueConnexion } from './views/client/connexion.js';
import { vueChangerMotDePasse } from './views/client/changer-mot-de-passe.js';
import { vueMesDemandes } from './views/client/mes-demandes.js';
import { vueAccueilDemande } from './views/client/accueil.js';
import { vueSection } from './views/client/section.js';
import { vueRecap } from './views/client/recap.js';
import { vueGlossaire } from './views/client/glossaire.js';
import { vueCadrageClient } from './views/client/cadrage.js';
import { vuePropositionClient } from './views/client/proposition.js';
import { vueTableauDeBord } from './views/consultant/tableau-de-bord.js';
import { vueListeDemandes } from './views/consultant/liste.js';
import { vueCreationDemande } from './views/consultant/creation.js';
import { vueVue360 } from './views/consultant/vue-360.js';
import { vueEntretien } from './views/consultant/entretien.js';
import { vueEditeurNote } from './views/consultant/editeur-note.js';
import { vueEditeurProposition } from './views/consultant/editeur-proposition.js';
import { vuePreuves } from './views/consultant/preuves.js';
import { vueCreationCompte } from './views/consultant/creation-compte.js';

async function garantirProfil() {
  if (getProfil()) return getProfil();
  const session = await obtenirSession();
  if (!session) return null;
  const profil = await obtenirProfil();
  setProfil(profil);
  return profil;
}

// À utiliser par toutes les routes protégées (sauf /connexion et
// /changer-mot-de-passe elles-mêmes) : redirige vers le changement de mot de
// passe obligatoire avant d'accéder au reste de l'application.
async function garantirProfilActif() {
  const profil = await garantirProfil();
  if (!profil) {
    viderEntete();
    navigate('/connexion');
    return null;
  }
  if (profil.doit_changer_mot_de_passe) {
    viderEntete();
    navigate('/changer-mot-de-passe');
    return null;
  }
  rendreEntete(profil);
  return profil;
}

async function garantirStaff() {
  const profil = await garantirProfilActif();
  if (!profil || profil.role === 'client') {
    navigate('/connexion');
    return null;
  }
  return profil;
}

route('/connexion', async () => {
  const profil = await garantirProfil();
  if (profil) {
    navigate(profil.doit_changer_mot_de_passe ? '/changer-mot-de-passe' : '/');
    return;
  }
  viderEntete();
  vueConnexion();
});

route('/changer-mot-de-passe', async () => {
  const profil = await garantirProfil();
  if (!profil) {
    navigate('/connexion');
    return;
  }
  viderEntete();
  vueChangerMotDePasse({ oblige: profil.doit_changer_mot_de_passe });
});

route('/mes-demandes', async () => {
  if (!(await garantirProfilActif())) return;
  vueMesDemandes();
});

route('/d/:ref', async ({ ref }) => {
  if (!(await garantirProfilActif())) return;
  vueAccueilDemande(ref);
});

route('/d/:ref/s/:section', async ({ ref, section }) => {
  if (!(await garantirProfilActif())) return;
  vueSection(ref, section);
});

route('/d/:ref/recap', async ({ ref }) => {
  if (!(await garantirProfilActif())) return;
  vueRecap(ref);
});

route('/d/:ref/cadrage', async ({ ref }) => {
  if (!(await garantirProfilActif())) return;
  vueCadrageClient(ref);
});

route('/d/:ref/proposition', async ({ ref }) => {
  if (!(await garantirProfilActif())) return;
  vuePropositionClient(ref);
});

route('/glossaire', async () => {
  if (!(await garantirProfilActif())) return;
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

route('/demandes/:ref/proposition', async ({ ref }) => {
  if (!(await garantirStaff())) return;
  vueEditeurProposition(ref);
});

route('/demandes/:ref/preuves', async ({ ref }) => {
  if (!(await garantirStaff())) return;
  vuePreuves(ref);
});

route('/demandes/:ref', async ({ ref }) => {
  if (!(await garantirStaff())) return;
  vueVue360(ref);
});

route('/demandes', async () => {
  if (!(await garantirStaff())) return;
  vueListeDemandes();
});

route('/comptes/nouveau', async () => {
  const profil = await garantirStaff();
  if (!profil) return;
  if (profil.role !== 'admin') {
    navigate('/tableau-de-bord');
    return;
  }
  vueCreationCompte();
});

route('/', async () => {
  const profil = await garantirProfil();
  if (!profil) {
    navigate('/connexion');
    return;
  }
  if (profil.doit_changer_mot_de_passe) {
    navigate('/changer-mot-de-passe');
    return;
  }
  navigate(profil.role === 'client' ? '/mes-demandes' : '/tableau-de-bord');
});

notFound(() => {
  document.getElementById('app').innerHTML = '<main class="conteneur"><h1>Page introuvable</h1></main>';
});

// Ne pas naviguer sur SIGNED_IN ici : Supabase émet SIGNED_IN et
// PASSWORD_RECOVERY presque simultanément pour un lien "mot de passe
// oublié", et les deux navigations entreraient en course. La redirection
// après une connexion classique est gérée par connexion.js lui-même ;
// PASSWORD_RECOVERY reste le seul événement qui déclenche une navigation ici.
surChangementAuth((evenement, session) => {
  if (evenement === 'PASSWORD_RECOVERY') {
    // Lien "mot de passe oublié" cliqué : location.hash contient encore le
    // jeton de récupération, on le remplace par une route propre.
    setProfil(null);
    navigate('/changer-mot-de-passe');
  } else if (!session) {
    setProfil(null);
  }
});

startRouter();
