import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  estPayee,
  facturationParMois,
  kpisFacturation,
  resteAFacturerGagnees,
  formaterDateCourte,
  libelleStatutFinancement,
  libelleTypeFinancement,
  preparerFacture,
  preparerFinancement,
  syntheseFacturation,
  syntheseFinancements,
  validerFacture,
  validerFinancement,
} from '../app/js/engine/facturation.js';

const fin = (statut, montant) => ({ statut, montant });
const fac = (montant_ht, date_paiement = null) => ({ montant_ht, date_paiement });

test('libellés des types et statuts, valeur inconnue rendue telle quelle', () => {
  assert.equal(libelleTypeFinancement('opco'), 'OPCO');
  assert.equal(libelleTypeFinancement('france_travail'), 'France Travail');
  assert.equal(libelleTypeFinancement('x'), 'x');
  assert.equal(libelleStatutFinancement('accorde'), 'Accordé');
  assert.equal(libelleStatutFinancement(null), '');
});

test('preparerFinancement : virgule décimale, textes vides en null, statut par défaut', () => {
  assert.deepEqual(
    preparerFinancement({ type: 'opco', organisme: ' Atlas ', reference_dossier: '', montant: '1 250,5', statut: '', note: '  ' }),
    { type: 'opco', organisme: 'Atlas', reference_dossier: null, montant: 1250.5, statut: 'en_attente', note: null },
  );
  assert.equal(preparerFinancement({ type: 'opco', montant: 'abc' }).montant, null);
  assert.equal(preparerFinancement({ type: 'opco', montant: '' }).montant, null);
});

test('validerFinancement : type, montant et statut', () => {
  assert.deepEqual(validerFinancement({ type: 'region', montant: '0' }), {});
  assert.deepEqual(validerFinancement({ type: 'region', montant: '500', statut: 'verse' }), {});
  assert.ok(validerFinancement({ type: '', montant: '10' }).type);
  assert.ok(validerFinancement({ type: 'inconnu', montant: '10' }).type);
  assert.ok(validerFinancement({ type: 'opco', montant: '' }).montant);
  assert.ok(validerFinancement({ type: 'opco', montant: '-5' }).montant);
  assert.ok(validerFinancement({ type: 'opco', montant: 'abc' }).montant);
  assert.ok(validerFinancement({ type: 'opco', montant: '5', statut: 'zzz' }).statut);
});

test('preparerFacture : numéro et libellé nettoyés, dates conservées', () => {
  assert.deepEqual(
    preparerFacture({ numero: ' F-2026-014 ', libelle: 'Acompte 50 %', montant_ht: '2 400', date_emission: '2026-10-01', date_paiement: '' }),
    { numero: 'F-2026-014', libelle: 'Acompte 50 %', montant_ht: 2400, date_emission: '2026-10-01', date_paiement: null },
  );
  assert.equal(preparerFacture({ numero: '  ', montant_ht: '10' }).numero, null);
});

test('validerFacture : montant, date d’émission, ordre des dates', () => {
  assert.deepEqual(validerFacture({ montant_ht: '100', date_emission: '2026-10-01' }), {});
  assert.deepEqual(validerFacture({ montant_ht: '100', date_emission: '2026-10-01', date_paiement: '2026-10-01' }), {});
  assert.ok(validerFacture({ montant_ht: '', date_emission: '2026-10-01' }).montant_ht);
  assert.ok(validerFacture({ montant_ht: '-1', date_emission: '2026-10-01' }).montant_ht);
  assert.ok(validerFacture({ montant_ht: '100', date_emission: '' }).date_emission);
  assert.ok(validerFacture({ montant_ht: '100', date_emission: '01/10/2026' }).date_emission);
  assert.ok(validerFacture({ montant_ht: '100', date_emission: '2026-10-01', date_paiement: 'demain' }).date_paiement);
  assert.ok(validerFacture({ montant_ht: '100', date_emission: '2026-10-05', date_paiement: '2026-10-01' }).date_paiement);
});

test('syntheseFinancements : seuls accordé et versé réduisent le reste à charge', () => {
  const s = syntheseFinancements(5000, [fin('accorde', 2000), fin('verse', '1000.00'), fin('en_attente', 1500), fin('refuse', 800)]);
  assert.equal(s.finance, 3000);
  assert.equal(s.enAttente, 1500);
  assert.equal(s.refuse, 800);
  assert.equal(s.resteACharge, 2000);
  assert.equal(s.surfinance, 0);
});

test('syntheseFinancements : sans financement, tout reste à charge ; jamais négatif', () => {
  assert.equal(syntheseFinancements(4000, []).resteACharge, 4000);
  assert.equal(syntheseFinancements(4000).resteACharge, 4000);
  const s = syntheseFinancements(1000, [fin('accorde', 1200)]);
  assert.equal(s.resteACharge, 0);
  assert.equal(s.surfinance, 200);
});

test('syntheseFinancements : pas d’erreur d’arrondi flottant', () => {
  const s = syntheseFinancements(0.3, [fin('accorde', 0.1), fin('accorde', 0.2)]);
  assert.equal(s.finance, 0.3);
  assert.equal(s.resteACharge, 0);
});

