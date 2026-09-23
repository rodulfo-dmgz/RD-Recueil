import { supabase } from '../supabase.js';

export async function chargerJournal(demandeId) {
  const { data, error } = await supabase
    .from('evenements')
    .select('*')
    .eq('demande_id', demandeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
