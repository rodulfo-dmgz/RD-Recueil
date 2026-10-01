import { supabase } from '../supabase.js';
import { SUPABASE_URL } from '../config.js';

// Centralise l'appel aux Edge Functions : s'assure que le jeton de session
// est à jour avant chaque appel. getSession() seul peut renvoyer un jeton
// déjà expiré si l'onglet est resté inactif longtemps (le rafraîchissement
// automatique en arrière-plan n'a pas eu l'occasion de se déclencher), ce
// qui provoquait des échecs "Non authentifié" côté Edge Function alors que
// l'utilisateur restait bien connecté dans l'interface.
async function obtenirJetonValide() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié.');

  const expireBientot = session.expires_at && session.expires_at * 1000 < Date.now() + 30000;
  if (!expireBientot) return session.access_token;

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) throw new Error('Session expirée, reconnectez-vous.');
  return data.session.access_token;
}

export async function appelerEdgeFunction(nom, { method = 'GET', params, body, messageErreur } = {}) {
  const jeton = await obtenirJetonValide();

  const url = new URL(`${SUPABASE_URL}/functions/v1/${nom}`);
  if (params) {
    for (const [cle, valeur] of Object.entries(params)) {
      if (valeur != null) url.searchParams.set(cle, valeur);
    }
  }

  const reponse = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const resultat = await reponse.json();
  if (!reponse.ok) {
    throw new Error(resultat.erreur || messageErreur || 'Échec de l’appel au serveur.');
  }
  return resultat;
}
