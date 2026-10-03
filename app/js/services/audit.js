// Lecture du journal d'audit (CRM, lot F). Réservé à l'admin : la base ne
// renvoie rien aux autres comptes. Le journal ne se modifie pas depuis
// l'application (ajout seul, par déclencheur).
import { supabase } from '../supabase.js';

export const TAILLE_PAGE_JOURNAL = 50;

// Les plus récentes d'abord. Filtres : table, fiche client, compte à l'origine,
// date de début (ISO), texte dans le nom de la ligne. `avantId` : suite de la
// liste (les entrées plus anciennes que celle-ci).
export async function listerJournal({ table, clientId, userId, depuis, recherche, avantId, limite = TAILLE_PAGE_JOURNAL } = {}) {
  let requete = supabase.from('audit_log').select('*').order('id', { ascending: false }).limit(limite);
  if (table) requete = requete.eq('table_name', table);
  if (clientId) requete = requete.eq('client_id', clientId);
  if (userId) requete = requete.eq('user_id', userId);
  if (depuis) requete = requete.gte('created_at', depuis);
  if (recherche?.trim()) requete = requete.ilike('libelle', `%${recherche.trim()}%`);
  if (avantId) requete = requete.lt('id', avantId);
  const { data, error } = await requete;
  if (error) throw error;
  return data;
}
