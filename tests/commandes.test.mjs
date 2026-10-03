import { test } from 'node:test';
import assert from 'node:assert/strict';

import { filtrerCommandes } from '../app/js/engine/commandes.js';

const commandes = [
  { id: 'clients', libelle: 'Clients' },
  { id: 'nouveau', libelle: 'Nouveau client ou prospect', mots: 'créer ajouter' },
  { id: 'taches', libelle: 'Tâches' },
  { id: 'theme', libelle: 'Changer de thème', mots: 'sombre clair dark' },
  { id: 'journal', libelle: 'Journal d’audit' },
];
const ids = (liste) => liste.map((c) => c.id);

test('filtrerCommandes : terme vide, toutes les commandes dans l’ordre', () => {
  assert.deepEqual(ids(filtrerCommandes(commandes)), ['clients', 'nouveau', 'taches', 'theme', 'journal']);
  assert.deepEqual(ids(filtrerCommandes(commandes, '   ')), ids(commandes));
});

test('filtrerCommandes : sans accent ni casse, début de mot avant le reste', () => {
  assert.deepEqual(ids(filtrerCommandes(commandes, 'TACHE')), ['taches']);
  assert.deepEqual(ids(filtrerCommandes(commandes, 'client')), ['clients', 'nouveau']);
  assert.deepEqual(ids(filtrerCommandes(commandes, 'lient')), ['clients', 'nouveau']); // au milieu d'un mot : accepté, après les débuts de mot
});

test('filtrerCommandes : plusieurs mots, synonymes, aucun résultat', () => {
  assert.deepEqual(ids(filtrerCommandes(commandes, 'nouveau prospect')), ['nouveau']);
  assert.deepEqual(ids(filtrerCommandes(commandes, 'creer')), ['nouveau']);
  assert.deepEqual(ids(filtrerCommandes(commandes, 'sombre')), ['theme']);
  assert.deepEqual(filtrerCommandes(commandes, 'zzz'), []);
  assert.deepEqual(ids(filtrerCommandes(commandes, 'audit')), ['journal']);
});
