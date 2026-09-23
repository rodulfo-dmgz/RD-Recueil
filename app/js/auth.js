// Authentification par e-mail + mot de passe - 01_ARCHITECTURE.md section 8.1.
// Les comptes sont créés par l'Edge Function creer-compte (mot de passe
// temporaire) ; aucune inscription libre.

import { supabase } from './supabase.js';

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

// Utilisé à la fois pour le changement obligatoire (doit_changer_mot_de_passe)
// et pour le flux "mot de passe oublié" (après clic sur le lien reçu).
export async function definirNouveauMotDePasse(motDePasse) {
  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) throw error;

  const { error: erreurRpc } = await supabase.rpc('rpc_marquer_mot_de_passe_change');
  if (erreurRpc) throw erreurRpc;
}

export async function deconnecter() {
  await supabase.auth.signOut();
}

export async function obtenirSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function obtenirProfil() {
  const session = await obtenirSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profils')
    .select('user_id, role, nom, email, doit_changer_mot_de_passe')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function surChangementAuth(callback) {
  supabase.auth.onAuthStateChange((evenement, session) => callback(evenement, session));
}
