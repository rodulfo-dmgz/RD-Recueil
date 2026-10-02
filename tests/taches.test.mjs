import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ajouterJours,
  classerTaches,
  estCleValide,
  fusionnerHistorique,
  joursDeRetard,
  libelleEcheance,
  libelleTypeActivite,
  preparerActivite,
  preparerTache,
  tachesVersJalons,
  validerActivite,
  validerTache,
  versChampDatetime,
} from '../app/js/engine/taches.js';
import { cleJour } from '../app/js/engine/jalons.js';

const MAINTENANT = new Date(2026, 9, 2, 10, 30); // vendredi 2 octobre 2026

test('ajouterJours : fin de mois, fin d’année, retour en arrière', () => {
  assert.equal(ajouterJours('2026-10-02', 3), '2026-10-05');
  assert.equal(ajouterJours('2026-10-30', 3), '2026-11-02');
  assert.equal(ajouterJours('2026-12-30', 3), '2027-01-02');
  assert.equal(ajouterJours('2026-03-01', -1), '2026-02-28');
  assert.equal(ajouterJours('2026-03-28', 2), '2026-03-30'); // changement d'heure
});

test('estCleValide', () => {
  assert.equal(estCleValide('2026-10-02'), true);
  assert.equal(estCleValide('2026-02-30'), false);
  assert.equal(estCleValide('02/10/2026'), false);
  assert.equal(estCleValide(null), false);
});

test('joursDeRetard : 0 si pas dépassée, sinon nombre de jours', () => {
  assert.equal(joursDeRetard('2026-10-02', MAINTENANT), 0);
  assert.equal(joursDeRetard('2026-10-05', MAINTENANT), 0);
  assert.equal(joursDeRetard('2026-10-01', MAINTENANT), 1);
  assert.equal(joursDeRetard('2026-09-22', MAINTENANT), 10);
});

test('libelleEcheance : retard, hier, aujourd’hui, demain, date', () => {
  assert.equal(libelleEcheance('2026-09-29', MAINTENANT), 'En retard de 3 jours');
  assert.equal(libelleEcheance('2026-10-01', MAINTENANT), 'Hier');
  assert.equal(libelleEcheance('2026-10-02', MAINTENANT), 'Aujourd’hui');
  assert.equal(libelleEcheance('2026-10-03', MAINTENANT), 'Demain');
  assert.match(libelleEcheance('2026-10-12', MAINTENANT), /12/);
});

test('classerTaches : seulement les tâches à faire, par groupe et par échéance', () => {
  const taches = [
    { id: 'a', titre: 'A', echeance: '2026-10-08', statut: 'a_faire', created_at: '2026-09-30T08:00:00Z' },
    { id: 'b', titre: 'B', echeance: '2026-10-02', statut: 'a_faire', created_at: '2026-09-30T09:00:00Z' },
    { id: 'c', titre: 'C', echeance: '2026-09-28', statut: 'a_faire', created_at: '2026-09-20T09:00:00Z' },
    { id: 'd', titre: 'D', echeance: '2026-10-09', statut: 'a_faire', created_at: '2026-09-30T10:00:00Z' },
    { id: 'e', titre: 'E', echeance: '2026-10-01', statut: 'terminee', created_at: '2026-09-30T10:00:00Z' },
    { id: 'f', titre: 'F', echeance: '2026-10-03', statut: 'annulee', created_at: '2026-09-30T10:00:00Z' },
    { id: 'g', titre: 'G', echeance: '2026-10-02', statut: 'a_faire', created_at: '2026-09-29T09:00:00Z' },
    { id: 'h', titre: 'H', echeance: '2026-10-03', statut: 'a_faire', created_at: '2026-09-29T09:00:00Z' },
  ];
  const g = classerTaches(taches, MAINTENANT);
  assert.deepEqual(g.enRetard.map((t) => t.id), ['c']);
  assert.deepEqual(g.aujourdhui.map((t) => t.id), ['g', 'b']); // même jour : la plus ancienne d'abord
  assert.deepEqual(g.semaine.map((t) => t.id), ['h', 'a']); // jusqu'au 8 octobre (6 jours)
  assert.deepEqual(g.plusTard.map((t) => t.id), ['d']);
});

