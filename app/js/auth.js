// Authentification par e-mail + mot de passe - 01_ARCHITECTURE.md section 8.1.
// Les comptes sont ceux du noyau de l'ERP (invitations) ; aucune inscription libre.
// Le profil et le rôle viennent de crm_rpc_mon_profil (identité app_personnes, droits app_droits).

import { supabase } from './supabase.js';
import { lireOrganisation, memoriserOrganisation } from './organisation.js';
import { choisirLigneProfil } from './engine/personnes.js';

export async function connecter(email, motDePasse) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) throw error;
}

export async function demanderReinitialisationMotDePasse(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}

// Changement volontaire et flux "mot de passe oublié" (après clic sur le lien reçu).
// Plus de mot de passe temporaire : le changement n'est plus imposé à la première connexion.
export async function definirNouveauMotDePasse(motDePasse) {
  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) throw error;
}

export async function deconnecter() {
  memoriserOrganisation(null);
  await supabase.auth.signOut();
}

export async function obtenirSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// user_id est l'identifiant de PERSONNE (app_personnes), pas celui du compte d'authentification : c'est lui que
// portent les colonnes responsable_id, consultant_id, assignee_id, auteur...
export async function obtenirProfil() {
  const session = await obtenirSession();
  if (!session) return null;

  const { data, error } = await supabase.rpc('crm_rpc_mon_profil');
  if (error) throw error;

  const ligne = choisirLigneProfil(data, lireOrganisation());
  if (!ligne) {
    // Organisation mémorisée d'un autre compte ou devenue inaccessible : on l'oublie et on réessaie une fois.
    if (lireOrganisation()) {
      memoriserOrganisation(null);
      return obtenirProfil();
    }
    return null;
  }
  memoriserOrganisation(ligne.organisation_id);
  return {
    user_id: ligne.user_id,
    role: ligne.role,
    nom: ligne.nom,
    email: ligne.email,
    organisation_id: ligne.organisation_id,
    organisation_nom: ligne.organisation_nom,
    organisations: data.map((l) => ({ id: l.organisation_id, nom: l.organisation_nom, role: l.role })),
    doit_changer_mot_de_passe: false,
  };
}

export function surChangementAuth(callback) {
  supabase.auth.onAuthStateChange((evenement, session) => callback(evenement, session));
}
