import { test } from 'node:test';
import assert from 'node:assert/strict';

import { genererCsv } from '../app/js/engine/csv.js';

test('genererCsv : en-tête et lignes séparées par point-virgule', () => {
  const csv = genererCsv(
    [{ nom: 'Dupont', ville: 'Paris' }],
    [
      { libelle: 'Nom', valeur: (l) => l.nom },
      { libelle: 'Ville', valeur: (l) => l.ville },
    ]
  );
  assert.equal(csv, 'Nom;Ville\r\nDupont;Paris');
});

test('genererCsv : échappe guillemets, points-virgules et retours à la ligne', () => {
  const csv = genererCsv(
    [{ texte: 'Il a dit "bonjour"; puis est parti\nvite' }],
    [{ libelle: 'Texte', valeur: (l) => l.texte }]
  );
  assert.equal(csv, 'Texte\r\n"Il a dit ""bonjour""; puis est parti\nvite"');
});

test('genererCsv : valeur absente -> cellule vide', () => {
  const csv = genererCsv([{}], [{ libelle: 'X', valeur: (l) => l.x }]);
  assert.equal(csv, 'X\r\n');
});
