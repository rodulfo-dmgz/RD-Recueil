// Authentification par lien magique (OTP e-mail) - aucun mot de passe.
// 01_ARCHITECTURE.md section 8.1.

import { supabase } from './supabase.js';

export async function envoyerLienMagique(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
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
    .select('user_id, role, nom, email')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function surChangementAuth(callback) {
  supabase.auth.onAuthStateChange((_evenement, session) => callback(session));
}
