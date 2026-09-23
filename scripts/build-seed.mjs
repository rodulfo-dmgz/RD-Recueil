// data/*.json -> supabase/seed/seed_vX.sql

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlBool(value) {
  return value ? 'true' : 'false';
}

function sqlJsonb(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values) {
  if (!values || values.length === 0) return "'{}'::text[]";
  return `ARRAY[${values.map(sqlString).join(', ')}]::text[]`;
}

export function buildSeed({ questionnaire, glossaire, version, sourceHash, gabaritCadrageMd }) {
  const lines = [];
  lines.push(`-- Généré par scripts/build-seed.mjs -- ne pas modifier à la main.`);
  lines.push('');

  lines.push(`insert into questionnaires (id, statut, source_hash, gabarit_cadrage_md, publie_le) values`);
  lines.push(`  (${sqlString(version)}, 'publie', ${sqlString(sourceHash)}, ${sqlString(gabaritCadrageMd)}, now());`);
  lines.push('');

  lines.push(`insert into sections (questionnaire_id, id, partie, titre, ordre, condition, visible_client) values`);
  lines.push(
    questionnaire.sections
      .map(
        (s) =>
          `  (${sqlString(version)}, ${sqlString(s.id)}, ${s.partie}, ${sqlString(s.titre)}, ${s.ordre}, ${sqlString(s.condition)}, ${sqlBool(s.visible_client)})`
      )
      .join(',\n') + ';'
  );
  lines.push('');

  lines.push(
    `insert into questions (questionnaire_id, id, section_id, ordre, libelle, type, options, obligatoire, rempli_par, condition, glossaire, nsp_autorise) values`
  );
  lines.push(
    questionnaire.questions
      .map((q) => {
        const optionsValue = q.colonnes ? { colonnes: q.colonnes } : q.options;
        return `  (${sqlString(version)}, ${sqlString(q.id)}, ${sqlString(q.section)}, ${q.ordre}, ${sqlString(q.libelle)}, ${sqlString(q.type)}, ${sqlJsonb(optionsValue)}, ${sqlBool(q.obligatoire)}, ${sqlString(q.rempli_par)}, ${sqlString(q.condition)}, ${sqlTextArray(q.glossaire)}, ${sqlBool(q.nsp_autorise)})`;
      })
      .join(',\n') + ';'
  );
  lines.push('');

  lines.push(`insert into glossaire (questionnaire_id, id, libelle, categorie, definition, exemple) values`);
  lines.push(
    glossaire.termes
      .map(
        (t) =>
          `  (${sqlString(version)}, ${sqlString(t.id)}, ${sqlString(t.libelle)}, ${sqlString(t.categorie)}, ${sqlString(t.definition)}, ${sqlString(t.exemple)})`
      )
      .join(',\n') + ';'
  );
  lines.push('');

  return lines.join('\n');
}

async function computeSourceHash() {
  const files = [
    '02_MODELE_RECUEIL_BESOINS.md',
    '03_GLOSSAIRE.md',
    '04_MODELE_NOTE_DE_CADRAGE.md',
  ];
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(await readFile(join(ROOT, 'docs', file)));
  }
  return hash.digest('hex');
}

async function main() {
  const version = process.argv[2] || 'v1';

  const questionnaire = JSON.parse(await readFile(join(ROOT, 'data', 'questionnaire.json'), 'utf8'));
  const glossaire = JSON.parse(await readFile(join(ROOT, 'data', 'glossaire.json'), 'utf8'));
  const gabaritCadrageMd = await readFile(join(ROOT, 'docs', '04_MODELE_NOTE_DE_CADRAGE.md'), 'utf8');
  const sourceHash = await computeSourceHash();

  const sql = buildSeed({ questionnaire, glossaire, version, sourceHash, gabaritCadrageMd });

  const outPath = join(ROOT, 'supabase', 'seed', `seed_${version}.sql`);
  await writeFile(outPath, sql, 'utf8');

  console.log(`supabase/seed/seed_${version}.sql écrit (${questionnaire.sections.length} sections, ${questionnaire.questions.length} questions, ${glossaire.termes.length} termes)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
