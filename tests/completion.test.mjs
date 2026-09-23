import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseQuestionnaire } from '../scripts/parse-questionnaire.mjs';
import { calculerVisibilite } from '../app/js/engine/conditions.js';
import { calculerProgression, listerPointsEntretien } from '../app/js/engine/completion.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function chargerQuestionnaire() {
  const md = await readFile(join(ROOT, 'docs', '02_MODELE_RECUEIL_BESOINS.md'), 'utf8');
  return parseQuestionnaire(md);
}

test('calculerProgression : TC-0 seule, rien de rempli -> 0 %', async () => {
  const questionnaire = await chargerQuestionnaire();
  const visibilite = calculerVisibilite(questionnaire, []);
  const { global } = calculerProgression(questionnaire, visibilite, []);
  assert.equal(global.renseignees, 0);
  assert.ok(global.total > 0);
  assert.equal(global.pourcentage, 0);
});

test('calculerProgression : nsp compte comme renseigné', async () => {
  const questionnaire = await chargerQuestionnaire();
  const visibilite = calculerVisibilite(questionnaire, []);
  const reponses = [{ question_id: 'TC-0.01', valeur: null, nsp: true }];
  const { global: avecNsp } = calculerProgression(questionnaire, visibilite, reponses);
  const { global: sansReponse } = calculerProgression(questionnaire, visibilite, []);
  assert.equal(avecNsp.renseignees, sansReponse.renseignees + 1);
});

test('calculerProgression : questions F exclues côté client, incluses côté consultant', async () => {
  const questionnaire = await chargerQuestionnaire();
  const visibilite = calculerVisibilite(questionnaire, []); // ANA visible par défaut (pas de condition)
  const client = calculerProgression(questionnaire, visibilite, [], { inclureFormateur: false });
  const consultant = calculerProgression(questionnaire, visibilite, [], { inclureFormateur: true });
  assert.ok(consultant.global.total > client.global.total); // les obligatoires ANA (F) s'ajoutent
});

test('calculerProgression : la section masquée ne compte pas dans parSection', async () => {
  const questionnaire = await chargerQuestionnaire();
  const visibilite = calculerVisibilite(questionnaire, [{ question_id: 'TC-0.01', valeur: ['PON'], nsp: false }]);
  const { parSection } = calculerProgression(questionnaire, visibilite, []);
  assert.equal(parSection.has('V-FOR'), false);
  assert.equal(parSection.has('V-PON'), true);
});

test('listerPointsEntretien : ne retient que les questions visibles cochées nsp', async () => {
  const questionnaire = await chargerQuestionnaire();
  const visibilite = calculerVisibilite(questionnaire, [{ question_id: 'TC-0.01', valeur: ['PON'], nsp: false }]);
  const reponses = [
    { question_id: 'TC-0.03', valeur: null, nsp: true }, // visible (tronc commun)
    { question_id: 'FOR.02', valeur: null, nsp: true }, // masquée (section V-FOR non visible)
  ];
  const points = listerPointsEntretien(questionnaire, visibilite, reponses);
  const ids = points.map((q) => q.id);
  assert.ok(ids.includes('TC-0.03'));
  assert.ok(!ids.includes('FOR.02'));
});
