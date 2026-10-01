import { supabase } from '../supabase.js';
import { appelerEdgeFunction } from './edge-functions.js';

export async function listerNotifications(limite = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data;
}

export async function compterNonLues() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('lu', false);
  if (error) throw error;
  return count || 0;
}

export async function marquerLue(id) {
  const { error } = await supabase.from('notifications').update({ lu: true }).eq('id', id);
  if (error) throw error;
}

export async function marquerToutesLues() {
  const { error } = await supabase.from('notifications').update({ lu: true }).eq('lu', false);
  if (error) throw error;
}

// Envoi de l'e-mail associé à une étape franchie, à part de la notification
// interne (déjà créée par le trigger fn_notifier_evenement sur evenements) :
// un incident du fournisseur d'e-mail ne doit jamais faire échouer l'action
// elle-même (validation, envoi...), d'où l'appel non bloquant et sans
// remontée d'erreur à l'appelant - CLAUDE.md / 01_ARCHITECTURE.md notent
// déjà la fiabilité des e-mails transactionnels comme point de friction.
export function envoyerEmailEtape(reference, vers) {
  appelerEdgeFunction('envoyer-notification-email', { method: 'POST', body: { reference, vers } }).catch(() => {});
}
