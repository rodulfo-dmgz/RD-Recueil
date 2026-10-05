// Pré-remplissage de « Identification de la structure » (TC-1) à partir de ce que l'on
// sait déjà d'un client : sa fiche et la recherche SIRENE (services/entreprises.js).
// Les valeurs sont celles que le questionnaire enregistre déjà quand le client lance
// lui-même la recherche par SIRET (textes, formes juridiques et effectifs en identifiants,
// adresse en { rue, cp, ville }). Fonctions pures.

// Donnée SIRENE -> question TC-1 (sert aussi à la recherche par SIRET dans le questionnaire).
export const CIBLES_SIRENE = {
  raisonSociale: 'TC-1.01',
  formeJuridique: 'TC-1.02',
  codeNaf: 'TC-1.04',
  secteurActivite: 'TC-1.05',
  adresse: 'TC-1.06',
  effectif: 'TC-1.08',
  conventionCollective: 'TC-1.09',
  estOrganismeFormation: 'TC-1.12',
  nda: 'TC-1.13',
  estQualiopi: 'TC-1.14',
};

const presente = (v) => v !== null && v !== undefined && String(typeof v === 'object' ? JSON.stringify(v) : v).trim() !== '';

// fiche : client ({ raison_sociale, siret, site_web, ... }) ; sirene : résultat de
// rechercherEntreprise ou null. Retour : [{ question_id, valeur }] sans valeur vide, la
// fiche (saisie par le consultant) l'emportant sur la base SIRENE pour la raison sociale
// et le SIRET.
export function reponsesIdentification({ fiche = {}, sirene = null } = {}) {
  const reponses = new Map();
  for (const [cle, questionId] of Object.entries(CIBLES_SIRENE)) {
    if (presente(sirene?.[cle])) reponses.set(questionId, sirene[cle]);
  }
  if (presente(fiche.raison_sociale)) reponses.set('TC-1.01', String(fiche.raison_sociale).trim());
  const siret = fiche.siret || sirene?.siret;
  if (presente(siret)) reponses.set('TC-1.03', String(siret).replace(/\s/g, ''));
  if (presente(fiche.site_web)) reponses.set('TC-1.11', String(fiche.site_web).trim());
  return [...reponses].map(([question_id, valeur]) => ({ question_id, valeur }));
}

// "Marie Dupont" -> { prenom: 'Marie', nom: 'Dupont' } ; un seul mot : nom seul.
export function separerNom(nomComplet) {
  const mots = String(nomComplet ?? '').trim().split(/\s+/).filter(Boolean);
  if (mots.length <= 1) return { prenom: null, nom: mots[0] ?? '' };
  return { prenom: mots[0], nom: mots.slice(1).join(' ') };
}
