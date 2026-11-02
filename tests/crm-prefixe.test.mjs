// Garde-fou : tout nom d'objet SQL utilisé par le code doit exister dans le script d'installation, avec le préfixe crm_.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const install = fs.readFileSync('supabase/migrations/20261007000000_crm_install.sql', 'utf8');
const noms = (re) => new Set([...install.matchAll(re)].map((m) => m[1]));
const tables = noms(/^CREATE TABLE public\.(\w+)/gim);
const vues = noms(/^CREATE (?:OR REPLACE )?VIEW public\.(\w+)/gim);
const fonctions = noms(/^CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gim);
const relations = new Set([...tables, ...vues]);

function fichiers(dossier, ext) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name);
    return e.isDirectory() ? fichiers(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}
const sources = [...fichiers('app/js', '.js'), ...fichiers('supabase/functions', '.ts')].map((f) => [f, fs.readFileSync(f, 'utf8')]);

test('le script d\'installation ne contient que des objets préfixés crm_', () => {
  assert.ok(tables.size >= 30 && vues.size >= 3 && fonctions.size >= 40);
  for (const n of [...tables, ...vues, ...fonctions]) assert.match(n, /^crm_/, n);
});

test('chaque .from() du code vise une relation crm_ existante (hors buckets de stockage)', () => {
  for (const [f, s] of sources) {
    for (const m of s.matchAll(/(storage\s*)?\.from\(\s*(['"])(\w+)\2/g)) {
      if (m[1]) continue; // bucket de stockage, nom inchangé
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

test('les buckets de stockage utilisés existent dans le script', () => {
  for (const [f, s] of sources) {
    for (const m of s.matchAll(/storage\s*\.from\(\s*(['"])(\w+)\1/g)) assert.ok(install.includes(`'${m[2]}'`), `${f} : bucket inconnu « ${m[2]} »`);
  }
});

test('le seed n\'insère que dans des tables du script d\'installation', () => {
  const seed = fs.readFileSync('supabase/seed/seed_v1.sql', 'utf8');
  for (const m of seed.matchAll(/^insert into (?:public\.)?(\w+)/gim)) assert.ok(tables.has(m[1]), `seed : table inconnue « ${m[1]} »`);
});
