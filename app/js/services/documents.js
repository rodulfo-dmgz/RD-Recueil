import { supabase } from '../supabase.js';

// Documents visibles par le client pour un ensemble de demandes : notes de
// cadrage envoyées (pas les brouillons), propositions envoyées, et pièces
// déposées. La RLS limite déjà chaque requête aux demandes accessibles.
export async function listerDocumentsClient(demandeIds) {
  if (demandeIds.length === 0) return { notes: [], propositions: [], fichiers: [] };

  const [notes, propositions, fichiers] = await Promise.all([
    supabase
      .from('notes_cadrage')
      .select('id, demande_id, version, statut, contenu_md, validee_le, signature_image, signature_credential')
      .in('demande_id', demandeIds)
      .neq('statut', 'brouillon')
      .order('version', { ascending: false }),
    supabase.from('propositions').select('*').in('demande_id', demandeIds).neq('statut', 'brouillon'),
    supabase.from('fichiers').select('id, demande_id, nom, chemin, taille, created_at').in('demande_id', demandeIds),
  ]);
  for (const r of [notes, propositions, fichiers]) if (r.error) throw r.error;
  return { notes: notes.data, propositions: propositions.data, fichiers: fichiers.data };
}

// Lien de téléchargement temporaire (le bucket n'est pas public).
export async function urlTelechargement(chemin) {
  const { data, error } = await supabase.storage.from('demandes').createSignedUrl(chemin, 60);
  if (error) throw error;
  return data.signedUrl;
}
