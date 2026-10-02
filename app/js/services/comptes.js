import { supabase } from '../supabase.js';
import { appelerEdgeFunction } from './edge-functions.js';

// Seul point de création de compte (client, consultant, admin) : appelle
// l'Edge Function creer-compte, qui seule détient la clé service_role
// (01_ARCHITECTURE.md section 8.1, CLAUDE.md).
export async function creerCompte({ email, role, nom, demandeId, droit }) {
  return appelerEdgeFunction('creer-compte', {
    method: 'POST',
    body: { email, role, nom, demandeId, droit },
    messageErreur: 'Échec de la création du compte.',
  }); // { email, motDePasseTemporaire, userId }
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

// Comptes clients avec leur société et leurs demandes (de la plus récente à
// la plus ancienne) - sélecteur "Aperçu client" de l'en-tête admin.
export async function listerClientsApercu() {
  const [{ data: profils, error: erreurProfils }, { data: acces, error: erreurAcces }] = await Promise.all([
    supabase.from('profils').select('user_id, email, nom').eq('role', 'client'),
    supabase
      .from('demande_acces')
      .select('user_id, demandes!inner(reference, created_at, archivee, clients(raison_sociale))')
      .eq('demandes.archivee', false)
      .not('user_id', 'is', null),
  ]);
  if (erreurProfils) throw erreurProfils;
  if (erreurAcces) throw erreurAcces;

  return profils
    .map((p) => {
      const demandes = acces
        .filter((a) => a.user_id === p.user_id && a.demandes)
        .map((a) => a.demandes)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const societes = [...new Set(demandes.map((d) => d.clients?.raison_sociale).filter(Boolean))];
      return { ...p, societes, references: demandes.map((d) => d.reference) };
    })
    .filter((c) => c.references.length > 0)
    .sort((a, b) => (a.nom || a.email).localeCompare(b.nom || b.email));
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
  return appelerEdgeFunction('supprimer-utilisateur', {
    method: 'POST',
    body: { userId },
    messageErreur: 'Échec de la suppression du compte.',
  }); // { demandesSupprimees }
}
