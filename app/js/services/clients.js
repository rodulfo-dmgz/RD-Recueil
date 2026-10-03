import { supabase } from '../supabase.js';
import { normaliserSiret, QUESTIONS_IMPORT } from '../engine/fiche-client.js';
import { chargerQuestionnaire } from './questionnaire.js';

// Client déjà enregistré avec ce SIRET (espaces ignorés), sinon null.
// ponytail: lecture de tous les SIRET renseignés puis comparaison côté
// navigateur ; à remplacer par une RPC si la base dépasse quelques milliers de clients.
export async function trouverClientParSiret(siret) {
  const chiffres = normaliserSiret(siret);
  if (!chiffres) return null;
  const { data, error } = await supabase.from('clients').select('id, raison_sociale, siret').not('siret', 'is', null);
  if (error) throw error;
  return data.find((c) => normaliserSiret(c.siret) === chiffres) ?? null;
}

// Un consultant ne voit que ses clients : l'index unique du SIRET peut donc
// refuser un client qu'il ne voit pas. Message sans nom (lot Accès).
function erreurSiretSuivi(error) {
  if (error?.code === '23505') return new Error('Ce SIRET est déjà suivi. Contactez l’administrateur.');
  return error;
}

// Réutilise le client existant quand le SIRET est déjà connu (l'index unique
// de la migration 0031 interdit les doublons) ; `dejaExistant` le signale.
export async function creerClient({ raisonSociale, siret }) {
  const existant = await trouverClientParSiret(siret);
  if (existant) return { ...existant, dejaExistant: true };

  const { data, error } = await supabase
    .from('clients')
    .insert({ raison_sociale: raisonSociale, siret: normaliserSiret(siret) || null })
    .select()
    .single();
  if (error) throw erreurSiretSuivi(error);
  return { ...data, dejaExistant: false };
}

export async function listerClients() {
  const { data, error } = await supabase.from('clients').select('id, raison_sociale, siret').order('raison_sociale');
  if (error) throw error;
  return data;
}

// Clients avec leurs compteurs (vue v_clients, réservée au staff).
export async function listerClientsDetail() {
  const { data, error } = await supabase.from('v_clients').select('*').order('raison_sociale');
  if (error) throw error;
  return data;
}

export async function obtenirClient(id) {
  const { data, error } = await supabase.from('v_clients').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// id nul : création ; sinon mise à jour. Un SIRET déjà porté par un autre
// client est refusé avec un message qui le nomme (clientId : son identifiant).
export async function enregistrerClient(id, champs) {
  if (champs.siret) {
    const existant = await trouverClientParSiret(champs.siret);
    if (existant && existant.id !== id) {
      const err = new Error(`Ce SIRET est déjà utilisé par ${existant.raison_sociale}.`);
      err.clientId = existant.id;
      throw err;
    }
  }
  const requete = id ? supabase.from('clients').update(champs).eq('id', id) : supabase.from('clients').insert(champs);
  const { data, error } = await requete.select().single();
  if (error) throw erreurSiretSuivi(error);
  return data;
}

// Réservé à l'admin (politique RLS) ; la base refuse si le client a des demandes.
export async function supprimerClient(id) {
  const { data, error } = await supabase.from('clients').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('Suppression refusée : réservée à l’administrateur.');
}

export async function listerDemandesClient(clientId) {
  const { data, error } = await supabase
    .from('demandes')
    .select('id, reference, statut, date_limite, types, created_at, archivee, questionnaire_id')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Réponses TC-1 et TC-2 de la demande la plus récente qui en contient, avec
// les questions pour lire les libellés ; null si aucune demande n'a répondu.
export async function lireImportDisponible(clientId) {
  const demandes = await listerDemandesClient(clientId);
  if (demandes.length === 0) return null;
  const { data, error } = await supabase
    .from('reponses')
    .select('demande_id, question_id, valeur, nsp')
    .in('demande_id', demandes.map((d) => d.id))
    .in('question_id', QUESTIONS_IMPORT);
  if (error) throw error;
  const demande = demandes.find((d) => data.some((r) => r.demande_id === d.id));
  if (!demande) return null;
  const { questions } = await chargerQuestionnaire(demande.questionnaire_id);
  return { demande, reponses: data.filter((r) => r.demande_id === demande.id), questions };
}

// Consultants et administrateurs, pour choisir un responsable de client.
export async function listerResponsables() {
  const { data, error } = await supabase.from('profils').select('user_id, nom, email, role').in('role', ['admin', 'consultant']).order('email');
  if (error) throw error;
  return data;
}

// ─── Contacts ───────────────────────────────────────────────────────────────

export async function listerContacts(clientId) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('principal', { ascending: false })
    .order('actif', { ascending: false })
    .order('nom');
  if (error) throw error;
  return data;
}

// Un seul contact principal par client : les autres sont d'abord relégués.
async function retirerPrincipal(clientId) {
  const { error } = await supabase.from('contacts').update({ principal: false }).eq('client_id', clientId).eq('principal', true);
  if (error) throw error;
}

function erreurContact(error) {
  if (error.code === '23505') return new Error('Un contact avec cet e-mail existe déjà pour ce client.');
  return error;
}

// id nul : création ; sinon mise à jour.
export async function enregistrerContact(clientId, id, ligne) {
  if (ligne.principal) await retirerPrincipal(clientId);
  const requete = id ? supabase.from('contacts').update(ligne).eq('id', id) : supabase.from('contacts').insert({ ...ligne, client_id: clientId });
  const { data, error } = await requete.select().single();
  if (error) throw erreurContact(error);
  return data;
}

export async function definirContactPrincipal(clientId, id) {
  await retirerPrincipal(clientId);
  const { error } = await supabase.from('contacts').update({ principal: true }).eq('id', id);
  if (error) throw error;
}

export async function supprimerContact(id) {
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) throw error;
}

// Applique le plan de planImportContacts : créations puis enrichissements.
export async function importerContacts(clientId, plan) {
  if (plan.aCreer.length > 0) {
    const lignes = plan.aCreer.map((c) => ({ ...c, client_id: clientId }));
    const { error } = await supabase.from('contacts').insert(lignes);
    if (error) throw erreurContact(error);
  }
  for (const { id, ...champs } of plan.aEnrichir) {
    const { error } = await supabase.from('contacts').update(champs).eq('id', id);
    if (error) throw erreurContact(error);
  }
}

// E-mails (en minuscules) de la liste qui correspondent à un compte client :
// ces contacts peuvent déjà se connecter à RD Recueil.
export async function emailsAvecCompte(emails) {
  const liste = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
  if (liste.length === 0) return new Set();
  const { data, error } = await supabase.from('profils').select('email').eq('role', 'client').in('email', liste);
  if (error) throw error;
  return new Set(data.map((p) => p.email.toLowerCase()));
}
