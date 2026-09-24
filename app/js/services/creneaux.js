import { supabase } from '../supabase.js';

export async function listerCreneaux(demandeId) {
  const { data, error } = await supabase
    .from('entretien_creneaux')
    .select('*')
    .eq('demande_id', demandeId)
    .order('debut');
  if (error) throw error;
  return data;
}

export async function proposerCreneau(demandeId, { debut, fin }) {
  const { error } = await supabase.from('entretien_creneaux').insert({ demande_id: demandeId, debut, fin });
  if (error) throw error;
}

export async function retirerCreneau(creneauId) {
  const { error } = await supabase.from('entretien_creneaux').delete().eq('id', creneauId);
  if (error) throw error;
}

// Confirme le rendez-vous et fait passer la demande à entretien_planifie -
// action réservée au client (RLS bloque son écriture directe sur
// entretien_creneaux, cf. rpc_choisir_creneau security definer).
export async function choisirCreneau(creneauId) {
  const { error } = await supabase.rpc('rpc_choisir_creneau', { p_creneau_id: creneauId });
  if (error) throw error;
}
