import { supabase } from '../supabase.js';

export async function listerVersions(demandeId) {
  const { data, error } = await supabase
    .from('notes_cadrage')
    .select('*')
    .eq('demande_id', demandeId)
    .order('version', { ascending: false });
  if (error) throw error;
  return data;
}

export async function creerNote(demandeId, contenuMd) {
  const versions = await listerVersions(demandeId);
  const version = (versions[0]?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from('notes_cadrage')
    .insert({ demande_id: demandeId, version, contenu_md: contenuMd, statut: 'brouillon' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function mettreAJourContenu(noteId, contenuMd) {
  const { error } = await supabase.from('notes_cadrage').update({ contenu_md: contenuMd }).eq('id', noteId);
  if (error) throw error;
}

// Envoyée : la note passe à envoyee et la demande à cadrage_envoye
// (01_ARCHITECTURE.md section 10.2) - action réservée au staff (RLS).
export async function envoyerNote(noteId, demandeId) {
  const { error: erreurNote } = await supabase
    .from('notes_cadrage')
    .update({ statut: 'envoyee', envoyee_le: new Date().toISOString() })
    .eq('id', noteId);
  if (erreurNote) throw erreurNote;

  const { error: erreurStatut } = await supabase.rpc('rpc_changer_statut', {
    p_demande_id: demandeId,
    p_vers: 'cadrage_envoye',
    p_commentaire: null,
  });
  if (erreurStatut) throw erreurStatut;
}

export async function validerNote(noteId, signatureImage) {
  const { error } = await supabase.rpc('rpc_valider_cadrage', {
    p_note_id: noteId,
    p_signature_image: signatureImage,
  });
  if (error) throw error;
}

export async function demanderModification(noteId, commentaire) {
  const { error } = await supabase.rpc('rpc_demander_modification', {
    p_note_id: noteId,
    p_commentaire: commentaire,
  });
  if (error) throw error;
}
