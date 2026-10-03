// Financements d'une demande (CRM, lot D). Les droits sont ceux de la base :
// l'admin voit tout, un consultant ceux de ses demandes (peut_voir_demande).
import { supabase } from '../supabase.js';

const COLONNES = 'id, demande_id, type, organisme, reference_dossier, montant, statut, note, created_at';

export async function listerFinancements(demandeId) {
  const { data, error } = await supabase.from('financements').select(COLONNES).eq('demande_id', demandeId).order('created_at');
  if (error) throw error;
  return data;
}

// id nul : création ; sinon modification. `ligne` vient de preparerFinancement.
export async function enregistrerFinancement(demandeId, id, ligne) {
  const requete = id
    ? supabase.from('financements').update(ligne).eq('id', id)
    : supabase.from('financements').insert({ ...ligne, demande_id: demandeId });
  const { data, error } = await requete.select(COLONNES);
  if (error) throw error;
  if (!data?.length) throw new Error('Enregistrement refusé : ce financement n’est pas accessible avec votre compte.');
  return data[0];
}

export async function supprimerFinancement(id) {
  const { data, error } = await supabase.from('financements').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Suppression refusée : ce financement n’est pas accessible avec votre compte.');
}
