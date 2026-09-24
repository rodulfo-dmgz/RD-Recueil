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

// Enregistre le rendez-vous réservé par le client sur le widget Cal.com
// (agenda réel du consultant) et fait passer la demande à
// entretien_planifie - RLS bloque l'écriture directe du client sur
// entretien_creneaux, cf. rpc_confirmer_reservation_calcom security definer.
export async function confirmerReservationCalcom(demandeId, { debut, fin }) {
  const { error } = await supabase.rpc('rpc_confirmer_reservation_calcom', {
    p_demande_id: demandeId,
    p_debut: debut,
    p_fin: fin,
  });
  if (error) throw error;
}
