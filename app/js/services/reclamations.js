// Réclamations (CRM, lot F). Les droits sont ceux de la base : le personnel qui
// voit le client (un consultant ne voit que celles de ses clients), jamais un client.
import { supabase } from '../supabase.js';

const SELECTION = '*, clients(raison_sociale), demandes(reference)';

// clientId : limite la liste à une fiche. Les plus récentes d'abord.
export async function listerReclamations({ clientId } = {}) {
  let requete = supabase.from('reclamations').select(SELECTION).order('date_reception', { ascending: false }).order('created_at', { ascending: false });
  if (clientId) requete = requete.eq('client_id', clientId);
  const { data, error } = await requete;
  if (error) throw error;
  return data;
}

// Demandes d'un client, pour rattacher une réclamation à l'une d'elles.
export async function listerDemandesDuClient(clientId) {
  const { data, error } = await supabase.from('demandes').select('id, reference').eq('client_id', clientId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// id nul : création ; sinon modification. `ligne` vient de preparerReclamation.
export async function enregistrerReclamation(clientId, id, ligne) {
  const requete = id
    ? supabase.from('reclamations').update(ligne).eq('id', id)
    : supabase.from('reclamations').insert({ ...ligne, client_id: clientId });
  const { data, error } = await requete.select(SELECTION);
  if (error) throw error;
  if (!data?.length) throw new Error('Enregistrement refusé : cette réclamation n’est pas accessible avec votre compte.');
  return data[0];
}

// ─── Côté client ────────────────────────────────────────────────────────────
// Le client n'écrit pas dans la table : il dépose par une fonction qui vérifie son
// accès à la demande, et lit un résumé sans la gravité ni le responsable.

export async function deposerReclamation(demandeId, objet, description, { dateReception, gravite } = {}) {
  const { data, error } = await supabase.rpc('rpc_deposer_reclamation', {
    p_demande_id: demandeId,
    p_objet: objet,
    p_description: description,
    p_date_reception: dateReception,
    p_gravite: gravite,
  });
  if (error) throw error;
  return data;
}

export async function listerMesReclamations() {
  const { data, error } = await supabase.rpc('rpc_mes_reclamations');
  if (error) throw error;
  return data;
}
