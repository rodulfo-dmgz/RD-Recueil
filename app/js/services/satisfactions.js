// Avis de satisfaction (CRM, lot F). Droits de la base : le personnel qui voit le
// client lit et écrit ; un client invité lit ses propres avis et y répond par la
// fonction `rpc_repondre_satisfaction` (jamais par écriture directe).
import { supabase } from '../supabase.js';

const SELECTION = '*, demandes(reference), clients(raison_sociale)';

// demandeId : les avis d'une demande ; sinon tous ceux que l'utilisateur voit.
export async function listerSatisfactions({ demandeId } = {}) {
  let requete = supabase.from('satisfactions').select(SELECTION).order('created_at', { ascending: false });
  if (demandeId) requete = requete.eq('demande_id', demandeId);
  const { data, error } = await requete;
  if (error) throw error;
  return data;
}

// Côté client : les avis qu'on lui demande et auxquels il n'a pas encore répondu.
export async function listerAvisAttendus() {
  const { data, error } = await supabase.from('satisfactions').select(SELECTION).eq('statut', 'demandee').order('date_envoi');
  if (error) throw error;
  return data;
}

// Le client est déduit de la demande par la base ; une notification part vers les
// comptes clients invités sur la demande.
export async function demanderAvis(demandeId, moment) {
  const { data, error } = await supabase.from('satisfactions').insert({ demande_id: demandeId, moment }).select(SELECTION).single();
  if (error) {
    if (error.code === '23505') throw new Error('Cet avis a déjà été demandé pour cette demande.');
    throw error;
  }
  return data;
}

// Avis reçu autrement (téléphone, papier) : saisi par le personnel, créé ou remplacé.
export async function enregistrerAvisRecu(demandeId, moment, { note, commentaire }) {
  const { data, error } = await supabase
    .from('satisfactions')
    .upsert({ demande_id: demandeId, moment, statut: 'recue', note, commentaire }, { onConflict: 'demande_id,moment' })
    .select(SELECTION)
    .single();
  if (error) throw error;
  return data;
}

export async function marquerSansReponse(id) {
  const { data, error } = await supabase.from('satisfactions').update({ statut: 'sans_reponse' }).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Modification refusée : cet avis n’est pas accessible avec votre compte.');
}

export async function repondreAvis(id, note, commentaire) {
  const { error } = await supabase.rpc('rpc_repondre_satisfaction', { p_id: id, p_note: note, p_commentaire: commentaire });
  if (error) throw error;
}
