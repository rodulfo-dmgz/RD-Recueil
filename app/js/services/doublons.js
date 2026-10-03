// Doublons de clients (CRM, lot E) : lecture des données de détection, couples
// ignorés et fusion. Tout est réservé à l'admin (la base refuse les autres).
import { supabase } from '../supabase.js';
import { cleCouple } from '../engine/doublons.js';

export async function listerContactsPourDoublons() {
  const { data, error } = await supabase.from('contacts').select('client_id, email, prenom, nom, principal');
  if (error) throw error;
  return data;
}

export async function listerDoublonsIgnores() {
  const { data, error } = await supabase.from('doublons_ignores').select('client_a, client_b');
  if (error) throw error;
  return data;
}

// Le couple est enregistré dans l'ordre exigé par la table (client_a < client_b).
export async function ignorerCouple(idA, idB) {
  const [client_a, client_b] = cleCouple(idA, idB).split('|');
  const { error } = await supabase.from('doublons_ignores').upsert({ client_a, client_b }, { onConflict: 'client_a,client_b', ignoreDuplicates: true });
  if (error) throw error;
}

export async function retablirCouple(idA, idB) {
  const [client_a, client_b] = cleCouple(idA, idB).split('|');
  const { data, error } = await supabase.from('doublons_ignores').delete().eq('client_a', client_a).eq('client_b', client_b).select('client_a');
  if (error) throw error;
  if (!data?.length) throw new Error('Ce couple n’est plus dans la liste des couples ignorés.');
}

// Nombres d'éléments rattachés à un client : ce que la fusion déplacerait.
export async function compterRattaches(clientId) {
  const compter = async (table) => {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('client_id', clientId);
    if (error) throw error;
    return count ?? 0;
  };
  const [demandes, activites, taches] = await Promise.all([compter('demandes'), compter('activites'), compter('taches')]);
  return { demandes, activites, taches };
}

// Fusionne `absorber` dans `garder` (irréversible : la fiche absorbée est supprimée).
export async function fusionnerClients(garder, absorber) {
  const { data, error } = await supabase.rpc('rpc_fusionner_clients', { p_garder: garder, p_absorber: absorber });
  if (error) throw error;
  return data;
}
