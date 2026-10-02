import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  libelleJalon, categorieJalon, cleJour, jalonsParJour, grilleMois, grouperParDemande,
  delaisDemande, calculerKpis, formaterDelai, chronologie,
} from '../app/js/engine/jalons.js';

const j = (demande_id, type, date) => ({ demande_id, reference: `R-${demande_id}`, client: 'ACME', type, date });

const PARCOURS = [
  j('a', 'creation', '2026-10-01T08:00:00'),
  j('a', 'envoyee', '2026-10-01T10:00:00'),
  j('a', 'soumise', '2026-10-03T10:00:00'),
  j('a', 'entretien_planifie', '2026-10-04T10:00:00'),
  j('a', 'en_analyse', '2026-10-06T10:00:00'),
  j('a', 'cadrage_envoye', '2026-10-07T10:00:00'),
  j('a', 'cadrage_valide', '2026-10-08T10:00:00'),
  j('a', 'proposition_envoyee', '2026-10-10T10:00:00'),
  j('a', 'gagnee', '2026-10-13T10:00:00'),
];

test('libelleJalon : libellé connu, sinon le type brut', () => {
  assert.equal(libelleJalon('soumise'), 'Réponses envoyées');
  assert.equal(libelleJalon('inconnu'), 'inconnu');
});

test('categorieJalon : échéance, rendez-vous à venir, fait', () => {
  const maintenant = new Date('2026-10-05T00:00:00');
  assert.equal(categorieJalon(j('a', 'echeance', '2026-10-20'), maintenant), 'echeance');
  assert.equal(categorieJalon(j('a', 'entretien', '2026-10-09T10:00:00'), maintenant), 'avenir');
  assert.equal(categorieJalon(j('a', 'entretien', '2026-10-01T10:00:00'), maintenant), 'fait');
  assert.equal(categorieJalon(j('a', 'soumise', '2026-10-01T10:00:00'), maintenant), 'fait');
});

test('jalonsParJour : regroupe par jour local, trié', () => {
  const parJour = jalonsParJour([j('a', 'soumise', '2026-10-03T15:00:00'), j('a', 'envoyee', '2026-10-03T09:00:00')]);
  assert.deepEqual(parJour.get('2026-10-03').map((x) => x.type), ['envoyee', 'soumise']);
});

test('cleJour : AAAA-MM-JJ', () => {
  assert.equal(cleJour(new Date(2026, 9, 2)), '2026-10-02');
});

test('grilleMois : octobre 2026 commence un jeudi, semaines complètes du lundi', () => {
  const semaines = grilleMois(2026, 9);
  assert.ok(semaines.every((s) => s.length === 7));
  assert.deepEqual(semaines[0].map((c) => c?.jour ?? null), [null, null, null, 1, 2, 3, 4]);
  const jours = semaines.flat().filter(Boolean);
  assert.equal(jours.length, 31);
  assert.equal(jours.at(-1).cle, '2026-10-31');
});

test('grouperParDemande : un groupe par demande, jalons triés', () => {
  const groupes = grouperParDemande([j('b', 'soumise', '2026-10-05'), j('a', 'creation', '2026-10-01'), j('b', 'creation', '2026-10-02')]);
  assert.equal(groupes.length, 2);
  assert.deepEqual(groupes.find((g) => g.demande_id === 'b').jalons.map((x) => x.type), ['creation', 'soumise']);
});

test('delaisDemande : délais entre étapes clés en jours', () => {
  const d = delaisDemande(PARCOURS);
  assert.equal(d.reponseClient, 2 / 1);
  assert.equal(d.priseRdv, 1);
  assert.equal(d.redactionNote, 1);
  assert.equal(d.signatureNote, 1);
  assert.equal(d.decisionProposition, 3);
  assert.ok(Math.abs(d.total - (12 + 2 / 24)) < 1e-9);
});

test('delaisDemande : étapes manquantes -> null, pas de durée totale en cours', () => {
  const d = delaisDemande([j('a', 'creation', '2026-10-01'), j('a', 'envoyee', '2026-10-01'), j('a', 'soumise', '2026-10-03')]);
  assert.equal(d.reponseClient, 2);
  assert.equal(d.priseRdv, null);
  assert.equal(d.total, null);
});

test('delaisDemande : demande réorientée puis rouverte n\'est pas terminée', () => {
  const d = delaisDemande([j('a', 'creation', '2026-10-01'), j('a', 'reorientee', '2026-10-02'), j('a', 'en_analyse', '2026-10-03')]);
  assert.equal(d.total, null);
});

test('calculerKpis : moyennes, conversion et demandes en cours', () => {
  const autre = [j('b', 'creation', '2026-10-01'), j('b', 'envoyee', '2026-10-01T00:00:00'), j('b', 'soumise', '2026-10-05T00:00:00'), j('b', 'perdue', '2026-10-09')];
  const kpis = calculerKpis(grouperParDemande([...PARCOURS, ...autre]));
  assert.equal(kpis.total, 2);
  assert.equal(kpis.enCours, 0);
  assert.equal(kpis.delais.reponseClient.n, 2);
  assert.equal(kpis.delais.reponseClient.moyenne, 3);
  assert.equal(kpis.conversion.gagnees, 1);
  assert.equal(kpis.conversion.perdues, 1);
  assert.equal(kpis.conversion.taux, 0.5);
});

test('calculerKpis : sans données, aucune moyenne ni taux', () => {
  const kpis = calculerKpis([]);
  assert.equal(kpis.delais.reponseClient.moyenne, null);
  assert.equal(kpis.conversion.taux, null);
});

test('formaterDelai', () => {
  assert.equal(formaterDelai(null), '-');
  assert.equal(formaterDelai(0.01), '< 1 h');
  assert.equal(formaterDelai(0.25), '6 h');
  assert.equal(formaterDelai(2), '2 j');
  assert.equal(formaterDelai(3.456), '3,5 j');
});

test('chronologie : délai depuis le jalon précédent', () => {
  const c = chronologie([j('a', 'soumise', '2026-10-03T10:00:00'), j('a', 'creation', '2026-10-01T10:00:00')]);
  assert.equal(c[0].libelle, 'Demande créée');
  assert.equal(c[0].delaiDepuisPrecedent, null);
  assert.equal(c[1].delaiDepuisPrecedent, 2);
});
