import { supabase } from '../supabase.js';
import { identifiantsDistincts, indexerPersonnes } from '../engine/personnes.js';

// Noms des personnes données (personnel seulement, dans l'organisation courante) : Map id -> { nom, email }.
export async function chargerPersonnes(identifiants) {
  const ids = identifiantsDistincts(identifiants);
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.rpc('crm_rpc_personnes', { p_ids: ids });
  if (error) throw error;
  return indexerPersonnes(data);
}
