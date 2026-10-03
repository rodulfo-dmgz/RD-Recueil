// Vues enregistrées des listes (refonte, phase 6) : filtres, tri et recherche d'une
// liste, propres à chaque utilisateur du personnel (RLS : on ne voit que les siennes).
import { supabase } from '../supabase.js';

export async function listerVues(ecran) {
  const { data, error } = await supabase.from('vues_enregistrees').select('id, nom, filtres, tri, recherche').eq('ecran', ecran).order('nom');
  if (error) throw error;
  return data;
}

export async function creerVue({ ecran, nom, filtres, tri = null, recherche = null }) {
  const { data, error } = await supabase
    .from('vues_enregistrees')
    .insert({ ecran, nom: nom.trim(), filtres, tri, recherche: recherche || null })
    .select('id, nom, filtres, tri, recherche')
    .single();
  if (error) throw error.code === '23505' ? new Error('Une vue porte déjà ce nom.') : error;
  return data;
}

export async function supprimerVue(id) {
  const { error } = await supabase.from('vues_enregistrees').delete().eq('id', id);
  if (error) throw error;
}
