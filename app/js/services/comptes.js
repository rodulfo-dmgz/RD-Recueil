import { supabase } from '../supabase.js';
import { SUPABASE_URL } from '../config.js';

// Seul point de création de compte (client, consultant, admin) : appelle
// l'Edge Function creer-compte, qui seule détient la clé service_role
// (01_ARCHITECTURE.md section 8.1, CLAUDE.md).
export async function creerCompte({ email, role, nom, demandeId, droit }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié.');

  const reponse = await fetch(`${SUPABASE_URL}/functions/v1/creer-compte`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email, role, nom, demandeId, droit }),
  });

  const resultat = await reponse.json();
  if (!reponse.ok) {
    throw new Error(resultat.erreur || 'Échec de la création du compte.');
  }
  return resultat; // { email, motDePasseTemporaire, userId }
}
