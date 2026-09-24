import { supabase } from '../supabase.js';
import { SUPABASE_URL } from '../config.js';

const RNCP_RE = /^RNCP\d{3,5}$/i;

export function estCodeRncp(valeur) {
  return RNCP_RE.test((valeur || '').trim());
}

// Vérifie un code RNCP auprès de France Compétences via l'Edge Function
// rncp-lookup (la clé API n'existe que côté serveur, cf. CLAUDE.md).
export async function verifierCodeRncp(code) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié.');

  const reponse = await fetch(
    `${SUPABASE_URL}/functions/v1/rncp-lookup?rncp=${encodeURIComponent(code.trim().toUpperCase())}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );

  const resultat = await reponse.json();
  if (!reponse.ok) {
    throw new Error(resultat.erreur || 'Échec de la vérification du code RNCP.');
  }
  return resultat; // { trouve, rncp?, intitule?, actif? }
}
