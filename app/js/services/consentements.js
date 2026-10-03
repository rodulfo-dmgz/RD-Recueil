// Consentements des contacts (CRM, lot F). Les droits sont ceux de la base : le
// personnel qui voit le client du contact (admin : tout), jamais un client.
import { supabase } from '../supabase.js';
import { cleJour } from '../engine/jalons.js';

const COLONNES = 'id, contact_id, type, statut, date_consentement, source, preuve, date_expiration, date_retrait';

export async function listerConsentements(contactIds) {
  if (!contactIds || contactIds.length === 0) return [];
  const { data, error } = await supabase.from('consentements').select(COLONNES).in('contact_id', contactIds);
  if (error) throw error;
  return data;
}

// Consentements accordés dont la date d'expiration est dépassée (écran "Données à revoir").
export async function listerConsentementsExpires() {
  const { data, error } = await supabase
    .from('consentements')
    .select(COLONNES)
    .eq('statut', 'accorde')
    .lt('date_expiration', cleJour(new Date()))
    .order('date_expiration');
  if (error) throw error;
  return data;
}

// Un seul consentement par contact et par type : créé ou remplacé.
export async function enregistrerConsentement(contactId, type, ligne) {
  const { data, error } = await supabase
    .from('consentements')
    .upsert({ ...ligne, contact_id: contactId, type }, { onConflict: 'contact_id,type' })
    .select(COLONNES)
    .single();
  if (error) throw error;
  return data;
}

// Contacts de tous les clients visibles (écran "Données à revoir", admin).
export async function listerContactsPourRevue() {
  const { data, error } = await supabase.from('contacts').select('id, client_id, prenom, nom, email');
  if (error) throw error;
  return data;
}