test('estPayee : une date de paiement suffit', () => {
  assert.equal(estPayee(fac(100, '2026-10-02')), true);
  assert.equal(estPayee(fac(100)), false);
  assert.equal(estPayee({ date_paiement: '' }), false);
});

test('syntheseFacturation : acompte payé et solde à venir', () => {
  const s = syntheseFacturation(5000, [fac(2500, '2026-09-20'), fac(1500)]);
  assert.equal(s.nombre, 2);
  assert.equal(s.facture, 4000);
  assert.equal(s.encaisse, 2500);
  assert.equal(s.aEncaisser, 1500);
  assert.equal(s.resteAFacturer, 1000);
  assert.equal(s.depassement, 0);
});

test('syntheseFacturation : quatre échéances', () => {
  const s = syntheseFacturation(4000, [fac(1000, '2026-01-10'), fac(1000, '2026-02-10'), fac(1000, '2026-03-10'), fac(1000)]);
  assert.equal(s.nombre, 4);
  assert.equal(s.facture, 4000);
  assert.equal(s.encaisse, 3000);
  assert.equal(s.resteAFacturer, 0);
});

test('syntheseFacturation : facturé au-delà du montant retenu, ou sans montant', () => {
  const s = syntheseFacturation(1000, [fac(1200)]);
  assert.equal(s.resteAFacturer, 0);
  assert.equal(s.depassement, 200);
  const sans = syntheseFacturation(0, [fac('300.00')]);
  assert.equal(sans.depassement, 300);
  const vide = syntheseFacturation(2500);
  assert.equal(vide.nombre, 0);
  assert.equal(vide.resteAFacturer, 2500);
});

test('formaterDateCourte : jour/mois/année, vide si illisible', () => {
  assert.equal(formaterDateCourte('2026-10-01'), '01/10/2026');
  assert.equal(formaterDateCourte(''), '');
  assert.equal(formaterDateCourte(null), '');
  assert.equal(formaterDateCourte('01/10/2026'), '');
});

const MAINTENANT = new Date(2026, 9, 3); // 3 octobre 2026
const dated = (montant_ht, date_emission, date_paiement = null, demande_id = 'd1') => ({ demande_id, montant_ht, date_emission, date_paiement });

test('kpisFacturation : facturé daté par l’émission, encaissé par le paiement', () => {
  const k = kpisFacturation(
    [
      dated(1000, '2026-02-10', '2026-03-05'),
      dated(2000, '2025-12-20', '2026-01-15'), // émise l'an dernier, payée cette année
      dated(500, '2026-09-01'), // non payée
      dated('300.00', '2025-06-01'), // non payée, année précédente
    ],
    MAINTENANT,
  );
  assert.equal(k.annee, 2026);
  assert.equal(k.factureAnnee, 1500);
  assert.equal(k.encaisseAnnee, 3000);
  assert.equal(k.aEncaisser, 800);
  assert.equal(k.nbAEncaisser, 2);
});

test('kpisFacturation : liste vide', () => {
  assert.deepEqual(kpisFacturation([], MAINTENANT), { annee: 2026, factureAnnee: 0, encaisseAnnee: 0, aEncaisser: 0, nbAEncaisser: 0 });
  assert.equal(kpisFacturation(undefined, MAINTENANT).aEncaisser, 0);
});

test('facturationParMois : 12 mois jusqu’au mois courant, facturé et encaissé séparés', () => {
  const mois = facturationParMois(
    [dated(1000, '2026-09-10', '2026-10-02'), dated(400, '2026-10-01'), dated(999, '2024-01-01', '2024-02-01')],
    MAINTENANT,
  );
  assert.equal(mois.length, 12);
  assert.equal(mois[0].cle, '2025-11');
  assert.equal(mois.at(-1).cle, '2026-10');
  const sept = mois.find((m) => m.cle === '2026-09');
  const oct = mois.at(-1);
  assert.deepEqual([sept.facture, sept.encaisse], [1000, 0]);
  assert.deepEqual([oct.facture, oct.encaisse], [400, 1000]);
  assert.equal(mois.reduce((t, m) => t + m.facture, 0), 1400); // la facture de 2024 est hors période
});

test('resteAFacturerGagnees : seulement les demandes gagnées, jamais négatif', () => {
  const montants = [
    { demande_id: 'd1', statut: 'gagnee', montant_retenu: 5000 },
    { demande_id: 'd2', statut: 'gagnee', montant_retenu: '3000.00' },
    { demande_id: 'd3', statut: 'gagnee', montant_retenu: 1000 },
    { demande_id: 'd4', statut: 'proposition_envoyee', montant_retenu: 9000 },
  ];
  const factures = [dated(2000, '2026-09-01', null, 'd1'), dated(1500, '2026-09-02', null, 'd1'), dated(3500, '2026-09-03', null, 'd3')];
  const r = resteAFacturerGagnees(montants, factures);
  assert.equal(r.montant, 1500 + 3000); // d1 : 1500, d2 : 3000, d3 : surfacturée donc 0
  assert.equal(r.nbDemandes, 2);
  assert.deepEqual(resteAFacturerGagnees([], []), { montant: 0, nbDemandes: 0 });
});
