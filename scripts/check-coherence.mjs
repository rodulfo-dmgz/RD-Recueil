// Contrôle de cohérence : IDs, conditions, glossaire, gabarit.
// Doit afficher 0 erreur (01_ARCHITECTURE.md sections 6.3, 9 ; CLAUDE.md).

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCondition, slug } from './lib.mjs';
import { parseQuestionnaire } from './parse-questionnaire.mjs';
import { parseGlossaire } from './parse-glossaire.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const GABARIT_MARKERS_RE = /<!-- ================= DÉBUT DU GABARIT ================= -->([\s\S]*?)<!-- ================= FIN DU GABARIT ================= -->/;
const TAG_RE = /\{\{(.*?)\}\}/gs;

function optionMatches(option, value) {
  return option.valeur === value || slug(option.libelle) === slug(value);
}

function validateTerm(term, { questionsById, context, errors, checkOrder, index }) {
  const refQuestion = questionsById.get(term.id);
  if (!refQuestion) {
    errors.push(`${context} : identifiant inexistant dans une condition : "${term.id}"`);
    return;
  }

  if (checkOrder && refQuestion.__index >= index) {
    errors.push(`${context} : la condition référence "${term.id}", qui n'est pas défini avant cette question`);
  }

  if (term.operator === 'est renseigné') return;

  if (term.operator === 'contient' || term.operator === 'ne contient pas') {
    if (refQuestion.type !== 'choix_multiple') {
      errors.push(`${context} : l'opérateur "${term.operator}" suppose que "${term.id}" soit de type choix_multiple (trouvé : ${refQuestion.type})`);
    }
  } else if (refQuestion.type === 'choix_multiple') {
    errors.push(`${context} : l'opérateur "${term.operator}" ne convient pas à "${term.id}" de type choix_multiple (utiliser "contient")`);
  }

  let validValues = null;
  if (refQuestion.type === 'oui_non') {
    validValues = ['oui', 'non'];
  } else if (refQuestion.options && refQuestion.options.length > 0) {
    validValues = refQuestion.options;
  }

  if (validValues === refQuestion.options) {
    const ok = refQuestion.options.some((opt) => optionMatches(opt, term.value));
    if (!ok) {
      errors.push(`${context} : la valeur "${term.value}" ne correspond à aucune option de "${term.id}"`);
    }
  } else if (validValues) {
    const ok = validValues.includes(slug(term.value));
    if (!ok) {
      errors.push(`${context} : la valeur "${term.value}" n'est pas "oui" ou "non" pour "${term.id}"`);
    }
  }
}

function checkQuestionsAndSections(questionnaire, errors) {
  const questionsById = new Map();
  questionnaire.questions.forEach((q, index) => {
    if (questionsById.has(q.id)) {
      errors.push(`Identifiant de question dupliqué : "${q.id}"`);
    }
    questionsById.set(q.id, { ...q, __index: index });
  });

  const sectionIds = new Set();
  for (const section of questionnaire.sections) {
    if (sectionIds.has(section.id)) {
      errors.push(`Identifiant de section dupliqué : "${section.id}"`);
    }
    sectionIds.add(section.id);

    if (section.condition !== '-') {
      let terms;
      try {
        terms = parseCondition(section.condition);
      } catch (err) {
        errors.push(`Section ${section.id} : ${err.message}`);
        continue;
      }
      for (const term of terms) {
        validateTerm(term, {
          questionsById,
          context: `Section ${section.id}`,
          errors,
          checkOrder: false,
        });
      }
    }
  }

  questionnaire.questions.forEach((q, index) => {
    if (q.condition !== '-') {
      let terms;
      try {
        terms = parseCondition(q.condition);
      } catch (err) {
        errors.push(`Question ${q.id} : ${err.message}`);
        return;
      }
      for (const term of terms) {
        validateTerm(term, {
          questionsById,
          context: `Question ${q.id}`,
          errors,
          checkOrder: true,
          index,
        });
      }
    }
  });

  return questionsById;
}

function checkGlossaire(questionnaire, glossaire, errors) {
  const glossaireIds = new Set(glossaire.termes.map((t) => t.id));

  for (const q of questionnaire.questions) {
    const texts = [q.libelle, ...(q.options || []).map((o) => o.libelle)];
    const starCount = texts.reduce((n, t) => n + ((t.match(/\\\*/g) || []).length), 0);

    if (starCount > q.glossaire.length) {
      errors.push(`Question ${q.id} : plus d'astérisques (${starCount}) que d'identifiants glossaire déclarés (${q.glossaire.length})`);
    }

    for (const id of q.glossaire) {
      if (!glossaireIds.has(id)) {
        errors.push(`Question ${q.id} : identifiant glossaire "${id}" absent de 03_GLOSSAIRE.md`);
      }
    }
  }
}

function checkGabarit(gabaritMarkdown, questionsById, errors) {
  const match = gabaritMarkdown.match(GABARIT_MARKERS_RE);
  if (!match) {
    errors.push('Gabarit : marqueurs DÉBUT/FIN introuvables dans 04_MODELE_NOTE_DE_CADRAGE.md');
    return;
  }
  const body = match[1];

  for (const m of body.matchAll(TAG_RE)) {
    const content = m[1].trim();

    if (content.startsWith('#si ')) {
      const condition = content.slice(4).trim();
      let terms;
      try {
        terms = parseCondition(condition);
      } catch (err) {
        errors.push(`Gabarit : ${err.message}`);
        continue;
      }
      for (const term of terms) {
        validateTerm(term, { questionsById, context: 'Gabarit {{#si}}', errors, checkOrder: false });
      }
      continue;
    }

    if (content.startsWith('#tableau ')) {
      const id = content.slice(9).trim();
      const q = questionsById.get(id);
      if (!q) {
        errors.push(`Gabarit : {{#tableau ${id}}} référence une question inexistante`);
      } else if (q.type !== 'tableau') {
        errors.push(`Gabarit : {{#tableau ${id}}} référence une question de type "${q.type}" (attendu : tableau)`);
      }
      continue;
    }

    if (content === '/si') continue;

    const ref = content.split('??')[0].trim();
    if (ref.startsWith('meta.')) continue;
    if (ref === 'liste_nsp' || ref === 'glossaire_utilise') continue;
    if (!questionsById.has(ref)) {
      errors.push(`Gabarit : variable "{{${ref}}}" ne correspond à aucune question`);
    }
  }
}

export function checkCoherence({ questionnaire, glossaire, gabaritMarkdown }) {
  const errors = [];
  const questionsById = checkQuestionsAndSections(questionnaire, errors);
  checkGlossaire(questionnaire, glossaire, errors);
  checkGabarit(gabaritMarkdown, questionsById, errors);
  return errors;
}

async function main() {
  const questionnaireMd = await readFile(join(ROOT, 'docs', '02_MODELE_RECUEIL_BESOINS.md'), 'utf8');
  const glossaireMd = await readFile(join(ROOT, 'docs', '03_GLOSSAIRE.md'), 'utf8');
  const gabaritMarkdown = await readFile(join(ROOT, 'docs', '04_MODELE_NOTE_DE_CADRAGE.md'), 'utf8');

  const questionnaire = parseQuestionnaire(questionnaireMd);
  const glossaire = parseGlossaire(glossaireMd);

  const errors = checkCoherence({ questionnaire, glossaire, gabaritMarkdown });

  if (errors.length === 0) {
    console.log('0 erreur');
    return;
  }

  console.error(`${errors.length} erreur(s) :`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
