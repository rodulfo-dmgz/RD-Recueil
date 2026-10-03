// Données de la recherche globale (CRM, lot E). Les listes sont chargées par pages
// (la base renvoie au plus 1 000 lignes par requête) puis gardées une minute en
// mémoire : la recherche elle-même se fait dans le navigateur (engine/recherche.js).
// La base ne renvoie que ce que l'utilisateur a le droit de voir.
import { supabase } from '../supabase.js';

const TAILLE_PAGE = 1000;
const DUREE_CACHE_MS = 60 * 1000;

let cache = null; // { cle, depuis, promesse }

// `requete()` construit une nouvelle requête triée de façon stable (par id) à
// chaque appel ; les pages se suivent jusqu'à la dernière, incomplète.
async function toutCharger(requete) {
  const lignes = [];
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const { data, error } = await requete().range(debut, debut + TAILLE_PAGE - 1);
    if (error) throw error;
    lignes.push(...data);
    if (data.length < TAILLE_PAGE) return lignes;
  }
}

async function charger({ avecFactures }) {
  const [clients, contacts, demandes, factures] = await Promise.all([
    toutCharger(() => supabase.from('v_clients').select('id, raison_sociale, nom_commercial, ville, siret, email_general, telephone').order('id')),
    toutCharger(() => supabase.from('contacts').select('id, client_id, prenom, nom, email, telephone').order('id')),
    toutCharger(() => supabase.from('demandes').select('id, reference, clients(raison_sociale)').order('id')),
    avecFactures ? toutCharger(() => supabase.from('factures').select('id, demande_id, numero').order('id')) : Promise.resolve([]),
  ]);
  return { clients, contacts, demandes, factures };
}

// avecFactures : l'admin seulement (la base refuse les factures aux autres).
export function chargerDonneesRecherche({ avecFactures = false } = {}) {
  const cle = avecFactures ? 'admin' : 'staff';
  if (cache && cache.cle === cle && Date.now() - cache.depuis < DUREE_CACHE_MS) return cache.promesse;
  const promesse = charger({ avecFactures });
  cache = { cle, depuis: Date.now(), promesse };
  // Un échec ne reste pas en mémoire : la saisie suivante réessaie.
  promesse.catch(() => {
    if (cache?.promesse === promesse) cache = null;
  });
  return promesse;
}

// À appeler après une création, une modification ou une fusion de fiche.
export function invaliderRecherche() {
  cache = null;
}
