// Montants, probabilités et pipeline en euros (CRM, lot C). La vue
// v_demandes_montants et les tables d'enjeux ne répondent qu'au staff (RLS).
import { supabase } from '../supabase.js';

// Montants des demandes (HT) : montant retenu, source, probabilité, pondéré,
// date de décision. clientId ou demandeId restreignent la liste.
export async function listerMontants({ clientId, demandeId } = {}) {
  let requete = supabase.from('v_demandes_montants').select('*').order('created_at', { ascending: false });
  if (clientId) requete = requete.eq('client_id', clientId);
  if (demandeId) requete = requete.eq('demande_id', demandeId);
  const { data, error } = await requete;
  if (error) throw error;
  return data;
}

export async function obtenirMontantDemande(demandeId) {
  return (await listerMontants({ demandeId }))[0] ?? null;
}

// Estimation et probabilité propres à la demande ; null pour revenir à la
// valeur du statut (ou à l'absence d'estimation).
export async function enregistrerEnjeu(demandeId, { montant_estime, probabilite }) {
  const { error } = await supabase.from('demande_enjeux').upsert({ demande_id: demandeId, montant_estime, probabilite }, { onConflict: 'demande_id' });
  if (error) throw error;
}

// Estimation et probabilité saisies pour la demande (null si rien n'est saisi).
export async function obtenirEnjeu(demandeId) {
  const { data, error } = await supabase.from('demande_enjeux').select('montant_estime, probabilite').eq('demande_id', demandeId).maybeSingle();
  if (error) throw error;
  return data;
}

// Probabilité par défaut de chaque statut (lecture : staff ; modification : admin).
export async function listerProbabilitesStatut() {
  const { data, error } = await supabase.from('probabilites_statut').select('statut, pourcentage').order('pourcentage');
  if (error) throw error;
  return data;
}

export async function modifierProbabiliteStatut(statut, pourcentage) {
  const { data, error } = await supabase.from('probabilites_statut').update({ pourcentage }).eq('statut', statut).select('statut');
  if (error) throw error;
  if (data.length === 0) throw new Error('Modification refusée : réservée à l’administrateur.');
}
