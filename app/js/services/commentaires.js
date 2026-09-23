import { supabase } from '../supabase.js';

export async function chargerCommentaires(demandeId) {
  const { data, error } = await supabase
    .from('commentaires')
    .select('*')
    .eq('demande_id', demandeId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function posterCommentaire(demandeId, { cible, texte, interne }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { error } = await supabase.from('commentaires').insert({
    demande_id: demandeId,
    cible: cible || 'general',
    texte,
    interne: Boolean(interne),
    auteur: session?.user?.id,
  });
  if (error) throw error;
}
