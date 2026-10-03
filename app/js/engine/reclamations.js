// Réclamations (CRM, lot F, Qualiopi indicateur 31). Fonctions pures.
//
// Saisies par le personnel sur une fiche client (et, si besoin, une demande de ce
// client) : gravité, statut, responsable, action corrective obligatoire pour clôturer.

import { normaliserTexte } from './texte.js';
import { estVide } from './fiche-client.js';

export const GRAVITES = [
  { valeur: 'mineure', libelle: 'Mineure' },
  { valeur: 'majeure', libelle: 'Majeure' },
  { valeur: 'critique', libelle: 'Critique' },
];

export const STATUTS_RECLAMATION = [
  { valeur: 'ouverte', libelle: 'Ouverte' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'cloturee', libelle: 'Clôturée' },
];

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_JOUR = 24 * 60 * 60 * 1000;

export function libelleGravite(valeur) {
  return GRAVITES.find((g) => g.valeur === valeur)?.libelle ?? valeur;
}

export function libelleStatutReclamation(valeur) {
  return STATUTS_RECLAMATION.find((s) => s.valeur === valeur)?.libelle ?? valeur;
}

export function estOuverte(reclamation) {
  return reclamation.statut !== 'cloturee';
}

function propre(v) {
  return estVide(v) ? null : String(v).trim();
}

// Jours entiers entre deux dates "aaaa-mm-jj" (sans effet des changements d'heure).
function joursEntre(debut, fin) {
  const [a, m, j] = debut.split('-').map(Number);
  const [a2, m2, j2] = fin.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a, m - 1, j)) / MS_JOUR);
}

// Délai de traitement d'une réclamation clôturée, en jours (null sinon).
export function delaiTraitementJours(reclamation) {
  if (reclamation.statut !== 'cloturee' || !reclamation.date_cloture || !reclamation.date_reception) return null;
  return Math.max(0, joursEntre(reclamation.date_reception, reclamation.date_cloture));
}

// Formulaire -> ligne de `reclamations` (sans client_id).
export function preparerReclamation(valeurs) {
  return {
    demande_id: propre(valeurs.demande_id),
    date_reception: propre(valeurs.date_reception),
    objet: propre(valeurs.objet),
    description: propre(valeurs.description),
    gravite: valeurs.gravite || 'mineure',
    statut: valeurs.statut || 'ouverte',
    responsable_id: propre(valeurs.responsable_id),
    action_corrective: propre(valeurs.action_corrective),
  };
}

export function validerReclamation(valeurs) {
  const erreurs = {};
  if (estVide(valeurs.objet)) erreurs.objet = 'L’objet est obligatoire.';
  const date = propre(valeurs.date_reception);
  if (!date || !FORMAT_DATE.test(date)) erreurs.date_reception = 'Indiquez la date de réception.';
  if (valeurs.gravite && !GRAVITES.some((g) => g.valeur === valeurs.gravite)) erreurs.gravite = 'Gravité inconnue.';
  if (valeurs.statut && !STATUTS_RECLAMATION.some((s) => s.valeur === valeurs.statut)) erreurs.statut = 'Statut inconnu.';
  if (valeurs.statut === 'cloturee' && estVide(valeurs.action_corrective)) erreurs.action_corrective = 'L’action corrective est obligatoire pour clôturer.';
  return erreurs;
}

// Indicateurs : total, ouvertes (ouverte ou en cours), en cours, clôturées,
// critiques non clôturées, délai moyen de traitement des clôturées (jours, null
// sans clôture).
export function kpisReclamations(reclamations = []) {
  const ouvertes = reclamations.filter(estOuverte);
  const delais = reclamations.map(delaiTraitementJours).filter((d) => d !== null);
  return {
    total: reclamations.length,
    ouvertes: ouvertes.length,
    enCours: reclamations.filter((r) => r.statut === 'en_cours').length,
    cloturees: reclamations.length - ouvertes.length,
    critiquesOuvertes: ouvertes.filter((r) => r.gravite === 'critique').length,
    delaiMoyenJours: delais.length > 0 ? Math.round((delais.reduce((s, d) => s + d, 0) / delais.length) * 10) / 10 : null,
  };
}

