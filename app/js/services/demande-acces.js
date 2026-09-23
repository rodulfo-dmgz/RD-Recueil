import { supabase } from '../supabase.js';

export async function obtenirAcces(demandeId) {
  const { data, error } = await supabase
    .from('demande_acces')
    .select('*')
    .eq('demande_id', demandeId)
    .order('invite_le');
  if (error) throw error;
  return data;
}
