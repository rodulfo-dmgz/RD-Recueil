import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseQuestionnaire } from '../scripts/parse-questionnaire.mjs';
import { slug, evaluerExpression, calculerVisibilite } from '../app/js/engine/conditions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function chargerQuestionnaire() {
  const md = await readFile(join(ROOT, 'docs', '02_MODELE_RECUEIL_BESOINS.md'), 'utf8');
  return parseQuestionnaire(md);
}

test('slug : accents, astérisque échappé, ponctuation', () => {
  assert.equal(slug('Accompagnement Qualiopi\\*'), 'accompagnement-qualiopi');
  assert.equal(slug('Répertoire spécifique (RS\\*)'), 'repertoire-specifique-rs');
  assert.equal(slug('  Évaluation à froid  '), 'evaluation-a-froid');
});

test('evaluerExpression : "-" est toujours vrai', () => {
  assert.equal(evaluerExpression('-', {}), true);
  assert.equal(evaluerExpression(null, {}), true);
});

test('evaluerExpression : ET prioritaire sur OU', () => {
  const ctx = {
    estVisible: () => true,
    estRenseigne: () => true,
    valeur: (id) => ({ A: 'x', B: 'y', C: 'z' }[id]),
  };
  // (A=x ET B=non) OU (C=z) -> faux ET vrai OU vrai -> vrai grâce au groupe C
  assert.equal(evaluerExpression('A = x ET B = non OU C = z', ctx), true);
  // (A=x ET B=non) seul, sans le groupe C valide -> faux
  assert.equal(evaluerExpression('A = x ET B = non', ctx), false);
});

test('evaluerExpression : contient / ne contient pas', () => {
  const ctx = { estVisible: () => true, estRenseigne: () => true, valeur: () => ['FOR', 'ING'] };
  assert.equal(evaluerExpression('X contient FOR', ctx), true);
  assert.equal(evaluerExpression('X contient CER', ctx), false);
  assert.equal(evaluerExpression('X ne contient pas CER', ctx), true);
});

test('evaluerExpression : est renseigné', () => {
  const ctx = { estVisible: () => true, estRenseigne: (id) => id === 'A', valeur: () => null };
  assert.equal(evaluerExpression('A est renseigné', ctx), true);
  assert.equal(evaluerExpression('B est renseigné', ctx), false);
});

test('calculerVisibilite : V-FOR visible seulement si TC-0.01 contient FOR', async () => {
  const questionnaire = await chargerQuestionnaire();

  const sansFor = calculerVisibilite(questionnaire, [{ question_id: 'TC-0.01', valeur: ['PON'], nsp: false }]);
  assert.equal(sansFor.sectionsVisibles.has('V-FOR'), false);
  assert.equal(sansFor.questionsVisibles.has('FOR.02'), false);

  const avecFor = calculerVisibilite(questionnaire, [{ question_id: 'TC-0.01', valeur: ['FOR'], nsp: false }]);
  assert.equal(avecFor.sectionsVisibles.has('V-FOR'), true);
  assert.equal(avecFor.questionsVisibles.has('FOR.02'), true); // pas de condition propre
  assert.equal(avecFor.sectionsVisibles.has('V-PON'), false);
});

test('calculerVisibilite : propagation, FOR.05 dépend de FOR.03 dans la même section visible', async () => {
  const questionnaire = await chargerQuestionnaire();
  const base = [{ question_id: 'TC-0.01', valeur: ['FOR'], nsp: false }];

  const sansReponseFor03 = calculerVisibilite(questionnaire, base);
  assert.equal(sansReponseFor03.questionsVisibles.has('FOR.05'), false);

  const avecFor03 = calculerVisibilite(questionnaire, [
    ...base,
    { question_id: 'FOR.03', valeur: 'votre-structure', nsp: false },
  ]);
  assert.equal(avecFor03.questionsVisibles.has('FOR.05'), true);

  const avecAutreValeur = calculerVisibilite(questionnaire, [
    ...base,
    { question_id: 'FOR.03', valeur: 'rd-formation', nsp: false },
  ]);
  assert.equal(avecAutreValeur.questionsVisibles.has('FOR.05'), false);
});

test('calculerVisibilite : TC-7.04 (OU de 3 contient, corrigé RS) réagit à chaque branche', async () => {
  const questionnaire = await chargerQuestionnaire();

  const rncp = calculerVisibilite(questionnaire, [{ question_id: 'TC-7.03', valeur: ['rncp'], nsp: false }]);
  assert.equal(rncp.questionsVisibles.has('TC-7.04'), true);

  const rs = calculerVisibilite(questionnaire, [
    { question_id: 'TC-7.03', valeur: ['repertoire-specifique-rs'], nsp: false },
  ]);
  assert.equal(rs.questionsVisibles.has('TC-7.04'), true);

  const aucun = calculerVisibilite(questionnaire, [{ question_id: 'TC-7.03', valeur: ['aucun'], nsp: false }]);
  assert.equal(aucun.questionsVisibles.has('TC-7.04'), false);
});

test('calculerVisibilite : comparaison insensible à la casse via slug (TC-5.14 / TC-5.13 = oui)', async () => {
  const questionnaire = await chargerQuestionnaire();
  // TC-5.13 stocke la valeur en minuscule ("oui"), la condition de TC-5.14 écrit "oui" aussi : ok.
  const visible = calculerVisibilite(questionnaire, [{ question_id: 'TC-5.13', valeur: 'oui', nsp: false }]);
  assert.equal(visible.questionsVisibles.has('TC-5.14'), true);

  const masque = calculerVisibilite(questionnaire, [{ question_id: 'TC-5.13', valeur: 'non', nsp: false }]);
  assert.equal(masque.questionsVisibles.has('TC-5.14'), false);
});

test('calculerVisibilite : ANA (partie 3) toujours visible côté consultant, sans condition de section', async () => {
  const questionnaire = await chargerQuestionnaire();
  const visibilite = calculerVisibilite(questionnaire, []);
  assert.equal(visibilite.sectionsVisibles.has('ANA'), true);
  assert.equal(visibilite.questionsVisibles.has('ANA.01'), true);
});
