import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CIBLES_SIRENE, reponsesIdentification } from '../app/js/engine/pre-remplissage.js';

const sirene = {
  siret: '13053306000013',
  raisonSociale: 'ACCENTEUR SAS',
  codeNaf: '70.22Z',
  secteurActivite: 'Activités spécialisées, scientifiques et techniques',
  adresse: { rue: '1 rue du Port', cp: '34200', ville: 'SETE' },
  formeJuridique: 'sas',
  effectif: '11-a-49',
  conventionCollective: null,
  estOrganismeFormation: 'non',
  estQualiopi: null,
  nda: '',
};
const parQuestion = (liste) => Object.fromEntries(liste.map((r) => [r.question_id, r.valeur]));

test('CIBLES_SIRENE : une question TC-1 par donnée, sans doublon', () => {
  const ids = Object.values(CIBLES_SIRENE);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^TC-1\.\d{2}$/.test(id)));
});

test('reponsesIdentification : données SIRENE reprises, valeurs vides ignorées', () => {
  const r = parQuestion(reponsesIdentification({ sirene }));
  assert.equal(r['TC-1.01'], 'ACCENTEUR SAS');
  assert.equal(r['TC-1.02'], 'sas');
  assert.equal(r['TC-1.03'], '13053306000013');
  assert.equal(r['TC-1.04'], '70.22Z');
  assert.deepEqual(r['TC-1.06'], { rue: '1 rue du Port', cp: '34200', ville: 'SETE' });
  assert.equal(r['TC-1.08'], '11-a-49');
  assert.equal(r['TC-1.12'], 'non');
  for (const absent of ['TC-1.09', 'TC-1.13', 'TC-1.14', 'TC-1.11']) assert.equal(absent in r, false);
});

test('reponsesIdentification : la fiche prime pour la raison sociale et le SIRET, ajoute le site', () => {
  const r = parQuestion(reponsesIdentification({ fiche: { raison_sociale: ' Accenteur Formation ', siret: '130 533 060 00013', site_web: 'https://accenteur.fr' }, sirene }));
  assert.equal(r['TC-1.01'], 'Accenteur Formation');
  assert.equal(r['TC-1.03'], '13053306000013');
  assert.equal(r['TC-1.11'], 'https://accenteur.fr');
  assert.equal(r['TC-1.02'], 'sas'); // le reste vient de SIRENE
});

test('reponsesIdentification : sans SIRENE, seulement ce que la fiche contient ; rien du tout sans données', () => {
  assert.deepEqual(reponsesIdentification({ fiche: { raison_sociale: 'DEMO' } }), [{ question_id: 'TC-1.01', valeur: 'DEMO' }]);
  assert.deepEqual(reponsesIdentification({ sirene: { siret: '12345678901234' } }), [{ question_id: 'TC-1.03', valeur: '12345678901234' }]);
  assert.deepEqual(reponsesIdentification(), []);
  assert.deepEqual(reponsesIdentification({ fiche: { raison_sociale: '  ', siret: null } }), []);
});

test('separerNom : prénom et nom, un seul mot, noms composés, vide', async () => {
  const { separerNom } = await import('../app/js/engine/pre-remplissage.js');
  assert.deepEqual(separerNom('Marie Dupont'), { prenom: 'Marie', nom: 'Dupont' });
  assert.deepEqual(separerNom('Jean de la Fontaine'), { prenom: 'Jean', nom: 'de la Fontaine' });
  assert.deepEqual(separerNom('Anatol'), { prenom: null, nom: 'Anatol' });
  assert.deepEqual(separerNom('  '), { prenom: null, nom: '' });
  assert.deepEqual(separerNom(null), { prenom: null, nom: '' });
});
