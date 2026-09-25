import { supabase } from '../supabase.js';

export async function obtenirProposition(demandeId) {
  const { data, error } = await supabase.from('propositions').select('*').eq('demande_id', demandeId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listerLignes(propositionId) {
  const { data, error } = await supabase
    .from('proposition_lignes')
    .select('*')
    .eq('proposition_id', propositionId)
    .order('ordre');
  if (error) throw error;
  return data;
}

export async function creerProposition(demandeId) {
  const { data, error } = await supabase
    .from('propositions')
    .insert({ demande_id: demandeId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function mettreAJourJustification(propositionId, justificationMd) {
  const { error } = await supabase
    .from('propositions')
    .update({ justification_md: justificationMd })
    .eq('id', propositionId);
  if (error) throw error;
}

// Remplace l'ensemble des lignes du devis (plus simple et sans risque
// d'incohérence d'ordre qu'un diff ligne à ligne pour un devis à quelques
// lignes édité par un seul consultant à la fois).
export async function remplacerLignes(propositionId, lignes) {
  const { error: erreurSuppression } = await supabase
    .from('proposition_lignes')
    .delete()
    .eq('proposition_id', propositionId);
  if (erreurSuppression) throw erreurSuppression;

  if (lignes.length === 0) return;

  const { error: erreurInsertion } = await supabase.from('proposition_lignes').insert(
    lignes.map((ligne, index) => ({
      proposition_id: propositionId,
      ordre: index,
      designation: ligne.designation,
      quantite: ligne.quantite,
      prix_unitaire: ligne.prix_unitaire,
    }))
  );
  if (erreurInsertion) throw erreurInsertion;
}

// Envoyée : la proposition passe à envoyee et la demande à
// proposition_envoyee - action réservée au staff (RLS sur propositions).
export async function envoyerProposition(propositionId, demandeId) {
  const { error: erreurProposition } = await supabase
    .from('propositions')
    .update({ statut: 'envoyee', envoyee_le: new Date().toISOString() })
    .eq('id', propositionId);
  if (erreurProposition) throw erreurProposition;

  const { error: erreurStatut } = await supabase.rpc('rpc_changer_statut', {
    p_demande_id: demandeId,
    p_vers: 'proposition_envoyee',
    p_commentaire: null,
  });
  if (erreurStatut) throw erreurStatut;
}

export async function accepterProposition(propositionId, signatureImage) {
  const { error } = await supabase.rpc('rpc_accepter_proposition', {
    p_proposition_id: propositionId,
    p_signature_image: signatureImage,
  });
  if (error) throw error;
}

export async function refuserProposition(propositionId, commentaire) {
  const { error } = await supabase.rpc('rpc_refuser_proposition', {
    p_proposition_id: propositionId,
    p_commentaire: commentaire,
  });
  if (error) throw error;
}
