import { supabase } from '../supabase.js';
import { SUPABASE_URL } from '../config.js';

// Centralise l'appel aux Edge Functions : s'assure que le jeton de session
// est valide avant chaque appel. getSession() seul renvoie le jeton stocké
// localement sans le vérifier - il peut sembler valide selon l'horloge du
// navigateur (expires_at pas encore atteint) tout en étant déjà rejeté par
// le serveur Auth (session invalidée entre-temps, par ex. après une longue
// inactivité ou une rotation du refresh token sur un autre onglet). getUser()
// fait le même aller-retour serveur que l'Edge Function elle-même : si ça
// échoue ici, ça aurait échoué là-bas aussi, donc on rafraîchit avant d'y
// arriver plutôt que de se fier à un calcul de date côté client.
async function obtenirJetonValide() {
  const {
    data: { session: sessionInitiale },
  } = await supabase.auth.getSession();
  if (!sessionInitiale) throw new Error('Non authentifié.');

  const { error: erreurValidation } = await supabase.auth.getUser();
  if (!erreurValidation) {
    // Toujours relire la session après getUser() plutôt que de renvoyer le
    // jeton capturé avant : un rafraîchissement a pu se produire entre
    // temps (minuterie d'auto-refresh de supabase-js, ou en coulisse dans
    // getUser() lui-même), ce qui invaliderait le jeton capturé plus haut.
    const {
      data: { session: sessionActuelle },
    } = await supabase.auth.getSession();
    if (sessionActuelle) return sessionActuelle.access_token;
  }

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
