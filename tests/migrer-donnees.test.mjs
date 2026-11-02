import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { TABLES_DONNEES, TABLES_SEED, genererSql } from '../scripts/migrer-donnees.mjs';

const install = fs.readFileSync('supabase/migrations/20261007000000_crm_install.sql', 'utf8');
const tablesInstall = [...install.matchAll(/^CREATE TABLE public\.crm_(\w+)/gim)].map((m) => m[1]).sort();

test('les listes du script couvrent exactement les tables du script d\'installation', () => {
  assert.deepEqual([...TABLES_DONNEES, ...TABLES_SEED].sort(), tablesInstall);
});

test('genererSql : renomme en crm_, force le changement de mot de passe, exclut les colonnes calculees', () => {
  const sql = genererSql({
    profils: [{ user_id: 'u1', role: 'admin', email: 'a@x.fr', nom: null, doit_changer_mot_de_passe: false }],
    proposition_lignes: [{ id: 'l1', designation: 'x', quantite: 2, prix_unitaire: 5, total: 10 }],
    audit_log: [{ id: 1, table_name: 'clients' }],
  });
  assert.match(sql, /insert into public\."crm_profils"/);
  assert.match(sql, /"doit_changer_mot_de_passe":true/);
  assert.doesNotMatch(sql, /"total"/);
  assert.match(sql, /"crm_audit_log" \("id", "table_name"\) overriding system value/);
  assert.match(sql, /set local session_replication_role = replica/);
  assert.match(sql, /select 'crm_clients' as table_, 0 as attendu/);
});

test('genererSql : une donnee contenant le delimiteur dollar ne casse pas le script', () => {
  const sql = genererSql({ clients: [{ id: 'c1', raison_sociale: 'A $rd$ B' }] });
  assert.match(sql, /\$rdx\$\[/);
});
