// Échanges notés avec un client (CRM, lot B) : appels, e-mails, rendez-vous,
// notes. Lisibles par tout le staff ; seuls l'auteur ou l'admin peuvent
// modifier ou supprimer un échange (politiques de 0035).
import { supabase } from '../supabase.js';

const SELECTION = '*, contacts:crm_contacts(prenom, nom), demandes:crm_demandes(reference), auteur_profil:crm_profils!auteur(nom, email)';

export async function listerActivites(clientId, limite = 100) {
  const { data, error } = await supabase
    .from('crm_activites')
    .select(SELECTION)
    .eq('client_id', clientId)
    .order('date_activite', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data;
}

export async function creerActivite(clientId, champs) {
  const { data, error } = await supabase
    .from('crm_activites')
    .insert({ ...champs, client_id: clientId })
    .select(SELECTION)
    .single();
  if (error) throw error;
  return data;
}

export async function supprimerActivite(id) {
  const { data, error } = await supabase.from('crm_activites').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('Suppression refusée : seul l’auteur ou l’administrateur peut supprimer cet échange.');
}
