import { supabase } from '../supabase.js';
import { appelerEdgeFunction } from './edge-functions.js';
import { getProfil } from '../store.js';

// Seul point de création de compte (client, consultant, admin) : appelle
// l'Edge Function creer-compte, qui seule détient la clé service_role
// (01_ARCHITECTURE.md section 8.1, CLAUDE.md).
export async function creerCompte({ email, role, nom, demandeId, droit }) {
  return appelerEdgeFunction('creer-compte', {
    method: 'POST',
    body: { email, role, nom, demandeId, droit, organisationId: getProfil()?.organisation_id },
    messageErreur: 'Échec de la création du compte.',
  }); // { email, motDePasseTemporaire, userId }
}

// Liste des comptes (RLS profils_staff : tout le staff peut lire, la
// suppression reste réservée à l'admin côté Edge Function) - 01_ARCHITECTURE.md
// section 4.2, écran #/admin/utilisateurs.
export async function listerComptes() {
  const { data, error } = await supabase.rpc('crm_rpc_comptes');
  if (error) throw error;
  return [...data].sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));
}

// Comptes clients avec leur société et leurs demandes (de la plus récente à
// la plus ancienne) - sélecteur "Aperçu client" de l'en-tête admin.
export async function listerClientsApercu() {
  const [{ data: comptes, error: erreurProfils }, { data: acces, error: erreurAcces }] = await Promise.all([
    supabase.rpc('crm_rpc_comptes'),
    supabase
      .from('crm_demande_acces')
      .select('user_id, demandes:crm_demandes!inner(reference, created_at, archivee, clients:crm_clients(raison_sociale))')
      .eq('demandes.archivee', false)
      .not('user_id', 'is', null),
  ]);
  if (erreurProfils) throw erreurProfils;
  if (erreurAcces) throw erreurAcces;

  return comptes
    .filter((p) => p.role === 'client')
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

// Nom et e-mail d'un compte, pour afficher le client consulté en aperçu.
export async function obtenirProfilClient(userId) {
  const { data, error } = await supabase.rpc('crm_rpc_comptes');
  if (error) throw error;
  return (data ?? []).find((c) => c.user_id === userId) ?? null;
}

// Demandes accessibles par ce compte (via demande_acces), pour afficher au
// consultant/admin exactement ce qui serait supprimé avant confirmation.
export async function listerDemandesDuCompte(userId) {
  const { data, error } = await supabase
    .from('crm_demande_acces')
    .select('demande_id, demandes:crm_demandes(reference, clients:crm_clients(raison_sociale))')
    .eq('user_id', userId);
  if (error) throw error;
  return data.filter((a) => a.demandes).map((a) => a.demandes);
}

// Retrait de l'accès au CRM - admin uniquement. Le compte appartient à la personne et peut servir à d'autres
// modules de l'ERP : on retire ses droits crm_ et ses invitations aux demandes, sans supprimer le compte,
// la personne ni les demandes (documents signés conservés). Nécessite service_role, donc passe par l'Edge
// Function supprimer-utilisateur (CLAUDE.md, même logique que creer-compte).
export async function supprimerUtilisateur(userId) {
  return appelerEdgeFunction('supprimer-utilisateur', {
    method: 'POST',
    body: { userId, organisationId: getProfil()?.organisation_id },
    messageErreur: 'Échec de la suppression du compte.',
  }); // { demandesSupprimees: 0, accesRetires }
}
