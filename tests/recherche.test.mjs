import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LIMITE_PAR_GROUPE, rechercher, termeValide } from '../app/js/engine/recherche.js';

const clients = [
  { id: 'c1', raison_sociale: 'ABC Formation', nom_commercial: null, ville: 'Montpellier', siret: '825 186 786 00018', email_general: 'contact@abc.fr', telephone: '04 67 00 11 22' },
  { id: 'c2', raison_sociale: 'Société Générale du Sud', nom_commercial: 'SGS', ville: 'Nîmes', siret: '12345678900011', email_general: null, telephone: null },
  { id: 'c3', raison_sociale: 'Anatol Conseil', nom_commercial: null, ville: 'Paris', siret: null, email_general: null, telephone: null },
];
const contacts = [
  { id: 'k1', client_id: 'c1', prenom: 'Marie', nom: 'Dupont', email: 'marie.dupont@abc.fr', telephone: '06 11 22 33 44' },
  { id: 'k2', client_id: 'c2', prenom: '', nom: 'Martin', email: null, telephone: null },
];
const demandes = [
  { id: 'd1', reference: 'RDF-2026-0001', clients: { raison_sociale: 'ABC Formation' } },
  { id: 'd2', reference: 'RDF-2026-0002', clients: { raison_sociale: 'Anatol Conseil' } },
];
const factures = [
  { id: 'f1', demande_id: 'd1', numero: '12' },
  { id: 'f2', demande_id: 'zz', numero: null },
];
const donnees = { clients, contacts, demandes, factures };

const titres = (r, type) => r.groupes.find((g) => g.type === type)?.items.map((i) => i.titre) ?? [];

test('termeValide : au moins deux caractères utiles', () => {
  assert.equal(termeValide('ab'), true);
  assert.equal(termeValide(' a '), false);
  assert.equal(termeValide('!!'), false);
  assert.equal(termeValide(''), false);
  assert.equal(termeValide(null), false);
});

test('rechercher : terme trop court ou liste vide, aucun résultat', () => {
  assert.deepEqual(rechercher(donnees, 'a'), { total: 0, groupes: [] });
  assert.deepEqual(rechercher({}, 'abc'), { total: 0, groupes: [] });
  assert.deepEqual(rechercher(), { total: 0, groupes: [] });
});

test('rechercher : accents et casse ignorés, résultats groupés', () => {
  const r = rechercher(donnees, 'societe generale');
  assert.deepEqual(titres(r, 'clients'), ['Société Générale du Sud']);
  const abc = rechercher(donnees, 'ABC');
  assert.deepEqual(abc.groupes.map((g) => g.type), ['clients', 'contacts', 'demandes']);
  assert.deepEqual(titres(abc, 'clients'), ['ABC Formation']);
  assert.deepEqual(titres(abc, 'contacts'), ['Marie Dupont']); // par son e-mail
  assert.deepEqual(titres(abc, 'demandes'), ['RDF-2026-0001']); // par son client
  assert.equal(abc.total, 3);
});

test('rechercher : nom commercial, ville, e-mail, SIRET et téléphone', () => {
  assert.deepEqual(titres(rechercher(donnees, 'sgs'), 'clients'), ['Société Générale du Sud']);
  assert.deepEqual(titres(rechercher(donnees, 'nimes'), 'clients'), ['Société Générale du Sud']);
  assert.deepEqual(titres(rechercher(donnees, 'contact@abc'), 'clients'), ['ABC Formation']);
  assert.deepEqual(titres(rechercher(donnees, '82518678600018'), 'clients'), ['ABC Formation']); // sans espaces
  assert.deepEqual(titres(rechercher(donnees, '825 186'), 'clients'), ['ABC Formation']);
  assert.deepEqual(titres(rechercher(donnees, '0467001122'), 'clients'), ['ABC Formation']);
  assert.deepEqual(titres(rechercher(donnees, '06 11 22'), 'contacts'), ['Marie Dupont']);
});

test('rechercher : plusieurs mots, tous requis', () => {
  assert.deepEqual(titres(rechercher(donnees, 'marie dupont'), 'contacts'), ['Marie Dupont']);
  assert.deepEqual(titres(rechercher(donnees, 'dupont martin'), 'contacts'), []);
  assert.deepEqual(titres(rechercher(donnees, 'abc montpellier'), 'clients'), ['ABC Formation']);
  assert.deepEqual(titres(rechercher(donnees, 'abc lyon'), 'clients'), []);
});

test('rechercher : liens vers les fiches, les contacts, les demandes', () => {
  const r = rechercher(donnees, 'abc');
  assert.equal(r.groupes[0].items[0].href, '#/clients/c1');
  assert.equal(r.groupes[1].items[0].href, '#/clients/c1/contacts');
  assert.equal(r.groupes[2].items[0].href, '#/demandes/RDF-2026-0001');
  assert.equal(r.groupes[1].items[0].detail, 'ABC Formation · marie.dupont@abc.fr');
});

test('rechercher : factures par numéro, avec la demande liée', () => {
  const r = rechercher(donnees, '12');
  assert.deepEqual(titres(r, 'factures'), ['Facture n° 12']);
  assert.equal(r.groupes.find((g) => g.type === 'factures').items[0].href, '#/demandes/RDF-2026-0001');
  assert.deepEqual(titres(rechercher({ clients, contacts, demandes }, '12'), 'factures'), []); // pas fournies : pas cherchées
});

test('rechercher : meilleure correspondance d’abord, limite par groupe avec le total', () => {
  const beaucoup = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, raison_sociale: `Zeta ${i}`, ville: null }));
  const r = rechercher({ clients: [{ id: 'm', raison_sociale: 'Grand Zeta' }, ...beaucoup, { id: 'e', raison_sociale: 'Zeta' }] }, 'zeta');
  const g = r.groupes[0];
  assert.equal(g.total, 10);
  assert.equal(g.items.length, LIMITE_PAR_GROUPE);
  assert.equal(g.items[0].titre, 'Zeta'); // identique d'abord
  assert.ok(g.items.slice(1).every((i) => i.titre.startsWith('Zeta '))); // puis "commence par"
  assert.equal(rechercher({ clients: beaucoup }, 'zeta', { limite: 2 }).groupes[0].items.length, 2);
});
