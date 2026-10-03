import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SEUILS_DORMANT, clientsDormants, libelleInactivite, moisEcoules, preparerRelanceDormant } from '../app/js/engine/dormants.js';

const MAINTENANT = new Date(2026, 9, 3, 12, 0); // 3 octobre 2026

const c = (id, derniere_activite, extra = {}) => ({
  id,
  raison_sociale: `Client ${id}`,
  statut: 'client',
  nb_gagnees: 1,
  nb_actives: 0,
  ca_signe: 1000,
  derniere_activite,
  ...extra,
});

test('moisEcoules : mois entiers, jamais négatif', () => {
  assert.equal(moisEcoules('2025-10-03T09:00:00', MAINTENANT), 12);
  assert.equal(moisEcoules('2025-10-04T09:00:00', MAINTENANT), 11); // un jour avant l'anniversaire
  assert.equal(moisEcoules('2026-09-15T09:00:00', MAINTENANT), 0);
  assert.equal(moisEcoules('2027-01-01T09:00:00', MAINTENANT), 0); // date future
  assert.equal(moisEcoules('2024-08-01T09:00:00', MAINTENANT), 26);
});

test('libelleInactivite', () => {
  assert.equal(libelleInactivite(14), '14 mois');
  assert.equal(libelleInactivite(1), '1 mois');
  assert.equal(libelleInactivite(0), 'moins d’un mois');
});

test('seuils proposés', () => {
  assert.deepEqual(SEUILS_DORMANT, [6, 9, 12, 18, 24]);
});

test('clientsDormants : seuil de 12 mois par défaut, les plus anciens d’abord', () => {
  const clients = [
    c('recent', '2026-08-01T09:00:00'), // 2 mois
    c('limite', '2025-10-03T09:00:00'), // 12 mois pile
    c('ancien', '2024-08-01T09:00:00'), // 26 mois
    c('moyen', '2025-06-10T09:00:00'), // 15 mois
  ];
  const r = clientsDormants(clients, { maintenant: MAINTENANT });
  assert.deepEqual(r.map((x) => x.id), ['ancien', 'moyen', 'limite']);
  assert.deepEqual(r.map((x) => x.moisInactifs), [26, 15, 12]);
});

test('clientsDormants : le seuil choisi change la liste', () => {
  const clients = [c('a', '2026-03-01T09:00:00'), c('b', '2025-01-01T09:00:00')]; // 7 et 21 mois
  assert.deepEqual(clientsDormants(clients, { mois: 6, maintenant: MAINTENANT }).map((x) => x.id), ['b', 'a']);
  assert.deepEqual(clientsDormants(clients, { mois: 18, maintenant: MAINTENANT }).map((x) => x.id), ['b']);
});

test('clientsDormants : ni prospects, ni archivés, ni clients sans vente ou avec une demande en cours', () => {
  const vieux = '2024-01-01T09:00:00';
  const clients = [
    c('prospect', vieux, { statut: 'prospect' }),
    c('archive', vieux, { statut: 'archive' }),
    c('jamais-achete', vieux, { nb_gagnees: 0 }),
    c('en-cours', vieux, { nb_actives: 1 }),
    c('sans-date', null),
    c('ok', vieux),
  ];
  assert.deepEqual(clientsDormants(clients, { maintenant: MAINTENANT }).map((x) => x.id), ['ok']);
  assert.deepEqual(clientsDormants(undefined, { maintenant: MAINTENANT }), []);
});

test('clientsDormants : les nombres venus de la base en texte sont acceptés', () => {
  const r = clientsDormants([c('t', '2024-01-01T09:00:00', { nb_gagnees: '2', nb_actives: '0' })], { maintenant: MAINTENANT });
  assert.equal(r.length, 1);
});

test('preparerRelanceDormant : tâche du jour, type relance, responsable facultatif', () => {
  const client = c('x', '2025-06-10T09:00:00', { raison_sociale: 'ABC Formation' });
  const t = preparerRelanceDormant(client, { maintenant: MAINTENANT });
  assert.equal(t.titre, 'Relancer ABC Formation');
  assert.equal(t.type, 'relance');
  assert.equal(t.echeance, '2026-10-03');
  assert.equal(t.description, 'Client dormant : dernière activité il y a 15 mois.');
  assert.equal('assignee_id' in t, false);
  assert.equal(preparerRelanceDormant(client, { assigneeId: 'u1', maintenant: MAINTENANT }).assignee_id, 'u1');
});
