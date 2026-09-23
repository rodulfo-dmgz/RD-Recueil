import { route, notFound, navigate, startRouter } from './router.js';
import { obtenirSession, obtenirProfil, surChangementAuth } from './auth.js';
import { getProfil, setProfil } from './store.js';
import { vueConnexion } from './views/client/connexion.js';
import { vueMesDemandes } from './views/client/mes-demandes.js';
import { vueTableauDeBord } from './views/consultant/tableau-de-bord.js';

async function garantirProfil() {
  if (getProfil()) return getProfil();
  const session = await obtenirSession();
  if (!session) return null;
  const profil = await obtenirProfil();
  setProfil(profil);
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

route('/tableau-de-bord', async () => {
  const profil = await garantirProfil();
  if (!profil || profil.role === 'client') {
    navigate('/connexion');
    return;
  }
  vueTableauDeBord();
});

route('/', async () => {
  const profil = await garantirProfil();
  navigate(profil ? (profil.role === 'client' ? '/mes-demandes' : '/tableau-de-bord') : '/connexion');
});

notFound(() => {
  document.getElementById('app').innerHTML = '<main class="conteneur"><h1>Page introuvable</h1></main>';
});

surChangementAuth((session) => {
  if (!session) setProfil(null);
});

if (window.lucide) window.lucide.createIcons();

startRouter();
