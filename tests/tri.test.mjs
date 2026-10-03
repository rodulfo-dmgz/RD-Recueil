import { test } from 'node:test';
import assert from 'node:assert/strict';

import { comparer, trierLignes } from '../app/js/engine/tri.js';

const noms = (lignes) => lignes.map((l) => l.n);
const v = (l) => l.v;

test('comparer : nombres, textes sans accent ni casse, nombres dans le texte', () => {
  assert.ok(comparer(2, 10) < 0);
  assert.ok(comparer('Élodie', 'eric') < 0); // é compte comme e
  assert.ok(comparer('abc', 'ABD') < 0);
  assert.ok(comparer('FOR-2', 'FOR-10') < 0); // ordre naturel
});

test('comparer : valeurs absentes toujours après', () => {
  assert.ok(comparer(null, 'a') > 0);
  assert.ok(comparer('a', '') < 0);
  assert.equal(comparer(null, undefined), 0);
});

test('trierLignes : croissant, décroissant, absents en dernier dans les deux sens', () => {
  const lignes = [{ n: 'a', v: 3 }, { n: 'b', v: null }, { n: 'c', v: 1 }, { n: 'd', v: 2 }];
  assert.deepEqual(noms(trierLignes(lignes, v)), ['c', 'd', 'a', 'b']);
  assert.deepEqual(noms(trierLignes(lignes, v, 'desc')), ['a', 'd', 'c', 'b']);
  assert.deepEqual(noms(lignes), ['a', 'b', 'c', 'd']); // l'original n'est pas modifié
});

test('trierLignes : ordre stable à valeur égale', () => {
  const lignes = [{ n: '1', v: 'x' }, { n: '2', v: 'x' }, { n: '3', v: 'a' }];
  assert.deepEqual(noms(trierLignes(lignes, v)), ['3', '1', '2']);
  assert.deepEqual(noms(trierLignes(lignes, v, 'desc')), ['1', '2', '3']);
});
