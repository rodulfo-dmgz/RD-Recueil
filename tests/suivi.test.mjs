import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ETAPES_SUIVI, etapeCourante, prochaineAction } from '../app/js/engine/suivi.js';

const STATUTS = [
  'brouillon', 'envoyee', 'en_saisie', 'soumise', 'entretien_planifie', 'en_analyse',
  'cadrage_envoye', 'cadrage_a_revoir', 'cadrage_valide', 'proposition_envoyee',
  'gagnee', 'perdue', 'reorientee', 'abandonnee',
];

test('etapeCourante : chaque statut du cycle de vie appartient à une étape', () => {
  for (const s of STATUTS) {
    assert.ok(ETAPES_SUIVI.some((e) => e.statuts.includes(s)), `statut sans étape : ${s}`);
  }
});

test('etapeCourante : ordre des étapes', () => {
  assert.equal(etapeCourante('en_saisie'), 0);
  assert.equal(etapeCourante('entretien_planifie'), 1);
  assert.equal(etapeCourante('cadrage_valide'), 2);
  assert.equal(etapeCourante('proposition_envoyee'), 3);
  assert.equal(etapeCourante('gagnee'), 4);
});

test('etapeCourante : statut inconnu -> première étape', () => {
  assert.equal(etapeCourante('inconnu'), 0);
});

test('prochaineAction : le client doit agir sur saisie, créneau, note et proposition', () => {
  assert.equal(prochaineAction('en_saisie', 'RDF-1').type, 'action');
  assert.equal(prochaineAction('soumise', 'RDF-1').href, '#/d/RDF-1/creneaux');
  assert.equal(prochaineAction('cadrage_envoye', 'RDF-1').href, '#/d/RDF-1/cadrage');
  assert.equal(prochaineAction('proposition_envoyee', 'RDF-1').href, '#/d/RDF-1/proposition');
});

test('prochaineAction : attente quand RD Formation agit', () => {
  for (const s of ['en_analyse', 'cadrage_a_revoir', 'cadrage_valide']) {
    assert.equal(prochaineAction(s, 'RDF-1').type, 'attente');
  }
});

test('prochaineAction : statuts finaux -> terminé, sans lien', () => {
  for (const s of ['gagnee', 'perdue', 'reorientee', 'abandonnee']) {
    const a = prochaineAction(s, 'RDF-1');
    assert.equal(a.type, 'termine');
    assert.equal(a.href, null);
  }
});

test('prochaineAction : tout statut a un libellé', () => {
  for (const s of STATUTS) assert.ok(prochaineAction(s, 'RDF-1').libelle);
});
