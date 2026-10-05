import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COLONNES_DEMANDES, colonneDeStatut, colonnesKanbanDemandes, deplacerDemande, estStatutFinal, transitionsRapides } from '../app/js/engine/kanban-demandes.js';
import { LIBELLES_STATUT } from '../app/js/engine/statuts.js';

test('colonnes : tous les statuts connus sont rangés, une seule fois', () => {
  const rangés = COLONNES_DEMANDES.flatMap((c) => c.statuts);
  assert.equal(new Set(rangés).size, rangés.length);
  assert.deepEqual([...rangés].sort(), Object.keys(LIBELLES_STATUT).sort());
  assert.equal(colonneDeStatut('cadrage_a_revoir'), 'cadrage');
  assert.equal(colonneDeStatut('inconnu'), null);
});

test('transitionsRapides : réouvrir (soumise), réorienter (en analyse), abandonner, rien après la fin', () => {
  assert.deepEqual(transitionsRapides('soumise').map((t) => t.vers), ['en_saisie', 'abandonnee']);
  assert.deepEqual(transitionsRapides('en_analyse').map((t) => t.vers), ['reorientee', 'abandonnee']);
  assert.deepEqual(transitionsRapides('cadrage_envoye').map((t) => t.vers), ['abandonnee']);
  assert.ok(transitionsRapides('brouillon').every((t) => t.vers === 'abandonnee'));
  for (const f of ['gagnee', 'perdue', 'reorientee', 'abandonnee']) {
    assert.equal(estStatutFinal(f), true);
    assert.deepEqual(transitionsRapides(f), []);
  }
});

test('deplacerDemande : même colonne, déplacements permis avec confirmation de l’abandon', () => {
  assert.deepEqual(deplacerDemande('soumise', 'soumises'), { type: 'meme' });
  assert.deepEqual(deplacerDemande('soumise', 'a_demarrer'), { type: 'ok', vers: 'en_saisie', confirmation: undefined });
  assert.deepEqual(deplacerDemande('en_analyse', 'reorientee'), { type: 'ok', vers: 'reorientee', confirmation: undefined });
  const abandon = deplacerDemande('proposition_envoyee', 'abandonnee');
  assert.equal(abandon.type, 'ok');
  assert.equal(abandon.vers, 'abandonnee');
  assert.match(abandon.confirmation, /abandon/);
});

test('deplacerDemande : refus expliqués (décision client, étapes dédiées, demande terminée)', () => {
  assert.match(deplacerDemande('proposition_envoyee', 'gagnee').message, /client/);
  assert.match(deplacerDemande('cadrage_envoye', 'perdue').message, /client/);
  assert.match(deplacerDemande('soumise', 'reorientee').message, /analyse/);
  assert.match(deplacerDemande('en_analyse', 'cadrage').message, /ouvrez-la/);
  assert.match(deplacerDemande('soumise', 'analyse').message, /ouvrez-la/);
  assert.match(deplacerDemande('gagnee', 'a_demarrer').message, /terminée/);
  assert.deepEqual(deplacerDemande('abandonnee', 'abandonnee'), { type: 'meme' });
});

test('colonnesKanbanDemandes : répartition par colonne, récentes d’abord', () => {
  const d = (id, statut, created_at) => ({ id, statut, created_at });
  const colonnes = colonnesKanbanDemandes([d(1, 'soumise', '2026-10-01'), d(2, 'entretien_planifie', '2026-10-03'), d(3, 'gagnee', '2026-09-01'), d(4, 'en_saisie', '2026-10-02')]);
  assert.equal(colonnes.length, 9);
  assert.deepEqual(colonnes.find((c) => c.valeur === 'soumises').demandes.map((x) => x.id), [2, 1]);
  assert.deepEqual(colonnes.find((c) => c.valeur === 'a_demarrer').demandes.map((x) => x.id), [4]);
  assert.deepEqual(colonnes.find((c) => c.valeur === 'gagnee').demandes.map((x) => x.id), [3]);
  assert.deepEqual(colonnesKanbanDemandes(null).map((c) => c.demandes.length), Array(9).fill(0));
});