// Filtre de la liste. statut : '' (toutes), 'ouvertes' (ouverte ou en cours) ou un statut.
export function filtrerReclamations(reclamations = [], { statut = '', gravite = '', recherche = '' } = {}) {
  const terme = normaliserTexte(recherche);
  return reclamations.filter((r) => {
    if (statut === 'ouvertes' ? !estOuverte(r) : statut && r.statut !== statut) return false;
    if (gravite && r.gravite !== gravite) return false;
    if (!terme) return true;
    return [r.objet, r.description, r.clients?.raison_sociale, r.demandes?.reference].map(normaliserTexte).join(' ').includes(terme);
  });
}

// Colonnes de l'export CSV des réclamations (Qualiopi, indicateur 31). `r` : lignes
// de `reclamations` avec les jointures `clients(raison_sociale)` et `demandes(reference)`.
const dateCsv = (cle) => (cle ? `${cle.slice(8, 10)}/${cle.slice(5, 7)}/${cle.slice(0, 4)}` : '');
export const COLONNES_CSV_RECLAMATIONS = [
  { libelle: 'Client', valeur: (r) => r.clients?.raison_sociale ?? '' },
  { libelle: 'Demande', valeur: (r) => r.demandes?.reference ?? '' },
  { libelle: 'Date de réception', valeur: (r) => dateCsv(r.date_reception) },
  { libelle: 'Objet', valeur: (r) => r.objet },
  { libelle: 'Description', valeur: (r) => r.description ?? '' },
  { libelle: 'Gravité', valeur: (r) => libelleGravite(r.gravite) },
  { libelle: 'Statut', valeur: (r) => libelleStatutReclamation(r.statut) },
  { libelle: 'Date de clôture', valeur: (r) => dateCsv(r.date_cloture) },
  { libelle: 'Délai de traitement (jours)', valeur: (r) => delaiTraitementJours(r) ?? '' },
  { libelle: 'Action corrective', valeur: (r) => r.action_corrective ?? '' },
  { libelle: 'Déposée par', valeur: (r) => (r.origine === 'client' ? 'Le client' : 'L’équipe') },
];

// ─── Côté client (dépôt d'une réclamation depuis son espace) ────────────────

export const LONGUEUR_MAX_OBJET = 200;
export const LONGUEUR_MAX_DESCRIPTION = 4000;

// État simple montré au client : le statut interne n'est pas exposé.
const ETATS_CLIENT = { recue: 'Reçue', en_cours: 'En cours de traitement', traitee: 'Traitée' };

export function libelleEtatClient(etat) {
  return ETATS_CLIENT[etat] ?? etat;
}

export function validerDepot(valeurs) {
  const erreurs = {};
  if (estVide(valeurs.demande_id)) erreurs.demande_id = 'Choisissez la demande concernée.';
  if (estVide(valeurs.objet)) erreurs.objet = 'Indiquez l’objet de votre réclamation.';
  else if (String(valeurs.objet).trim().length > LONGUEUR_MAX_OBJET) erreurs.objet = `L’objet ne doit pas dépasser ${LONGUEUR_MAX_OBJET} caractères.`;
  if (String(valeurs.description ?? '').trim().length > LONGUEUR_MAX_DESCRIPTION) erreurs.description = `La description ne doit pas dépasser ${LONGUEUR_MAX_DESCRIPTION} caractères.`;
  return erreurs;
}

export function preparerDepot(valeurs) {
  return { demande_id: String(valeurs.demande_id).trim(), objet: String(valeurs.objet).trim(), description: propre(valeurs.description) };
}
