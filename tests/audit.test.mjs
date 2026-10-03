import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TABLES_AUDIT,
  formaterValeurAudit,
  libelleAction,
  libelleColonne,
  libelleTable,
  lienEntree,
  phraseEntree,
  resumerChangements,
} from '../app/js/engine/audit.js';

test('libellés des tables et des actions, valeur inconnue rendue telle quelle', () => {
  assert.equal(libelleTable('clients'), 'Clients');
  assert.equal(libelleTable('activites'), 'Échanges');
  assert.equal(libelleTable('autre_table'), 'autre_table');
  assert.equal(libelleAction('insert'), 'Création');
  assert.equal(libelleAction('update'), 'Modification');
  assert.equal(libelleAction('delete'), 'Suppression');
  assert.equal(libelleAction('x'), 'x');
  assert.ok(TABLES_AUDIT.every((t) => t.valeur && t.libelle));
});

test('phraseEntree : auteur, verbe, objet avec son article, nom', () => {
  const base = { auteur: 'Marie Dupont', libelle: 'ABC Formation' };
  assert.equal(phraseEntree({ ...base, action: 'update', table_name: 'clients' }), 'Marie Dupont a modifié un client : ABC Formation');
  assert.equal(phraseEntree({ ...base, action: 'insert', table_name: 'taches', libelle: 'Relancer ABC' }), 'Marie Dupont a créé une tâche : Relancer ABC');
  assert.equal(phraseEntree({ ...base, action: 'delete', table_name: 'factures', libelle: 'n° 3' }), 'Marie Dupont a supprimé une facture : n° 3');
  assert.equal(phraseEntree({ auteur: 'Système', action: 'update', table_name: 'demande_enjeux' }), 'Système a modifié l\'enjeu d\'une demande');
  assert.equal(phraseEntree({ action: 'update', table_name: 'inconnue' }), 'Quelqu’un a modifié un élément (inconnue)');
});

test('libelleColonne : libellés connus, sinon le nom lisible', () => {
  assert.equal(libelleColonne('raison_sociale'), 'Raison sociale');
  assert.equal(libelleColonne('date_paiement'), 'Date de paiement');
  assert.equal(libelleColonne('nouvelle_colonne_x'), 'Nouvelle colonne x');
});

test('formaterValeurAudit : vide, booléens, listes, dates, comptes, identifiants, textes longs', () => {
  assert.equal(formaterValeurAudit('ville', null), 'vide');
  assert.equal(formaterValeurAudit('ville', ''), 'vide');
  assert.equal(formaterValeurAudit('principal', true), 'oui');
  assert.equal(formaterValeurAudit('actif', false), 'non');
  assert.equal(formaterValeurAudit('roles', ['rh', 'decideur']), 'rh, decideur');
  assert.equal(formaterValeurAudit('roles', []), 'vide');
  assert.equal(formaterValeurAudit('date_paiement', '2026-10-03'), '03/10/2026');
  assert.match(formaterValeurAudit('terminee_le', '2026-10-03T09:30:00+00:00'), /^\d{2}\/\d{2}\/\d{4}/);
  assert.equal(formaterValeurAudit('montant', 1500), '1500');
  const id = '11111111-2222-3333-4444-555555555555';
  assert.equal(formaterValeurAudit('responsable_id', id, { [id]: 'Marie Dupont' }), 'Marie Dupont');
  assert.equal(formaterValeurAudit('responsable_id', id), 'compte 11111111');
  assert.equal(formaterValeurAudit('client_id', id), '11111111…');
  const long = 'x'.repeat(200);
  assert.equal(formaterValeurAudit('notes', long).length, 141);
  assert.equal(formaterValeurAudit('ville', long).length, 200); // seules les colonnes de texte long sont coupées
});

test('resumerChangements : modification, création (sans avant), suppression (sans après), identifiant ignoré', () => {
  const maj = resumerChangements({ action: 'update', changes: { ville: ['Paris', 'Lyon'], siret: [null, '82518678600018'] } });
  assert.deepEqual(maj, [
    { colonne: 'ville', libelle: 'Ville', avant: 'Paris', apres: 'Lyon' },
    { colonne: 'siret', libelle: 'SIRET', avant: 'vide', apres: '82518678600018' },
  ]);
  const creation = resumerChangements({ action: 'insert', changes: { id: [null, 'x'], raison_sociale: [null, 'ABC'] } });
  assert.deepEqual(creation, [{ colonne: 'raison_sociale', libelle: 'Raison sociale', avant: null, apres: 'ABC' }]);
  const suppression = resumerChangements({ action: 'delete', changes: { raison_sociale: ['ABC', null] } });
  assert.deepEqual(suppression, [{ colonne: 'raison_sociale', libelle: 'Raison sociale', avant: 'ABC', apres: null }]);
  assert.deepEqual(resumerChangements({ action: 'update' }), []);
});

test('lienEntree : fiche client, demande par sa référence, contexte client, rien après suppression de la fiche', () => {
  assert.equal(lienEntree({ action: 'update', table_name: 'clients', record_id: 'c1' }), '#/clients/c1');
  assert.equal(lienEntree({ action: 'update', table_name: 'demandes', libelle: 'RDF-2026-0001', client_id: 'c1' }), '#/demandes/RDF-2026-0001');
  assert.equal(lienEntree({ action: 'insert', table_name: 'contacts', client_id: 'c1' }), '#/clients/c1');
  assert.equal(lienEntree({ action: 'insert', table_name: 'taches' }), null);
  assert.equal(lienEntree({ action: 'delete', table_name: 'clients', record_id: 'c1', client_id: 'c1' }), null); // fiche supprimée
  assert.equal(lienEntree({ action: 'delete', table_name: 'contacts', client_id: 'c1' }), '#/clients/c1');
});
