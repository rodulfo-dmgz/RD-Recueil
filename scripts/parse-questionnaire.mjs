// docs/02_MODELE_RECUEIL_BESOINS.md -> data/questionnaire.json
// Règles de parsing : 01_ARCHITECTURE.md section 6.1.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { slug } from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const NSP_EXCLUDED_TYPES = new Set(['oui_non', 'siret', 'adresse', 'contact', 'url', 'fichier']);
// Questions dont les options proposent déjà un choix "Je ne sais pas" (ou
// équivalent) : la case universelle serait une deuxième façon de dire la
// même chose, redondante et source de confusion (signalé sur TC-5.13, même
// motif partout ailleurs dans cette liste).
const NSP_EXCLUDED_IDS = new Set([
  'TC-0.01',
  'TC-0.02',
  'TC-1.01',
  'TC-1.05',
  'TC-1.10',
  'TC-4.05',
  'TC-5.13',
  'TC-8.12',
  'TC-10.01',
  'TC-11.04',
  'FOR.05',
  'CER.04',
  'CER.05',
]);

const QUESTION_ID_RE = /^[A-Z]+(-\d+)?\.\d+$/;
const PARTIE_RE = /^# PARTIE (\d+) · (.+)$/;
const SECTION_RE = /^## ([A-Za-z0-9-]+) · (.+)$/;
const CONDITION_SECTION_RE = /^> \*\*Condition de section\*\* : `(.+)`$/;
const COLONNES_RE = /^Colonnes\s*:\s*(.+)$/;
const CODE_OPTION_RE = /^\[([A-Z0-9]+)\]\s*(.+)$/;

function parseOptions(optionsRaw) {
  if (optionsRaw === '-') return { options: [] };

  const colonnesMatch = optionsRaw.match(COLONNES_RE);
  if (colonnesMatch) {
    return { options: [], colonnes: colonnesMatch[1].split(' ; ').map((c) => c.trim()) };
  }

  const options = optionsRaw.split(' ; ').map((part) => {
    const trimmed = part.trim();
    const codeMatch = trimmed.match(CODE_OPTION_RE);
    if (codeMatch) {
      return { valeur: codeMatch[1], libelle: codeMatch[2].trim() };
    }
    return { valeur: slug(trimmed), libelle: trimmed };
  });

  return { options };
}

export function parseQuestionnaire(markdown) {
  const lines = markdown.split('\n');

  const sections = [];
  const questions = [];
  const questionOrdre = {};

  let currentPartie = null;
  let currentSectionId = null;
  let pendingSection = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const partieMatch = line.match(PARTIE_RE);
    if (partieMatch) {
      currentPartie = Number(partieMatch[1]);
      pendingSection = null;
      continue;
    }

    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      const section = {
        id: sectionMatch[1],
        partie: currentPartie,
        titre: sectionMatch[2].trim(),
        ordre: sections.length + 1,
        condition: '-',
        visible_client: currentPartie !== 3,
      };
      sections.push(section);
      currentSectionId = section.id;
      questionOrdre[section.id] = 0;
      pendingSection = section;
      continue;
    }

    const condMatch = line.match(CONDITION_SECTION_RE);
    if (condMatch && pendingSection) {
      pendingSection.condition = condMatch[1].trim();
      pendingSection = null;
      continue;
    }

    if (line === '') continue; // une ligne vide ne referme pas l'attente d'une condition de section

    pendingSection = null; // toute autre ligne non vide referme l'attente

    if (!line.startsWith('|')) continue;

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length === 0) continue;
    if (cells[0] === 'ID') continue; // en-tête de tableau
    if (!QUESTION_ID_RE.test(cells[0])) continue; // pas une ligne de question

    if (cells.length !== 8) {
      throw new Error(`Ligne de question malformée (${cells.length} cellules) : ${line}`);
    }

    const [id, libelle, type, optionsRaw, oblRaw, remplParRaw, conditionRaw, glossaireRaw] = cells;
    const { options, colonnes } = parseOptions(optionsRaw);

    questionOrdre[currentSectionId] += 1;

    questions.push({
      id,
      section: currentSectionId,
      ordre: questionOrdre[currentSectionId],
      libelle,
      type,
      options,
      ...(colonnes ? { colonnes } : {}),
      obligatoire: oblRaw === 'O',
      rempli_par: remplParRaw,
      condition: conditionRaw,
      glossaire: glossaireRaw === '-' ? [] : glossaireRaw.split(' ; ').map((g) => g.trim()),
      nsp_autorise: !NSP_EXCLUDED_TYPES.has(type) && !NSP_EXCLUDED_IDS.has(id),
    });
  }

  return { sections, questions };
}

async function main() {
  const sourcePath = join(ROOT, 'docs', '02_MODELE_RECUEIL_BESOINS.md');
  const markdown = await readFile(sourcePath, 'utf8');
  const result = parseQuestionnaire(markdown);

  const outPath = join(ROOT, 'data', 'questionnaire.json');
  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');

  console.log(`${result.sections.length} sections et ${result.questions.length} questions écrites dans data/questionnaire.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
