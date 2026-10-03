import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  avisParMoment,
  etoiles,
  kpisSatisfaction,
  libelleMoment,
  libelleStatutSatisfaction,
  lireNote,
  preparerReponse,
  validerReponse,
} from '../app/js/engine/satisfactions.js';

const avis = (moment, statut, note = null) => ({ moment, statut, note });

test('libellés des moments et des statuts', () => {
  assert.equal(libelleMoment('chaud'), 'À chaud');
  assert.equal(libelleMoment('froid'), 'À froid');
  assert.equal(libelleMoment('x'), 'x');
  assert.equal(libelleStatutSatisfaction('demandee'), 'En attente de réponse');
  assert.equal(libelleStatutSatisfaction('recue'), 'Reçu');
});

test('etoiles : de 0 à 5, bornées', () => {
  assert.equal(etoiles(4), '★★★★☆');
  assert.equal(etoiles(5), '★★★★★');
  assert.equal(etoiles(1), '★☆☆☆☆');
  assert.equal(etoiles(0), '☆☆☆☆☆');
  assert.equal(etoiles(9), '★★★★★');
  assert.equal(etoiles(null), '☆☆☆☆☆');
});

test('lireNote : entier de 1 à 5 seulement', () => {
  assert.equal(lireNote('4'), 4);
  assert.equal(lireNote(5), 5);
  assert.equal(lireNote('1'), 1);
  assert.equal(lireNote('0'), null);
  assert.equal(lireNote('6'), null);
  assert.equal(lireNote('3.5'), null);
  assert.equal(lireNote(''), null);
  assert.equal(lireNote(null), null);
  assert.equal(lireNote('abc'), null);
});

test('validerReponse et preparerReponse', () => {
  assert.deepEqual(validerReponse({ note: '3' }), {});
  assert.ok(validerReponse({ note: '' }).note);
  assert.ok(validerReponse({ note: '8' }).note);
  assert.deepEqual(preparerReponse({ note: '4', commentaire: '  Très bien  ' }), { note: 4, commentaire: 'Très bien' });
  assert.deepEqual(preparerReponse({ note: 2, commentaire: '   ' }), { note: 2, commentaire: null });
});

test('avisParMoment : un avis ou null par moment', () => {
  const r = avisParMoment([avis('froid', 'demandee')]);
  assert.equal(r.chaud, null);
  assert.equal(r.froid.statut, 'demandee');
  assert.deepEqual(avisParMoment(), { chaud: null, froid: null });
});

test('kpisSatisfaction : moyenne des notes reçues, taux de réponse, détail par moment', () => {
  const k = kpisSatisfaction([
    avis('chaud', 'recue', 5),
    avis('chaud', 'recue', 4),
    avis('chaud', 'demandee'),
    avis('froid', 'recue', 3),
    avis('froid', 'sans_reponse'),
  ]);
  assert.equal(k.total, 5);
  assert.equal(k.recus, 3);
  assert.equal(k.enAttente, 1);
  assert.equal(k.sansReponse, 1);
  assert.equal(k.moyenne, 4);
  assert.equal(k.tauxReponse, 0.6);
  assert.deepEqual(k.parMoment, { chaud: { total: 3, recus: 2, moyenne: 4.5 }, froid: { total: 2, recus: 1, moyenne: 3 } });
});

test('kpisSatisfaction : aucun avis, ou aucun reçu', () => {
  assert.deepEqual(kpisSatisfaction(), {
    total: 0,
    recus: 0,
    enAttente: 0,
    sansReponse: 0,
    moyenne: null,
    tauxReponse: null,
    parMoment: { chaud: { total: 0, recus: 0, moyenne: null }, froid: { total: 0, recus: 0, moyenne: null } },
  });
  const k = kpisSatisfaction([avis('chaud', 'demandee')]);
  assert.equal(k.moyenne, null);
  assert.equal(k.tauxReponse, 0);
  assert.equal(kpisSatisfaction([avis('chaud', 'recue', 4), avis('chaud', 'recue', 3)]).moyenne, 3.5);
  assert.equal(kpisSatisfaction([avis('chaud', 'recue', 5), avis('froid', 'recue', 4), avis('froid', 'recue', 4)]).moyenne, 4.3); // 13/3 arrondi à 0,1
});

test('export CSV des avis : une ligne par avis, en-têtes et valeurs lisibles', async () => {
  const { COLONNES_CSV_AVIS } = await import('../app/js/engine/satisfactions.js');
  const { genererCsv } = await import('../app/js/engine/csv.js');
  const csv = genererCsv(
    [
      { moment: 'chaud', statut: 'recue', note: 4, commentaire: 'Très bien; merci', date_envoi: '2026-10-01', date_reponse: '2026-10-03', origine: 'client', demandes: { reference: 'RDF-1' }, clients: { raison_sociale: 'ABC' } },
      { moment: 'froid', statut: 'demandee', note: null, commentaire: null, date_envoi: '2026-10-01', date_reponse: null, origine: null, demandes: null, clients: null },
    ],
    COLONNES_CSV_AVIS,
  );
  const lignes = csv.split('\r\n');
  assert.equal(lignes[0], 'Demande;Client;Moment;Statut;Date d’envoi;Date de réponse;Note (sur 5);Commentaire;Réponse saisie par');
  assert.equal(lignes[1], 'RDF-1;ABC;À chaud;Reçu;01/10/2026;03/10/2026;4;"Très bien; merci";Le client');
  assert.equal(lignes[2], ';;À froid;En attente de réponse;01/10/2026;;;;');
});
