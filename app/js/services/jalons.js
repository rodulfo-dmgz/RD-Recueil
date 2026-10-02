import { supabase } from '../supabase.js';

// Dates importantes des demandes accessibles (migration 0028) : calendrier et
// rapport du client, indicateurs de l'admin.
export async function listerJalons() {
  const { data, error } = await supabase.rpc('rpc_jalons');
  if (error) throw error;
  return data;
}
