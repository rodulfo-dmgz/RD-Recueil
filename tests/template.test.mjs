import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseQuestionnaire } from '../scripts/parse-questionnaire.mjs';
import { parseGlossaire } from '../scripts/parse-glossaire.mjs';
import { calculerVisibilite } from '../app/js/engine/conditions.js';
import { indexerGlossaire } from '../app/js/engine/glossary.js';
import { genererNoteCadrage, extraireCorpsGabarit } from '../app/js/engine/template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function charger() {
  const [questionnaireMd, glossaireMd, gabaritMarkdown] = await Promise.all([
    readFile(join(ROOT, 'docs', '02_MODELE_RECUEIL_BESOINS.md'), 'utf8'),
    readFile(join(ROOT, 'docs', '03_GLOSSAIRE.md'), 'utf8'),
    readFile(join(ROOT, 'docs', '04_MODELE_NOTE_DE_CADRAGE.md'), 'utf8'),
  ]);
  const questionnaire = parseQuestionnaire(questionnaireMd);
  const glossaire = parseGlossaire(glossaireMd);
  return { questionnaire, glossaireIndex: indexerGlossaire(glossaire.termes), gabaritMarkdown };
}

// Un jeu de réponses représentatif : formation + ingénierie, quelques NSP.
function reponsesDemo() {
  return [
    { question_id: 'TC-1.01', valeur: 'Structure Démo' },
    { question_id: 'TC-1.02', valeur: 'sas' },
    { question_id: 'TC-1.05', valeur: 'Comptabilité' },
    { question_id: 'TC-1.08', valeur: '11-a-49' },
    { question_id: 'TC-1.09', valeur: null, nsp: true },
    { question_id: 'TC-1.10', valeur: 'akto' },
    { question_id: 'TC-2.01', valeur: { nom: 'Dupont', email: 'a@b.fr' } },
    { question_id: 'TC-2.02', valeur: { nom: 'Martin', email: 'c@d.fr' } },
    { question_id: 'TC-0.01', valeur: ['FOR', 'ING'] },
    { question_id: 'TC-3.01', valeur: ['difficultes-constatees'] },
    { question_id: 'TC-3.02', valeur: 'Contexte de test.' },
    { question_id: 'TC-3.04', valeur: 'oui' },
    { question_id: 'TC-3.05', valeur: null, nsp: true },
    { question_id: 'TC-4.01', valeur: 'Situations de test.' },
    { question_id: 'TC-4.02', valeur: 'Aujourd’hui.' },
    { question_id: 'TC-4.03', valeur: 'Demain.' },
    { question_id: 'TC-4.04', valeur: 'Écarts constatés.' },
    { question_id: 'TC-4.06', valeur: 'Compétences X.' },
    {
      question_id: 'TC-4.08',
      valeur: [{ Indicateur: 'Délai', 'Valeur actuelle': '12j', 'Valeur visée': '7j', Échéance: '2026' }],
    },
    { question_id: 'TC-5.01', valeur: 10 },
    { question_id: 'TC-5.03', valeur: 'Comptables' },
    { question_id: 'TC-5.04', valeur: ['salaries'] },
    { question_id: 'TC-5.05', valeur: ['niveau-4-bac'] },
    { question_id: 'TC-5.07', valeur: 'debutant' },
    { question_id: 'TC-5.09', valeur: 'oui' },
    { question_id: 'TC-5.10', valeur: 'volontaire' },
    { question_id: 'TC-5.11', valeur: 'bonne' },
    { question_id: 'TC-5.12', valeur: 'courante' },
    { question_id: 'TC-5.13', valeur: 'Oui' },
    { question_id: 'TC-5.14', valeur: 'Adaptations nécessaires.' },
    { question_id: 'TC-6.01', valeur: 'Objectif stratégique.' },
    { question_id: 'TC-6.02', valeur: 'Objectif opérationnel.' },
    { question_id: 'TC-6.05', valeur: 'Critères.' },
    { question_id: 'TC-7.01', valeur: 'Thèmes.' },
    { question_id: 'TC-7.03', valeur: ['aucun'] },
    { question_id: 'TC-7.08', valeur: 'sur-mesure' },
    { question_id: 'TC-8.01', valeur: ['presentiel'] },
    { question_id: 'TC-8.02', valeur: 'intra' },
    { question_id: 'TC-8.04', valeur: 'continu-jours-consecutifs' },
    { question_id: 'TC-8.05', valeur: { debut: '2026-01-01', fin: '2026-02-01' } },
    { question_id: 'TC-8.07', valeur: 'dans-vos-locaux' },
    { question_id: 'TC-8.14', valeur: ['ordinateur-individuel'] },
    { question_id: 'TC-9.01', valeur: ['evaluation-a-froid', 'mesure-du-transfert'] },
    { question_id: 'TC-9.03', valeur: 'Le manager.' },
    { question_id: 'TC-9.04', valeur: '3-mois' },
    { question_id: 'TC-9.05', valeur: ['aucun'] },
    { question_id: 'TC-10.01', valeur: ['fonds-propres'] },
    { question_id: 'TC-10.02', valeur: '5-000-a-15-000' },
    { question_id: 'TC-11.05', valeur: 'rd-formation-reste-proprietaire' },
    { question_id: 'TC-12.01', valeur: 'Le directeur.' },
    { question_id: 'TC-12.04', valeur: 'oui' },
    { question_id: 'TC-12.05', valeur: 'mensuelle' },
    { question_id: 'TC-12.06', valeur: [{ Jalon: 'Lancement', Date: '2026-01-05', Commentaire: '' }] },
    { question_id: 'TC-12.07', valeur: 'rapport-ecrit' },
    // Volet Formation
    { question_id: 'FOR.02', valeur: '9h-17h' },
    { question_id: 'FOR.03', valeur: 'votre-structure' },
    { question_id: 'FOR.07', valeur: 'formateur-rd-formation' },
    { question_id: 'FOR.08', valeur: ['numerique'] },
    { question_id: 'FOR.09', valeur: ['convention-de-formation'] },
    // Volet Ingénierie
    { question_id: 'ING.01', valeur: 'les-deux' },
    { question_id: 'ING.02', valeur: 'oui' },
    { question_id: 'ING.03', valeur: 'oui' },
    { question_id: 'ING.06', valeur: ['modules'] },
    { question_id: 'ING.08', valeur: 'non' },
    { question_id: 'ING.12', valeur: ['architecture-du-parcours'] },
    // Analyse consultant
    { question_id: 'ANA.01', valeur: '23/09/2026 10:00' },
    { question_id: 'ANA.02', valeur: 'Le directeur.' },
    { question_id: 'ANA.03', valeur: 'Ce que le client demande.' },
    { question_id: 'ANA.04', valeur: 'Ce dont il a besoin.' },
    { question_id: 'ANA.05', valeur: 'partiellement' },
    { question_id: 'ANA.06', valeur: ['FOR', 'ING'] },
    { question_id: 'ANA.07', valeur: [{ 'Comportement (verbe de Bloom*)': 'Calculer', Conditions: 'Avec le logiciel', Critères: 'Sans erreur' }] },
    { question_id: 'ANA.09', valeur: 'À clarifier.' },
    { question_id: 'ANA.12', valeur: 'go' },
    { question_id: 'ANA.13', valeur: 'Justification.' },
  ];
}

