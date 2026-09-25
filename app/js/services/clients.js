import { supabase } from '../supabase.js';

export async function creerClient({ raisonSociale, siret }) {
  const { data, error } = await supabase
    .from('clients')
    .insert({ raison_sociale: raisonSociale, siret: siret || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listerClients() {
  const { data, error } = await supabase.from('clients').select('id, raison_sociale, siret').order('raison_sociale');
  if (error) throw error;
  return data;
}
