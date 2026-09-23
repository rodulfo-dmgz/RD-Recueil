import { supabase } from '../supabase.js';

export async function obtenirDemandeParReference(reference) {
  const { data, error } = await supabase.from('demandes').select('*').eq('reference', reference).maybeSingle();
  if (error) throw error;
  return data;
}

export async function soumettre(demandeId) {
  const { error } = await supabase.rpc('rpc_soumettre', { p_demande_id: demandeId });
  if (error) throw error;
}