test('extraireCorpsGabarit : trouve les marqueurs DÉBUT/FIN', async () => {
  const { gabaritMarkdown } = await charger();
  const corps = extraireCorpsGabarit(gabaritMarkdown);
  assert.ok(corps.startsWith('# Note de cadrage'));
  assert.ok(!corps.includes('DÉBUT DU GABARIT'));
});

test('genererNoteCadrage : ne laisse aucune balise {{}} non résolue', async () => {
  const { questionnaire, glossaireIndex, gabaritMarkdown } = await charger();
  const reponses = reponsesDemo();
  const visibilite = calculerVisibilite(questionnaire, reponses);

  const note = genererNoteCadrage({
    gabaritMarkdown,
    meta: { reference: 'RDF-2026-0001', date: '23/09/2026', version: 1, redacteur: 'Test' },
    questionnaire,
    reponses,
    visibilite,
    glossaireIndex,
  });

  assert.doesNotMatch(note, /\{\{/);
  assert.doesNotMatch(note, /\}\}/);
});

test('genererNoteCadrage : bloc {{#si ANA.05 = Partiellement}} affiché, l’autre non', async () => {
  const { questionnaire, glossaireIndex, gabaritMarkdown } = await charger();
  const reponses = reponsesDemo();
  const visibilite = calculerVisibilite(questionnaire, reponses);

  const note = genererNoteCadrage({
    gabaritMarkdown,
    meta: { reference: 'RDF-2026-0001', date: '23/09/2026', version: 1, redacteur: 'Test' },
    questionnaire,
    reponses,
    visibilite,
    glossaireIndex,
  });

  assert.match(note, /Une partie des écarts relève d'autres leviers/);
  assert.doesNotMatch(note, /Notre analyse montre que la formation n'est pas la réponse principale/);
});

test('genererNoteCadrage : {{#si ANA.06 contient FOR}} et {{#si ANA.06 contient ING}} tous deux vrais', async () => {
  const { questionnaire, glossaireIndex, gabaritMarkdown } = await charger();
  const reponses = reponsesDemo();
  const visibilite = calculerVisibilite(questionnaire, reponses);

  const note = genererNoteCadrage({
    gabaritMarkdown,
    meta: { reference: 'RDF-2026-0001', date: '23/09/2026', version: 1, redacteur: 'Test' },
    questionnaire,
    reponses,
    visibilite,
    glossaireIndex,
  });

  assert.match(note, /Formation.*animation de l'action décrite/);
  assert.match(note, /Ingénierie.*les-deux|Ingénierie.*Les deux/);
  assert.doesNotMatch(note, /Prestation ponctuelle\s*:/);
});

test('genererNoteCadrage : {{#tableau TC-4.08}} rend un tableau Markdown', async () => {
  const { questionnaire, glossaireIndex, gabaritMarkdown } = await charger();
  const reponses = reponsesDemo();
  const visibilite = calculerVisibilite(questionnaire, reponses);

  const note = genererNoteCadrage({
    gabaritMarkdown,
    meta: { reference: 'RDF-2026-0001', date: '23/09/2026', version: 1, redacteur: 'Test' },
    questionnaire,
    reponses,
    visibilite,
    glossaireIndex,
  });

  assert.match(note, /\| Indicateur \| Valeur actuelle \| Valeur visée \| Échéance \|/);
  assert.match(note, /\| Délai \| 12j \| 7j \| 2026 \|/);
});

test('genererNoteCadrage : {{liste_nsp}} liste les points en NSP visibles', async () => {
  const { questionnaire, glossaireIndex, gabaritMarkdown } = await charger();
  const reponses = reponsesDemo();
  const visibilite = calculerVisibilite(questionnaire, reponses);

  const note = genererNoteCadrage({
    gabaritMarkdown,
    meta: { reference: 'RDF-2026-0001', date: '23/09/2026', version: 1, redacteur: 'Test' },
    questionnaire,
    reponses,
    visibilite,
    glossaireIndex,
  });

  assert.match(note, /Convention collective/); // TC-1.09, coché nsp
  assert.match(note, /Lesquelles, et avec quels résultats/); // TC-3.05, coché nsp
});

test('genererNoteCadrage : {{glossaire_utilise}} contient les définitions des termes employés', async () => {
  const { questionnaire, glossaireIndex, gabaritMarkdown } = await charger();
  const reponses = reponsesDemo();
  const visibilite = calculerVisibilite(questionnaire, reponses);

  const note = genererNoteCadrage({
    gabaritMarkdown,
    meta: { reference: 'RDF-2026-0001', date: '23/09/2026', version: 1, redacteur: 'Test' },
    questionnaire,
    reponses,
    visibilite,
    glossaireIndex,
  });

  assert.match(note, /\*\*OPCO \(Opérateur de compétences\)\*\*/);
});

test('genererNoteCadrage : variable de repli {{TC-1.09 ?? "À préciser"}}', async () => {
  const { questionnaire, glossaireIndex, gabaritMarkdown } = await charger();
  const reponses = reponsesDemo(); // TC-1.09 est en nsp -> formaterReponse renvoie le texte NSP, pas vide
  const visibilite = calculerVisibilite(questionnaire, reponses);

  const note = genererNoteCadrage({
    gabaritMarkdown,
    meta: { reference: 'RDF-2026-0001', date: '23/09/2026', version: 1, redacteur: 'Test' },
    questionnaire,
    reponses: reponses.filter((r) => r.question_id !== 'TC-1.09'), // vraiment vide cette fois
    visibilite,
    glossaireIndex,
  });

  assert.match(note, /À préciser/);
});
