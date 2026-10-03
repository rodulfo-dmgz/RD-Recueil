import { test } from 'node:test';
import assert from 'node:assert/strict';

import { appliquerFiltres, filtreActif, libelleOperateur, nettoyerFiltres } from '../app/js/engine/filtres.js';

const definitions = [
  { cle: 'ville', libelle: 'Ville', type: 'texte', valeur: (l) => l.ville },
  { cle: 'statut', libelle: 'Statut', type: 'choix', valeur: (l) => l.statut },
  { cle: 'types', libelle: 'Types', type: 'choix', valeur: (l) => l.types },
  { cle: 'ca', libelle: 'CA', type: 'nombre', valeur: (l) => l.ca },
  { cle: 'date', libelle: 'Date', type: 'date', valeur: (l) => l.date },
];
const lignes = [
  { id: 1, ville: 'Sète', statut: 'client', types: ['FOR'], ca: 1000, date: '2026-10-02T10:00:00Z' },
  { id: 2, ville: 'Lattes', statut: 'prospect', types: ['FOR', 'CER'], ca: 0, date: '2026-01-15' },
  { id: 3, ville: null, statut: 'client', types: [], ca: null, date: null },
];
const ids = (liste) => liste.map((l) => l.id);
const f = (cle, operateur, valeur = '') => ({ cle, operateur, valeur });

test('texte : contient sans accent ni casse, est, renseigné, vide', () => {
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('ville', 'contient', 'SETE')], definitions)), [1]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('ville', 'egal', 'lattes')], definitions)), [2]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('ville', 'renseigne')], definitions)), [1, 2]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('ville', 'vide')], definitions)), [3]);
});

test('choix : est, n’est pas, y compris sur une liste de valeurs', () => {
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('statut', 'est', 'client')], definitions)), [1, 3]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('statut', 'nest_pas', 'client')], definitions)), [2]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('types', 'est', 'CER')], definitions)), [2]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('types', 'nest_pas', 'CER')], definitions)), [1, 3]);
});

test('nombre : au moins, au plus, égal, valeur absente jamais retenue, virgule décimale', () => {
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('ca', 'sup', '500')], definitions)), [1]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('ca', 'inf', '500')], definitions)), [2]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('ca', 'egal', '0')], definitions)), [2]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('ca', 'sup', '999,5')], definitions)), [1]);
});

test('date : avant, après (strict), renseignée, vide ; accepte un horodatage', () => {
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('date', 'apres', '2026-02-01')], definitions)), [1]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('date', 'avant', '2026-02-01')], definitions)), [2]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('date', 'avant', '2026-10-02')], definitions)), [2]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('date', 'vide')], definitions)), [3]);
});

test('filtres cumulés, incomplets et inconnus ignorés', () => {
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('statut', 'est', 'client'), f('ca', 'sup', '1')], definitions)), [1]);
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('ville', 'contient', '')], definitions)), [1, 2, 3]); // valeur manquante
  assert.deepEqual(ids(appliquerFiltres(lignes, [f('inconnu', 'est', 'x'), f('ville', 'poney', 'x')], definitions)), [1, 2, 3]);
  assert.equal(appliquerFiltres(lignes, [], definitions), lignes);
  assert.equal(filtreActif(f('ville', 'renseigne'), definitions[0]), true);
  assert.equal(filtreActif(f('ville', 'contient'), definitions[0]), false);
});

test('nettoyerFiltres : colonnes ou opérateurs disparus retirés, valeurs en texte', () => {
  const lus = nettoyerFiltres([f('ville', 'contient', 'sete'), f('ancienne', 'est', 'x'), f('ville', 'sup', '3'), null, { cle: 'ca', operateur: 'sup', valeur: 5 }], definitions);
  assert.deepEqual(lus, [f('ville', 'contient', 'sete'), f('ca', 'sup', '5')]);
  assert.deepEqual(nettoyerFiltres('x', definitions), []);
});

test('libelleOperateur : « égal à » pour un nombre', () => {
  assert.equal(libelleOperateur('nombre', 'egal'), 'égal à');
  assert.equal(libelleOperateur('texte', 'egal'), 'est');
});
