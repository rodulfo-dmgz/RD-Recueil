// Références de factures d'une demande (CRM, lot D). Réservé à l'admin : la
// base refuse tout autre compte (RLS). Les factures sont émises dans Shine,
// on n'en garde que la référence.
import { supabase } from '../supabase.js';

const COLONNES = 'id, demande_id, numero, libelle, montant_ht, date_emission, date_paiement, source, created_at';

export async function listerFactures(demandeId) {
  const { data, error } = await supabase
    .from('factures')
    .select(COLONNES)
    .eq('demande_id', demandeId)
    .order('date_emission')
    .order('created_at');
  if (error) throw error;
  return data;
}

// id nul : création ; sinon modification. `ligne` vient de preparerFacture
// (ou ne contient que date_paiement pour marquer une facture payée).
export async function enregistrerFacture(demandeId, id, ligne) {
  const requete = id
    ? supabase.from('factures').update(ligne).eq('id', id)
    : supabase.from('factures').insert({ ...ligne, demande_id: demandeId });
  const { data, error } = await requete.select(COLONNES);
  if (error) {
    if (error.code === '23505') throw new Error('Ce numéro de facture existe déjà.');
    throw error;
  }
  if (!data?.length) throw new Error('Enregistrement refusé : les factures sont réservées à l’administrateur.');
  return data[0];
}

export async function supprimerFacture(id) {
  const { data, error } = await supabase.from('factures').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Suppression refusée : les factures sont réservées à l’administrateur.');
}

// Références déjà saisies, pour comparer avec un fichier d'import (admin).
export async function listerFacturesImport() {
  const { data, error } = await supabase.from('factures').select('id, demande_id, numero, date_paiement');
  if (error) throw error;
  return data;
}

// Applique un import déjà prévisualisé : crée les factures nouvelles (une seule
// requête : tout ou rien) puis ajoute les dates de paiement manquantes. Une date
// de paiement déjà présente n'est jamais remplacée, rien n'est supprimé.
export async function appliquerImportFactures({ creations = [], paiements = [] }) {
  if (creations.length > 0) {
    const { error } = await supabase.from('factures').insert(creations);
    if (error) {
      if (error.code === '23505') throw new Error('Un numéro de facture existe déjà : relancez l’aperçu pour partir de l’état actuel.');
      throw error;
    }
  }
  let misesAJour = 0;
  for (const p of paiements) {
    const { data, error } = await supabase.from('factures').update({ date_paiement: p.date_paiement }).eq('id', p.id).is('date_paiement', null).select('id');
    if (error) throw error;
    misesAJour += data.length;
  }
  return { creees: creations.length, misesAJour };
}

// Toutes les factures (admin), pour les indicateurs : seulement les colonnes utiles.
export async function listerToutesFactures() {
  const { data, error } = await supabase.from('factures').select('demande_id, montant_ht, date_emission, date_paiement');
  if (error) throw error;
  return data;
}
