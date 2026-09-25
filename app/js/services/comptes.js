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

// Liste des comptes (RLS profils_staff : tout le staff peut lire, la
// suppression reste réservée à l'admin côté Edge Function) - 01_ARCHITECTURE.md
// section 4.2, écran #/admin/utilisateurs.
export async function listerComptes() {
  const { data, error } = await supabase
    .from('profils')
    .select('user_id, email, nom, role, created_at')
    .order('role', { ascending: true })
    .order('email', { ascending: true });
  if (error) throw error;
  return data;
}

// Demandes accessibles par ce compte (via demande_acces), pour afficher au
// consultant/admin exactement ce qui serait supprimé avant confirmation.
export async function listerDemandesDuCompte(userId) {
  const { data, error } = await supabase
    .from('demande_acces')
    .select('demande_id, demandes(reference, clients(raison_sociale))')
    .eq('user_id', userId);
  if (error) throw error;
  return data.filter((a) => a.demandes).map((a) => a.demandes);
}

// Suppression définitive et irréversible d'un compte - admin uniquement,
// nécessite service_role (auth.admin.deleteUser), donc passe par l'Edge
// Function supprimer-utilisateur, jamais par un accès direct au client
// (CLAUDE.md, même logique que creer-compte). Si le compte est client, ses
// demandes (via demande_acces) sont supprimées avec toutes leurs données
// dépendantes (cascade), pas seulement l'accès.
export async function supprimerUtilisateur(userId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié.');

  const reponse = await fetch(`${SUPABASE_URL}/functions/v1/supprimer-utilisateur`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId }),
  });

  const resultat = await reponse.json();
  if (!reponse.ok) {
    throw new Error(resultat.erreur || 'Échec de la suppression du compte.');
  }
  return resultat; // { demandesSupprimees }
}
