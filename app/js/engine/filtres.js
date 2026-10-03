// Filtres avancés des listes (refonte, phase 6) : un filtre est { cle, operateur,
// valeur } ; une définition décrit la colonne : { cle, libelle, type, valeur(ligne),
// choix? }. Les filtres se cumulent (ET). Un filtre incomplet (valeur manquante) est
// ignoré. Fonctions pures.
import { normaliserTexte } from './texte.js';

export const OPERATEURS = {
  texte: ['contient', 'egal', 'renseigne', 'vide'],
  choix: ['est', 'nest_pas'],
  nombre: ['sup', 'inf', 'egal'],
  date: ['apres', 'avant', 'renseigne', 'vide'],
};
export const SANS_VALEUR = new Set(['renseigne', 'vide']);

const LIBELLES = {
  contient: 'contient',
  egal: 'est',
  renseigne: 'est renseigné',
  vide: 'est vide',
  est: 'est',
  nest_pas: 'n’est pas',
  sup: 'au moins',
  inf: 'au plus',
  apres: 'après le',
  avant: 'avant le',
};

export function libelleOperateur(type, operateur) {
  return type === 'nombre' && operateur === 'egal' ? 'égal à' : LIBELLES[operateur] ?? operateur;
}

const vide = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// Opérateur autorisé pour ce type et valeur présente quand l'opérateur en demande une.
export function filtreActif(filtre, definition) {
  if (!filtre || !definition || !OPERATEURS[definition.type]?.includes(filtre.operateur)) return false;
  return SANS_VALEUR.has(filtre.operateur) || !vide(filtre.valeur);
}

function correspond(definition, operateur, valeur, brut) {
  switch (definition.type) {
    case 'texte': {
      const v = normaliserTexte(brut);
      if (operateur === 'renseigne') return v !== '';
      if (operateur === 'vide') return v === '';
      return operateur === 'contient' ? v.includes(normaliserTexte(valeur)) : v === normaliserTexte(valeur);
    }
    case 'choix': {
      const valeurs = Array.isArray(brut) ? brut : [brut];
      return operateur === 'est' ? valeurs.includes(valeur) : !valeurs.includes(valeur);
    }
    case 'nombre': {
      if (vide(brut) || Number.isNaN(Number(brut))) return false;
      const cible = Number(String(valeur).replace(',', '.'));
      if (Number.isNaN(cible)) return true; // valeur illisible : filtre ignoré
      return operateur === 'sup' ? Number(brut) >= cible : operateur === 'inf' ? Number(brut) <= cible : Number(brut) === cible;
    }
    case 'date': {
      const jour = vide(brut) ? '' : String(brut).slice(0, 10);
      if (operateur === 'renseigne') return jour !== '';
      if (operateur === 'vide') return jour === '';
      if (jour === '') return false;
      return operateur === 'apres' ? jour > valeur : jour < valeur;
    }
    default:
      return true;
  }
}

export function appliquerFiltres(lignes, filtres = [], definitions = []) {
  const parCle = new Map(definitions.map((d) => [d.cle, d]));
  const actifs = filtres.map((f) => ({ f, d: parCle.get(f.cle) })).filter(({ f, d }) => filtreActif(f, d));
  if (actifs.length === 0) return lignes;
  return lignes.filter((ligne) => actifs.every(({ f, d }) => correspond(d, f.operateur, f.valeur, d.valeur(ligne))));
}

// Filtres lus d'une vue enregistrée : garde ceux dont la colonne et l'opérateur existent encore.
export function nettoyerFiltres(filtres, definitions) {
  if (!Array.isArray(filtres)) return [];
  const parCle = new Map(definitions.map((d) => [d.cle, d]));
  return filtres
    .filter((f) => f && typeof f === 'object' && parCle.has(f.cle) && OPERATEURS[parCle.get(f.cle).type].includes(f.operateur))
    .map((f) => ({ cle: f.cle, operateur: f.operateur, valeur: f.valeur === undefined || f.valeur === null ? '' : String(f.valeur) }));
}
