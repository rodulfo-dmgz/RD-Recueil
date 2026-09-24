import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculerLignesTarif, TYPES_PRESTATION } from '../app/js/engine/tarif.js';

test('calculerLignesTarif : type "module", taux par défaut, coefficient 1', () => {
  const lignes = calculerLignesTarif({ type: 'module' });
  assert.equal(lignes.length, 3);
  assert.equal(lignes[0].quantite, TYPES_PRESTATION.module.conception);
  assert.equal(lignes[0].prix_unitaire, 60);
  assert.equal(lignes[1].quantite, TYPES_PRESTATION.module.animation);
  assert.equal(lignes[1].prix_unitaire, 60);
  // Suivi facturé à 80% du taux effectif.
  assert.equal(lignes[2].prix_unitaire, 60 * 0.8);
});

test('calculerLignesTarif : coefficient de niveau majore le taux effectif', () => {
  const lignes = calculerLignesTarif({ type: 'service', coefficient: 1.5 });
  assert.equal(lignes[0].prix_unitaire, 70 * 1.5);
});

test('calculerLignesTarif : taux horaire personnalisé remplace le préréglage', () => {
  const lignes = calculerLignesTarif({ type: 'formation', tauxHoraire: 90 });
  assert.equal(lignes[0].prix_unitaire, 90);
});

test('calculerLignesTarif : elearning n\'a pas de ligne animation (0h)', () => {
  const lignes = calculerLignesTarif({ type: 'elearning' });
  const designations = lignes.map((l) => l.designation);
  assert.ok(!designations.some((d) => d.startsWith('Animation')));
});

test('calculerLignesTarif : frais annexes ajoutés seulement si renseignés', () => {
  const sansFrais = calculerLignesTarif({ type: 'service' });
  assert.equal(sansFrais.length, 3);

  const avecFrais = calculerLignesTarif({ type: 'service', km: 100, tarifKm: 0.5, nuitees: 1, forfaitNuitee: 90 });
  assert.equal(avecFrais.length, 4);
  const ligneFrais = avecFrais[avecFrais.length - 1];
  assert.equal(ligneFrais.prix_unitaire, 100 * 0.5 + 1 * 90);
});

test('calculerLignesTarif : type inconnu lève une erreur', () => {
  assert.throws(() => calculerLignesTarif({ type: 'inexistant' }));
});
