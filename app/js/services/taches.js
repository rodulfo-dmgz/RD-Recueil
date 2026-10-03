// Tâches d'un client (CRM, lot B). La base filtre selon le rôle : un
// consultant ne reçoit que les tâches qui lui sont assignées, l'admin voit
// tout et peut désigner le responsable (politiques de 0034).
import { supabase } from '../supabase.js';
import { STATUTS_OUVERTS, STATUTS_TACHE, nomFichierSur } from '../engine/taches.js';
import { validerFichierDepot } from '../engine/validation.js';

const SELECTION =
  '*, clients(raison_sociale), contacts(prenom, nom), demandes(reference), assignee:profils!assignee_id(nom, email), membres:tache_membres(user_id, profil:profils(nom, email)), pieces:tache_pieces_jointes(id, nom, chemin, taille)';

async function idUtilisateur() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expirée : reconnectez-vous.');
  return session.user.id;
}

// statut : 'ouvertes' par défaut (à faire, en cours, à réviser), un statut précis ou null pour toutes ;
// clientId et assigneeId restreignent la liste ; triées par échéance.
export async function listerTaches({ clientId, assigneeId, statut = 'ouvertes' } = {}) {
  let requete = supabase.from('taches').select(SELECTION).order('echeance', { ascending: true }).order('created_at', { ascending: true });
  if (statut === 'ouvertes') requete = requete.in('statut', STATUTS_OUVERTS);
  else if (statut) requete = requete.eq('statut', statut);
  if (clientId) requete = requete.eq('client_id', clientId);
  if (assigneeId) {
    // Responsable ou membre : on retrouve d'abord les tâches où la personne est membre.
    const { data: lignes, error: erreurMembres } = await supabase.from('tache_membres').select('tache_id').eq('user_id', assigneeId);
    if (erreurMembres) throw erreurMembres;
    const idsMembre = lignes.map((l) => l.tache_id);
    requete = idsMembre.length > 0 ? requete.or(`assignee_id.eq.${assigneeId},id.in.(${idsMembre.join(',')})`) : requete.eq('assignee_id', assigneeId);
  }
  const { data, error } = await requete;
  if (error) throw error;
  return data;
}

// Sans `assignee_id`, la tâche est confiée à l'utilisateur connecté. Un
// consultant ne peut la confier qu'à lui (la base refuse le reste).
export async function creerTache(clientId, champs) {
  const assigneeId = champs.assignee_id || (await idUtilisateur());
  const { data, error } = await supabase
    .from('taches')
    .insert({ ...champs, client_id: clientId, assignee_id: assigneeId })
    .select(SELECTION)
    .single();
  if (error) throw error;
  return data;
}

// Création complète (formulaire « Créer une nouvelle tâche ») : la tâche, puis ses autres membres, puis
// ses pièces jointes. Une tâche créée n'est jamais annulée parce qu'un membre ou un fichier a échoué :
// les échecs sont rendus pour être signalés. membres : identifiants des membres (le responsable
// `champs.assignee_id` est ignoré s'il y figure).
export async function creerTacheComplete({ clientId, champs, membres = [], fichiers = [] }) {
  const tache = await creerTache(clientId, champs);
  const echecs = { membres: [], fichiers: [] };
  const autres = [...new Set(membres)].filter((id) => id && id !== tache.assignee_id);
  if (autres.length > 0) {
    const { error } = await supabase.from('tache_membres').insert(autres.map((user_id) => ({ tache_id: tache.id, user_id })));
    if (error) echecs.membres = autres;
  }
  for (const fichier of fichiers) {
    try {
      await ajouterPieceJointe(tache.id, fichier);
    } catch (err) {
      echecs.fichiers.push(`${fichier.name} (${err.message})`);
    }
  }
  return { tache, echecs };
}

// ─── Membres et pièces jointes ──────────────────────────────────────────────

export async function ajouterMembre(tacheId, userId) {
  const { error } = await supabase.from('tache_membres').insert({ tache_id: tacheId, user_id: userId });
  if (error) throw error;
}

export async function retirerMembre(tacheId, userId) {
  const { error } = await supabase.from('tache_membres').delete().eq('tache_id', tacheId).eq('user_id', userId);
  if (error) throw error;
}

// Chemin : {tache_id}/{horodatage}-{nom sûr} dans le bucket privé 'taches' (le dossier est la clé d'accès, cf. 0054).
export async function ajouterPieceJointe(tacheId, fichier) {
  const erreur = validerFichierDepot({ nom: fichier.name, taille: fichier.size });
  if (erreur) throw new Error(erreur);
  const chemin = `${tacheId}/${Date.now()}-${nomFichierSur(fichier.name)}`;
  const { error: erreurDepot } = await supabase.storage.from('taches').upload(chemin, fichier);
  if (erreurDepot) throw erreurDepot;
  const { data, error } = await supabase.from('tache_pieces_jointes').insert({ tache_id: tacheId, nom: fichier.name, chemin, taille: fichier.size }).select('id, nom, chemin, taille').single();
  if (error) {
    await supabase.storage.from('taches').remove([chemin]);
    throw error;
  }
  return data;
}

export async function supprimerPieceJointe(piece) {
  const { error } = await supabase.from('tache_pieces_jointes').delete().eq('id', piece.id);
  if (error) throw error;
  await supabase.storage.from('taches').remove([piece.chemin]); // le fichier orphelin éventuel est sans conséquence
}

export async function lienPieceJointe(chemin) {
  const { data, error } = await supabase.storage.from('taches').createSignedUrl(chemin, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function modifierTache(id, champs) {
  const { data, error } = await supabase.from('taches').update(champs).eq('id', id).select(SELECTION).single();
  if (error) throw error;
  return data;
}

// Changement de colonne du Kanban (ou du sélecteur de statut d'une ligne).
export function changerStatutTache(id, statut) {
  if (statut !== 'annulee' && !STATUTS_TACHE.some((s) => s.valeur === statut)) throw new Error('Statut de tâche inconnu.');
  return modifierTache(id, { statut });
}

export function terminerTache(id) {
  return modifierTache(id, { statut: 'terminee' });
}

export function rouvrirTache(id) {
  return modifierTache(id, { statut: 'a_faire' });
}

export function annulerTache(id) {
  return modifierTache(id, { statut: 'annulee' });
}

export function reporterTache(id, echeance) {
  return modifierTache(id, { echeance });
}

export async function supprimerTache(id) {
  // Les fichiers joints sont retirés du stockage après la suppression (les lignes partent avec la tâche).
  const { data: pieces } = await supabase.from('tache_pieces_jointes').select('chemin').eq('tache_id', id);
  const { error } = await supabase.from('taches').delete().eq('id', id);
  if (error) throw error;
  if (pieces?.length) await supabase.storage.from('taches').remove(pieces.map((p) => p.chemin));
}
