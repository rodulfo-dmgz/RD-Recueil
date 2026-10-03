// Tâches d'un client (CRM, lot B). La base filtre selon le rôle : un
// consultant ne reçoit que les tâches qui lui sont assignées, l'admin voit
// tout et peut désigner le responsable (politiques de 0034).
import { supabase } from '../supabase.js';
import { STATUTS_OUVERTS, STATUTS_TACHE } from '../engine/taches.js';

const SELECTION = '*, clients(raison_sociale), contacts(prenom, nom), demandes(reference), assignee:profils!assignee_id(nom, email)';

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
  if (assigneeId) requete = requete.eq('assignee_id', assigneeId);
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
  const { error } = await supabase.from('taches').delete().eq('id', id);
  if (error) throw error;
}
