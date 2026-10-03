// Avis de satisfaction (CRM, lot F, Qualiopi indicateur 30). Fonctions pures.
//
// Un avis par demande et par moment ("à chaud", "à froid") : demandé par le
// consultant, puis reçu (note de 1 à 5 et commentaire, du client ou saisi par le
// personnel) ou marqué sans réponse.

import { estVide } from './fiche-client.js';

export const MOMENTS_SATISFACTION = [
  { valeur: 'chaud', libelle: 'À chaud', detail: 'à la fin de la prestation' },
  { valeur: 'froid', libelle: 'À froid', detail: 'quelques mois après' },
];

export const STATUTS_SATISFACTION = [
  { valeur: 'demandee', libelle: 'En attente de réponse' },
  { valeur: 'recue', libelle: 'Reçu' },
  { valeur: 'sans_reponse', libelle: 'Sans réponse' },
];

export function libelleMoment(valeur) {
  return MOMENTS_SATISFACTION.find((m) => m.valeur === valeur)?.libelle ?? valeur;
}

export function libelleStatutSatisfaction(valeur) {
  return STATUTS_SATISFACTION.find((s) => s.valeur === valeur)?.libelle ?? valeur;
}

// 4 -> "★★★★☆".
export function etoiles(note) {
  const n = Math.max(0, Math.min(5, Math.round(Number(note) || 0)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// Note saisie ("4", 4) -> entier de 1 à 5, sinon null.
export function lireNote(valeur) {
  const n = Number(valeur);
  return Number.isInteger(n) && n >= 1 && n <= 5 && !estVide(valeur) ? n : null;
}

// Réponse (formulaire) -> erreurs par champ.
export function validerReponse(valeurs) {
  const erreurs = {};
  if (lireNote(valeurs.note) === null) erreurs.note = 'Choisissez une note de 1 à 5.';
  return erreurs;
}

// Réponse (formulaire) -> champs à enregistrer.
export function preparerReponse(valeurs) {
  return { note: lireNote(valeurs.note), commentaire: estVide(valeurs.commentaire) ? null : String(valeurs.commentaire).trim() };
}

// Les avis d'une demande, par moment : { chaud: avis | null, froid: avis | null }.
export function avisParMoment(avis = []) {
  return Object.fromEntries(MOMENTS_SATISFACTION.map((m) => [m.valeur, avis.find((a) => a.moment === m.valeur) ?? null]));
}

const arrondi1 = (v) => Math.round(v * 10) / 10;

function moyenne(recus) {
  return recus.length === 0 ? null : arrondi1(recus.reduce((s, a) => s + Number(a.note), 0) / recus.length);
}

// Indicateurs : total demandés, reçus, en attente, sans réponse, moyenne des notes
// reçues, taux de réponse (reçus / demandés, null sans avis demandé) et le détail
// par moment.
export function kpisSatisfaction(avis = []) {
  const recus = avis.filter((a) => a.statut === 'recue');
  const detail = (moment) => {
    const duMoment = avis.filter((a) => a.moment === moment);
    const recusMoment = duMoment.filter((a) => a.statut === 'recue');
    return { total: duMoment.length, recus: recusMoment.length, moyenne: moyenne(recusMoment) };
  };
  return {
    total: avis.length,
    recus: recus.length,
    enAttente: avis.filter((a) => a.statut === 'demandee').length,
    sansReponse: avis.filter((a) => a.statut === 'sans_reponse').length,
    moyenne: moyenne(recus),
    tauxReponse: avis.length === 0 ? null : recus.length / avis.length,
    parMoment: { chaud: detail('chaud'), froid: detail('froid') },
  };
}

// Colonnes de l'export CSV des avis (Qualiopi, indicateur 30). `avis` : lignes de
// `satisfactions` avec les jointures `demandes(reference)` et `clients(raison_sociale)`.
const dateCsv = (cle) => (cle ? `${cle.slice(8, 10)}/${cle.slice(5, 7)}/${cle.slice(0, 4)}` : '');
export const COLONNES_CSV_AVIS = [
  { libelle: 'Demande', valeur: (a) => a.demandes?.reference ?? '' },
  { libelle: 'Client', valeur: (a) => a.clients?.raison_sociale ?? '' },
  { libelle: 'Moment', valeur: (a) => libelleMoment(a.moment) },
  { libelle: 'Statut', valeur: (a) => libelleStatutSatisfaction(a.statut) },
  { libelle: 'Date d’envoi', valeur: (a) => dateCsv(a.date_envoi) },
  { libelle: 'Date de réponse', valeur: (a) => dateCsv(a.date_reponse) },
  { libelle: 'Note (sur 5)', valeur: (a) => (a.note ?? '') },
  { libelle: 'Commentaire', valeur: (a) => a.commentaire ?? '' },
  { libelle: 'Réponse saisie par', valeur: (a) => (a.origine === 'client' ? 'Le client' : a.origine === 'staff' ? 'L’équipe' : '') },
];
