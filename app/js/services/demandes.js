import { supabase } from '../supabase.js';
import { creerClient } from './clients.js';
import { obtenirVersionPublieeCourante } from './questionnaire.js';
import { posterCommentaire } from './commentaires.js';
import { creerCompte } from './comptes.js';

export async function obtenirDemandeParReference(reference) {
  const { data, error } = await supabase.from('demandes').select('*').eq('reference', reference).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listerDemandes({ statut, type } = {}) {
  let requete = supabase
    .from('demandes')
    .select('id, reference, statut, date_limite, types, created_at, clients(raison_sociale)')
    .order('created_at', { ascending: false });
  if (statut) requete = requete.eq('statut', statut);
  if (type) requete = requete.contains('types', [type]);

  const { data, error } = await requete;
  if (error) throw error;
  return data;
}

export async function creerDemande({ raisonSociale, siret, types, dateLimite, consultantId }) {
  const client = await creerClient({ raisonSociale, siret });
  const questionnaireId = await obtenirVersionPublieeCourante();
  if (!questionnaireId) throw new Error('Aucune version du questionnaire publiée.');

  const { data, error } = await supabase
    .from('demandes')
    .insert({
      client_id: client.id,
      questionnaire_id: questionnaireId,
      types,
      date_limite: dateLimite || null,
      consultant_id: consultantId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Seul point de passage pour changer demandes.statut (01_ARCHITECTURE.md
// section 3.2 et CLAUDE.md) : la RPC vérifie la transition et le rôle.
export async function changerStatut(demandeId, vers, commentaire) {
  const { error } = await supabase.rpc('rpc_changer_statut', {
    p_demande_id: demandeId,
    p_vers: vers,
    p_commentaire: commentaire || null,
  });
  if (error) throw error;
}

export async function soumettre(demandeId) {
  const { error } = await supabase.rpc('rpc_soumettre', { p_demande_id: demandeId });
  if (error) throw error;
}

// Crée l'accès client (demande_acces) et le compte (e-mail + mot de passe
// temporaire via l'Edge Function creer-compte) - fait passer la demande de
// brouillon à envoyee (01_ARCHITECTURE.md section 8.1).
export async function inviterClient(demandeId, email, droit = 'editeur') {
  const resultat = await creerCompte({ email, role: 'client', demandeId, droit });
  await changerStatut(
    demandeId,
    'envoyee',
    resultat.compteExistant ? `Accès donné à ${email} (compte existant)` : `Compte créé pour ${email}`
  );
  return resultat; // { email, motDePasseTemporaire, compteExistant, userId }
}

// Relance manuelle (pas d'automatisation planifiée - RM-05 est marquée V2
// dans 01_ARCHITECTURE.md) : aucun envoi automatique, journalise simplement
// un rappel en commentaire interne. Le consultant recontacte le client par
// le canal de son choix.
export async function relancerClient(demandeId, email) {
  await posterCommentaire(demandeId, { cible: 'general', texte: `Relance à faire auprès de ${email}.`, interne: true });
}

// Demandes envoyee/en_saisie sans réponse depuis plus de 7 jours - tableau
// de bord consultant (01_ARCHITECTURE.md section 4.2).
export async function listerDemandesInactives() {
  const seuil = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: demandes, error } = await supabase
    .from('demandes')
    .select('id, reference, statut, created_at, clients(raison_sociale)')
    .in('statut', ['envoyee', 'en_saisie']);
  if (error) throw error;
  if (demandes.length === 0) return [];

  const ids = demandes.map((d) => d.id);
  const { data: reponses, error: erreurReponses } = await supabase
    .from('reponses')
    .select('demande_id, updated_at')
    .in('demande_id', ids);
  if (erreurReponses) throw erreurReponses;

  const derniereActivite = new Map();
  for (const r of reponses) {
    const actuel = derniereActivite.get(r.demande_id);
    if (!actuel || r.updated_at > actuel) derniereActivite.set(r.demande_id, r.updated_at);
  }

  return demandes.filter((d) => (derniereActivite.get(d.id) || d.created_at) < seuil);
}
