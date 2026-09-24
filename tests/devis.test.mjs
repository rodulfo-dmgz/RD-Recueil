import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculerTotalLigne, calculerTotalDevis } from '../app/js/engine/devis.js';

test('calculerTotalLigne : quantité × prix unitaire', () => {
  assert.equal(calculerTotalLigne({ quantite: 3, prix_unitaire: 150 }), 450);
  assert.equal(calculerTotalLigne({ quantite: '2', prix_unitaire: '99.5' }), 199);
});

test('calculerTotalLigne : valeurs manquantes ou invalides -> 0', () => {
  assert.equal(calculerTotalLigne({ quantite: null, prix_unitaire: 100 }), 0);
  assert.equal(calculerTotalLigne({ quantite: 2, prix_unitaire: undefined }), 0);
});

test('calculerTotalDevis : somme des lignes', () => {
  const lignes = [
    { quantite: 1, prix_unitaire: 1000 },
    { quantite: 2, prix_unitaire: 250 },
  ];
  assert.equal(calculerTotalDevis(lignes), 1500);
});

test('calculerTotalDevis : liste vide -> 0', () => {
  assert.equal(calculerTotalDevis([]), 0);
});
