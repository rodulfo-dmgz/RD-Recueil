// docs/03_GLOSSAIRE.md -> data/glossaire.json
// Format de chaque entrée (03_GLOSSAIRE.md, en-tête du document) :
//   ### Libellé affiché
//   `identifiant` · Catégorie
//   **Définition.** Texte.
//   **Exemple.** Texte.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ID_LINE_RE = /^`([a-z0-9-]+)`\s*·\s*(.+)$/;
const DEFINITION_RE = /^\*\*Définition\.\*\*\s*(.+)$/;
const EXEMPLE_RE = /^\*\*Exemple\.\*\*\s*(.+)$/;

function nextNonBlank(lines, from) {
  let j = from;
  while (j < lines.length && lines[j].trim() === '') j++;
  return j;
}

export function parseGlossaire(markdown) {
  const lines = markdown.split('\n');
  const termes = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('### ')) continue;

    const libelle = line.slice(4).trim();

    let j = nextNonBlank(lines, i + 1);
    const idLine = j < lines.length ? lines[j].trim() : '';
    const idMatch = idLine.match(ID_LINE_RE);
    if (!idMatch) {
      throw new Error(`Entrée glossaire malformée après "${libelle}" : ligne identifiant/catégorie introuvable`);
    }
    const id = idMatch[1];
    const categorie = idMatch[2].trim();

    j = nextNonBlank(lines, j + 1);
    const defLine = j < lines.length ? lines[j].trim() : '';
    const defMatch = defLine.match(DEFINITION_RE);
    if (!defMatch) {
      throw new Error(`Définition manquante pour le terme "${id}"`);
    }
    const definition = defMatch[1].trim();

    j = nextNonBlank(lines, j + 1);
    const exLine = j < lines.length ? lines[j].trim() : '';
    const exMatch = exLine.match(EXEMPLE_RE);
    if (!exMatch) {
      throw new Error(`Exemple manquant pour le terme "${id}"`);
    }
    const exemple = exMatch[1].trim();

    termes.push({ id, libelle, categorie, definition, exemple });
  }

  return { termes };
}

async function main() {
  const sourcePath = join(ROOT, 'docs', '03_GLOSSAIRE.md');
  const markdown = await readFile(sourcePath, 'utf8');
  const result = parseGlossaire(markdown);

  const outPath = join(ROOT, 'data', 'glossaire.json');
  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');

  console.log(`${result.termes.length} termes écrits dans data/glossaire.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
