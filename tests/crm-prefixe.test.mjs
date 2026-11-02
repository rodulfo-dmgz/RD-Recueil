// Garde-fou : tout nom d'objet SQL utilisé par le code doit exister dans les migrations du module crm (source de
// vérité du modèle de données), avec le préfixe crm_.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DOSSIER_MIGRATIONS = 'supabase/modules/crm/migrations';
const install = fs
  .readdirSync(DOSSIER_MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => fs.readFileSync(path.join(DOSSIER_MIGRATIONS, f), 'utf8'))
  .join('\n');
const noms = (re) => new Set([...install.matchAll(re)].map((m) => m[1]));
const tables = noms(/^CREATE TABLE public\.(\w+)/gim);
const vues = noms(/^CREATE (?:OR REPLACE )?VIEW public\.(\w+)/gim);
const fonctions = noms(/^create (?:or replace )?function public\.(\w+)/gim);
const relations = new Set([...tables, ...vues]);

function fichiers(dossier, ext) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name);
    return e.isDirectory() ? fichiers(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}
const sources = [...fichiers('app/js', '.js'), ...fichiers('supabase/functions', '.ts')].map((f) => [f, fs.readFileSync(f, 'utf8')]);

test('les migrations du module ne contiennent que des objets préfixés crm_', () => {
  assert.ok(tables.size >= 30 && vues.size >= 3 && fonctions.size >= 40);
  for (const n of [...tables, ...vues, ...fonctions]) assert.match(n, /^crm_/, n);
});

test('chaque .from() du code vise une relation crm_ existante ou une table du noyau app_ (hors buckets de stockage)', () => {
  for (const [f, s] of sources) {
    for (const m of s.matchAll(/(storage\s*)?\.from\(\s*(['"])([\w-]+)\2/g)) {
      if (m[1]) continue; // bucket de stockage
      // Les tables du noyau (app_) ne sont lues que par les fonctions serveur (clé de service).
      if (f.includes('supabase') && /^app_(personnes|membres|droits)$/.test(m[3])) continue;
      assert.ok(relations.has(m[3]), `${f} : relation inconnue « ${m[3]} »`);
    }
  }
});

test('chaque .rpc() du code vise une fonction crm_ existante', () => {
  for (const [f, s] of sources) {
    for (const m of s.matchAll(/\.rpc\(\s*(['"])(\w+)\1/g)) assert.ok(fonctions.has(m[2]), `${f} : fonction inconnue « ${m[2]} »`);
  }
});

test('les jointures embarquées pointent vers des relations crm_ existantes', () => {
  for (const [f, s] of sources) {
    for (const m of s.matchAll(/\w+:(crm_\w+)(?:!\w+)?\(/g)) assert.ok(relations.has(m[1]), `${f} : jointure inconnue « ${m[1]} »`);
  }
});

test('plus aucune référence à crm_profils (remplacée par app_personnes et app_droits)', () => {
  for (const [f, s] of sources) assert.ok(!/crm_profils/.test(s), `${f} : référence à crm_profils`);
});

test('les buckets de stockage utilisés existent dans les migrations', () => {
  for (const [f, s] of sources) {
    for (const m of s.matchAll(/storage\s*\.from\(\s*(['"])([\w-]+)\1/g)) assert.ok(install.includes(`'${m[2]}'`), `${f} : bucket inconnu « ${m[2]} »`);
  }
});

test('le seed n\'insère que dans des tables du module', () => {
  const seed = fs.readFileSync('supabase/modules/crm/seed/seed_v1.sql', 'utf8');
  for (const m of seed.matchAll(/^insert into (?:public\.)?(\w+)/gim)) assert.ok(tables.has(m[1]), `seed : table inconnue « ${m[1]} »`);
});
