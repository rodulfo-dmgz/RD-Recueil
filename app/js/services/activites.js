// Échanges notés avec un client (CRM, lot B) : appels, e-mails, rendez-vous,
// notes. Lisibles par tout le staff ; seuls l'auteur ou l'admin peuvent
// modifier ou supprimer un échange (politiques de 0035).
import { supabase } from '../supabase.js';
import { rattacherPersonne } from '../engine/personnes.js';
import { chargerPersonnes } from './personnes.js';

const SELECTION = '*, contacts:crm_contacts(prenom, nom), demandes:crm_demandes(reference)';

// L'auteur vient de crm_rpc_personnes (plus de table de profils à joindre) : auteur_profil garde la forme { nom, email }.
async function avecAuteurs(activites) {
  const liste = Array.isArray(activites) ? activites : activites ? [activites] : [];
  rattacherPersonne(liste, 'auteur', 'auteur_profil', await chargerPersonnes(liste.map((a) => a.auteur)));
  return activites;
}

export async function listerActivites(clientId, limite = 100) {
  const { data, error } = await supabase
    .from('crm_activites')
    .select(SELECTION)
    .eq('client_id', clientId)
    .order('date_activite', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return avecAuteurs(data);
}

export async function creerActivite(clientId, champs) {
  const { data, error } = await supabase
    .from('crm_activites')
    .insert({ ...champs, client_id: clientId })
    .select(SELECTION)
    .single();
  if (error) throw error;
  return avecAuteurs(data);
}

export async function supprimerActivite(id) {
  const { data, error } = await supabase.from('crm_activites').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('Suppression refusée : seul l’auteur ou l’administrateur peut supprimer cet échange.');
}
