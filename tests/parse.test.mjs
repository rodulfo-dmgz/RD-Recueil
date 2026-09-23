import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseQuestionnaire } from '../scripts/parse-questionnaire.mjs';
import { parseGlossaire } from '../scripts/parse-glossaire.mjs';
import { checkCoherence } from '../scripts/check-coherence.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function loadDocs() {
  const [questionnaireMd, glossaireMd, gabaritMarkdown] = await Promise.all([
    readFile(join(ROOT, 'docs', '02_MODELE_RECUEIL_BESOINS.md'), 'utf8'),
    readFile(join(ROOT, 'docs', '03_GLOSSAIRE.md'), 'utf8'),
    readFile(join(ROOT, 'docs', '04_MODELE_NOTE_DE_CADRAGE.md'), 'utf8'),
  ]);
  return { questionnaireMd, glossaireMd, gabaritMarkdown };
}

test('parse-questionnaire : 187 questions réparties dans les bonnes sections', async () => {
  const { questionnaireMd } = await loadDocs();
  const { sections, questions } = parseQuestionnaire(questionnaireMd);

  assert.equal(questions.length, 187);
  assert.equal(sections.length, 20); // TC-0..TC-13 (14) + V-FOR/PON/MOD/ING/CER (5) + ANA (1)

  const tc13 = sections.filter((s) => s.partie === 1);
  assert.equal(tc13.length, 14);
});

test('parse-questionnaire : exemple TC-8.12 conforme à 01_ARCHITECTURE.md section 6.1', async () => {
  const { questionnaireMd } = await loadDocs();
  const { questions } = parseQuestionnaire(questionnaireMd);

  const q = questions.find((x) => x.id === 'TC-8.12');
  assert.ok(q, 'TC-8.12 doit exister');
  assert.equal(q.section, 'TC-8');
  assert.equal(q.ordre, 12);
  assert.equal(q.type, 'choix_multiple');
  assert.equal(q.obligatoire, false);
  assert.equal(q.rempli_par, 'C/F');
  assert.equal(q.condition, 'TC-8.11 = oui');
  assert.deepEqual(q.glossaire, ['scorm', 'xapi']);
  assert.equal(q.nsp_autorise, true);
  assert.deepEqual(q.options[0], { valeur: 'scorm-1-2', libelle: 'SCORM\\* 1.2' });
});

test('parse-questionnaire : options codées [XXX] pour TC-0.01', async () => {
  const { questionnaireMd } = await loadDocs();
  const { questions } = parseQuestionnaire(questionnaireMd);

  const q = questions.find((x) => x.id === 'TC-0.01');
  const values = q.options.map((o) => o.valeur);
  assert.deepEqual(values, ['FOR', 'PON', 'MOD', 'ING', 'CER', 'NSP']);
});

test('parse-questionnaire : colonnes de tableau pour TC-4.08', async () => {
  const { questionnaireMd } = await loadDocs();
  const { questions } = parseQuestionnaire(questionnaireMd);

  const q = questions.find((x) => x.id === 'TC-4.08');
  assert.deepEqual(q.colonnes, ['Indicateur', 'Valeur actuelle', 'Valeur visée', 'Échéance']);
  assert.deepEqual(q.options, []);
});

test('parse-questionnaire : NSP non proposé pour oui_non et les exceptions listées', async () => {
  const { questionnaireMd } = await loadDocs();
  const { questions } = parseQuestionnaire(questionnaireMd);

  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  assert.equal(byId['TC-0.06'].type, 'oui_non');
  assert.equal(byId['TC-0.06'].nsp_autorise, false);
  assert.equal(byId['TC-0.02'].nsp_autorise, false); // exception explicite
  assert.equal(byId['TC-1.01'].nsp_autorise, false);
  assert.equal(byId['TC-1.05'].nsp_autorise, false);
  assert.equal(byId['TC-0.03'].nsp_autorise, true); // date, pas exclue
});

test('parse-questionnaire : sections de la partie 3 (ANA) invisibles au client', async () => {
  const { questionnaireMd } = await loadDocs();
  const { sections } = parseQuestionnaire(questionnaireMd);

  const ana = sections.find((s) => s.id === 'ANA');
  assert.equal(ana.partie, 3);
  assert.equal(ana.visible_client, false);
});

test('parse-questionnaire : condition de section pour V-FOR', async () => {
  const { questionnaireMd } = await loadDocs();
  const { sections } = parseQuestionnaire(questionnaireMd);

  const vfor = sections.find((s) => s.id === 'V-FOR');
  assert.equal(vfor.condition, 'TC-0.01 contient FOR');
});

test('parse-glossaire : 134 termes, entrée "opco" conforme', async () => {
  const { glossaireMd } = await loadDocs();
  const { termes } = parseGlossaire(glossaireMd);

  assert.equal(termes.length, 134);

  const opco = termes.find((t) => t.id === 'opco');
  assert.ok(opco);
  assert.equal(opco.categorie, 'Financement');
  assert.match(opco.definition, /Opérateur de compétences|Organisme agréé/);
});

test('check-coherence : 0 erreur sur les documents de référence', async () => {
  const { questionnaireMd, glossaireMd, gabaritMarkdown } = await loadDocs();
  const questionnaire = parseQuestionnaire(questionnaireMd);
  const glossaire = parseGlossaire(glossaireMd);

  const errors = checkCoherence({ questionnaire, glossaire, gabaritMarkdown });

  assert.deepEqual(errors, []);
});