test('preparerTache et validerTache', () => {
  const t = preparerTache({ titre: ' Relancer ', description: '', type: 'relance', echeance: '2026-10-08', contact_id: '', assignee_id: 'u1' });
  assert.deepEqual(t, { titre: 'Relancer', description: null, type: 'relance', echeance: '2026-10-08', contact_id: null, demande_id: null, assignee_id: 'u1' });
  assert.equal('assignee_id' in preparerTache({ titre: 'A', echeance: '2026-10-08' }), false);

  assert.deepEqual(validerTache({ titre: 'A', type: 'appel', echeance: '2026-10-08' }), {});
  assert.deepEqual(Object.keys(validerTache({ titre: ' ', type: 'inconnu', echeance: '' })).sort(), ['echeance', 'titre', 'type']);
  assert.equal(validerTache({ titre: 'A', echeance: '2026-02-30' }).echeance, 'Date invalide.');
});

test('preparerActivite et validerActivite', () => {
  const a = preparerActivite({ type: 'appel', objet: ' Appel ', description: '', date_activite: '2026-10-02T09:15' });
  assert.equal(a.objet, 'Appel');
  assert.equal(a.description, null);
  assert.equal(new Date(a.date_activite).getHours(), 9); // heure locale conservée
  assert.equal('date_activite' in preparerActivite({ objet: 'x' }), false);
  assert.equal(preparerActivite({ objet: 'x' }).type, 'note');

  assert.deepEqual(validerActivite({ objet: 'x', type: 'email' }), {});
  assert.deepEqual(Object.keys(validerActivite({ objet: '', type: 'zzz', date_activite: 'pas une date' })).sort(), ['date_activite', 'objet', 'type']);
});

test('fusionnerHistorique : échanges et étapes passées, du plus récent au plus ancien', () => {
  const activites = [
    { id: 'a1', type: 'appel', objet: 'Relance proposition', description: 'En attente RH', date_activite: '2026-10-01T09:00:00', demande_id: 'd1' },
    { id: 'a2', type: 'note', objet: 'Premier contact', description: null, date_activite: '2026-09-20T09:00:00' },
  ];
  const jalons = [
    { demande_id: 'd1', reference: 'RDF-1', type: 'creation', date: '2026-09-25T09:00:00' },
    { demande_id: 'd1', reference: 'RDF-1', type: 'echeance', date: '2026-09-30T00:00:00' },
    { demande_id: 'd1', reference: 'RDF-1', type: 'entretien', date: '2026-10-20T10:00:00' },
  ];
  const h = fusionnerHistorique(activites, jalons, MAINTENANT);
  assert.deepEqual(h.map((e) => e.genre + ':' + e.titre), ['activite:Relance proposition', 'etape:Demande créée', 'activite:Premier contact']);
  assert.equal(h[0].detail, 'En attente RH');
  assert.equal(h[1].reference, 'RDF-1');
});

test('tachesVersJalons : tâches à faire seulement, au jour d’échéance', () => {
  const jalons = tachesVersJalons([
    { client_id: 'c1', titre: 'Relancer', echeance: '2026-10-08', statut: 'a_faire', clients: { raison_sociale: 'ACME' } },
    { client_id: 'c1', titre: 'Fait', echeance: '2026-10-08', statut: 'terminee' },
  ]);
  assert.equal(jalons.length, 1);
  assert.equal(jalons[0].type, 'tache');
  assert.equal(jalons[0].libelle, 'Relancer');
  assert.equal(jalons[0].reference, 'ACME');
  assert.equal(cleJour(jalons[0].date), '2026-10-08');
  assert.equal(jalons[0].href, '#/clients/c1/activite');
});

test('libelleTypeActivite', () => {
  assert.equal(libelleTypeActivite('rendez_vous'), 'Rendez-vous');
  assert.equal(libelleTypeActivite('inconnu'), 'inconnu');
});

test('versChampDatetime : heure locale, compatible avec preparerActivite', () => {
  assert.equal(versChampDatetime(new Date(2026, 9, 2, 9, 5)), '2026-10-02T09:05');
  const ligne = preparerActivite({ objet: 'x', date_activite: versChampDatetime(new Date(2026, 9, 2, 9, 5)) });
  assert.equal(new Date(ligne.date_activite).getMinutes(), 5);
});
