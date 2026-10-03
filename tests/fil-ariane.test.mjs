import { test } from 'node:test';
import assert from 'node:assert/strict';

import { filAriane } from '../app/js/engine/fil-ariane.js';

const lib = (fil) => fil.map((s) => s.libelle);

test('filAriane : pages simples, le titre de repli est utilisé', () => {
  assert.deepEqual(filAriane('#/clients', { titreRepli: 'Clients' }), [{ libelle: 'Clients' }]);
  assert.deepEqual(lib(filAriane('#/', {})), ['RD Recueil']);
  assert.deepEqual(lib(filAriane('', { titreRepli: 'Tâches' })), ['Tâches']);
});

test('filAriane : fiche client, avec ou sans nom, et onglets', () => {
  assert.deepEqual(filAriane('#/clients/abc', { nomClient: 'ACCENTEUR' }), [{ libelle: 'Clients', href: '#/clients' }, { libelle: 'ACCENTEUR' }]);
  assert.deepEqual(lib(filAriane('#/clients/abc')), ['Clients', 'Fiche client']);
  assert.deepEqual(filAriane('#/clients/abc/contacts', { nomClient: 'ACCENTEUR' }), [
    { libelle: 'Clients', href: '#/clients' },
    { libelle: 'ACCENTEUR', href: '#/clients/abc' },
    { libelle: 'Contacts' },
  ]);
  assert.deepEqual(lib(filAriane('#/clients/nouveau')), ['Clients', 'Nouveau client']);
  assert.deepEqual(lib(filAriane('#/clients/doublons')), ['Clients', 'Doublons']);
  assert.deepEqual(lib(filAriane('#/clients/dormants')), ['Clients', 'Clients dormants']);
});

test('filAriane : demandes du personnel et étapes', () => {
  assert.deepEqual(lib(filAriane('#/demandes/FOR-2026-001')), ['Demandes', 'FOR-2026-001']);
  assert.deepEqual(filAriane('#/demandes/FOR-2026-001/cadrage'), [
    { libelle: 'Demandes', href: '#/demandes' },
    { libelle: 'FOR-2026-001', href: '#/demandes/FOR-2026-001' },
    { libelle: 'Note de cadrage' },
  ]);
  assert.deepEqual(lib(filAriane('#/demandes/nouvelle')), ['Demandes', 'Nouvelle demande']);
  assert.deepEqual(lib(filAriane('#/demandes/nouvelle/abc')), ['Demandes', 'Nouvelle demande']);
});

test('filAriane : espace client', () => {
  assert.deepEqual(filAriane('#/d/FOR-1'), [{ libelle: 'Mes demandes', href: '#/mes-demandes' }, { libelle: 'FOR-1' }]);
  assert.deepEqual(lib(filAriane('#/d/FOR-1/s/besoin')), ['Mes demandes', 'FOR-1', 'Questionnaire']);
  assert.deepEqual(lib(filAriane('#/d/FOR-1/recap')), ['Mes demandes', 'FOR-1', 'Récapitulatif']);
  assert.deepEqual(lib(filAriane('#/reclamation/REC-9')), ['Signaler un problème', 'REC-9']);
});
