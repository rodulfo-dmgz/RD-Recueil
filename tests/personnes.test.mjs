import { test } from 'node:test';
import assert from 'node:assert/strict';

import { choisirLigneProfil, identifiantsDistincts, indexerPersonnes, rattacherPersonne } from '../app/js/engine/personnes.js';

test('identifiantsDistincts : sans doublon ni valeur vide', () => {
  assert.deepEqual(identifiantsDistincts(['a', null, 'b', 'a', undefined, '']), ['a', 'b']);
  assert.deepEqual(identifiantsDistincts(undefined), []);
});

test('indexerPersonnes et rattacherPersonne : nom et e-mail rattachés, null si inconnu', () => {
  const index = indexerPersonnes([{ user_id: 'p1', nom: 'Marie Dupont', email: 'm@x.fr', role: 'consultant' }]);
  const taches = [{ id: 1, assignee_id: 'p1' }, { id: 2, assignee_id: 'p9' }, { id: 3, assignee_id: null }];
  rattacherPersonne(taches, 'assignee_id', 'assignee', index);
  assert.deepEqual(taches[0].assignee, { nom: 'Marie Dupont', email: 'm@x.fr' });
  assert.equal(taches[1].assignee, null);
  assert.equal(taches[2].assignee, null);
});

test('choisirLigneProfil : organisation mémorisée si elle existe, sinon la première, sinon aucun profil', () => {
  const lignes = [{ organisation_id: 'A', role: 'client' }, { organisation_id: 'B', role: 'admin' }];
  assert.equal(choisirLigneProfil(lignes, 'B').role, 'admin');
  assert.equal(choisirLigneProfil(lignes, 'Z').organisation_id, 'A');
  assert.equal(choisirLigneProfil(lignes, null).organisation_id, 'A');
  assert.equal(choisirLigneProfil([], 'A'), null);
  assert.equal(choisirLigneProfil(undefined, 'A'), null);
});
