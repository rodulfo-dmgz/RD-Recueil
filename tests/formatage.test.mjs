import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formaterReponse } from '../app/js/engine/formatage.js';

test('formaterReponse : absente -> tiret', () => {
  assert.equal(formaterReponse({ type: 'texte_court' }, null), '—');
});

test('formaterReponse : nsp -> libellé dédié', () => {
  assert.equal(formaterReponse({ type: 'texte_court' }, { nsp: true }), 'Je ne sais pas / à définir ensemble');
});

test('formaterReponse : valeur vide -> tiret', () => {
  assert.equal(formaterReponse({ type: 'texte_court' }, { valeur: '' }), '—');
  assert.equal(formaterReponse({ type: 'choix_multiple' }, { valeur: [] }), '—');
});

test('formaterReponse : choix_multiple résout les libellés depuis les options', () => {
  const question = {
    type: 'choix_multiple',
    options: [
      { valeur: 'a', libelle: 'Option A' },
      { valeur: 'b', libelle: 'Option B' },
    ],
  };
  assert.equal(formaterReponse(question, { valeur: ['a', 'b'] }), 'Option A, Option B');
});

test('formaterReponse : choix_unique résout le libellé depuis les options', () => {
  const question = { type: 'choix_unique', options: [{ valeur: 'x', libelle: 'Libellé X' }] };
  assert.equal(formaterReponse(question, { valeur: 'x' }), 'Libellé X');
});

test('formaterReponse : code_rncp en ancien format (chaîne) reste affiché tel quel', () => {
  assert.equal(formaterReponse({ type: 'code_rncp' }, { valeur: 'RNCP12345' }), 'RNCP12345');
});

test('formaterReponse : code_rncp avec fiche mise en cache n\'affiche que le texte', () => {
  const reponse = { valeur: { texte: 'Gestionnaire de paie', source: 'certifinfo', detail: { trouve: true, objectif: 'x' } } };
  assert.equal(formaterReponse({ type: 'code_rncp' }, reponse), 'Gestionnaire de paie');
});

test('formaterReponse : objet générique (hors code_rncp) concatène ses valeurs', () => {
  const question = { type: 'siret' };
  const reponse = { valeur: { siret: '12345678900012', raisonSociale: 'ACME' } };
  assert.equal(formaterReponse(question, reponse), '12345678900012, ACME');
});

test('formaterReponse : nombre converti en chaîne', () => {
  assert.equal(formaterReponse({ type: 'nombre' }, { valeur: 42 }), '42');
});
