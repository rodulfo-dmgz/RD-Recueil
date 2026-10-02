import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  agregerPipeline,
  caSigneAnnee,
  caSigneParMois,
  demandesSansMontant,
  formaterMontant,
  kpisFinance,
  libelleSourceMontant,
  preparerEnjeu,
  validerEnjeu,
} from '../app/js/engine/finance.js';

const MAINTENANT = new Date(2026, 9, 2, 10, 0); // 2 octobre 2026

function m(statut, montant, pondere, extra = {}) {
  return {
    demande_id: extra.id ?? `${statut}-${montant}`,
    statut,
    archivee: false,
    created_at: '2026-01-10T09:00:00',
    montant_retenu: montant,
    montant_pondere: pondere,
    source_montant: montant > 0 ? 'proposition' : 'aucun',
    date_decision: null,
    ...extra,
  };
}

const JEU = [
  m('en_saisie', 0, 0), // étape 0, sans montant
  m('en_analyse', 4000, 1800), // étape 1
  m('soumise', 0, 0), // étape 1, sans montant (à signaler)
  m('cadrage_valide', '2500.00', '1625.00'), // étape 2, montants en chaînes
  m('proposition_envoyee', 1000, 750), // étape 3
  m('proposition_envoyee', 6000, 4500, { archivee: true }), // archivée : hors pipeline
  m('gagnee', 5000, 5000, { date_decision: '2026-10-01T09:00:00' }),
  m('gagnee', 3000, 3000, { date_decision: '2026-06-15T09:00:00' }),
  m('gagnee', 2000, 2000, { date_decision: '2025-12-20T09:00:00' }),
  m('perdue', 4000, 0),
  m('abandonnee', 900, 0),
];

test('formaterMontant : euros sans décimale par défaut, avec décimales à la demande, tiret si absent', () => {
  assert.match(formaterMontant(4800), /^4\s800\s€$/u);
  assert.match(formaterMontant(1234.5, { decimales: 2 }), /^1\s234,50\s€$/u);
  assert.match(formaterMontant(4800.5, { decimales: 'auto' }), /^4\s800,50\s€$/u);
  assert.match(formaterMontant(1000, { decimales: 'auto' }), /^1\s000\s€$/u);
  assert.equal(formaterMontant(null), '-');
  assert.equal(formaterMontant('abc'), '-');
});

test('libelleSourceMontant', () => {
  assert.equal(libelleSourceMontant('estimation'), 'Estimation');
  assert.equal(libelleSourceMontant('aucun'), 'Aucun montant');
});

test('agregerPipeline : demandes en cours par étape, archivées et terminées exclues', () => {
  const { etapes, total } = agregerPipeline(JEU);
  assert.deepEqual(etapes.map((e) => [e.id, e.nb, e.montant, e.pondere, e.sansMontant]), [
    ['reponses', 1, 0, 0, 1],
    ['entretien', 2, 4000, 1800, 1],
    ['cadrage', 1, 2500, 1625, 0],
    ['proposition', 1, 1000, 750, 0],
  ]);
  assert.deepEqual(total, { nb: 5, montant: 7500, pondere: 4175, sansMontant: 2 });
});

test('demandesSansMontant : seulement à partir de l’entretien', () => {
  assert.deepEqual(demandesSansMontant(JEU).map((d) => d.statut), ['soumise']);
});

test('caSigneAnnee : demandes gagnées datées par la décision du client', () => {
  assert.equal(caSigneAnnee(JEU, 2026), 8000);
  assert.equal(caSigneAnnee(JEU, 2025), 2000);
  assert.equal(caSigneAnnee(JEU, 2024), 0);
});

test('caSigneParMois : douze mois glissants, du plus ancien au plus récent', () => {
  const mois = caSigneParMois(JEU, MAINTENANT);
  assert.equal(mois.length, 12);
  assert.equal(mois[0].cle, '2025-11');
  assert.equal(mois[11].cle, '2026-10');
  assert.deepEqual(
    mois.filter((x) => x.montant > 0).map((x) => [x.cle, x.montant, x.nb]),
    [['2025-12', 2000, 1], ['2026-06', 3000, 1], ['2026-10', 5000, 1]]
  );
});

test('caSigneParMois : sans date de décision, la création sert de repli', () => {
  const mois = caSigneParMois([m('gagnee', 700, 700, { created_at: '2026-09-05T09:00:00' })], MAINTENANT, 3);
  assert.deepEqual(mois.map((x) => [x.cle, x.montant]), [['2026-08', 0], ['2026-09', 700], ['2026-10', 0]]);
});

test('kpisFinance : pipeline, pondéré, CA signé, moyenne, conversion en euros', () => {
  const k = kpisFinance(JEU, MAINTENANT);
  assert.equal(k.pipeline, 7500);
  assert.equal(k.pondere, 4175);
  assert.equal(k.caSigneAnnee, 8000);
  assert.equal(k.caSigneTotal, 10000);
  assert.equal(Math.round(k.montantMoyenGagne), 3333);
  assert.deepEqual(k.conversion, { gagne: 10000, perdu: 4000, taux: 10000 / 14000 });
  assert.equal(k.sansMontant, 1);
});

test('kpisFinance : aucune donnée', () => {
  const k = kpisFinance([], MAINTENANT);
  assert.equal(k.pipeline, 0);
  assert.equal(k.montantMoyenGagne, null);
  assert.equal(k.conversion.taux, null);
});

test('preparerEnjeu : virgule décimale, espaces, vides en null', () => {
  assert.deepEqual(preparerEnjeu({ montant_estime: '4 800,505', probabilite: '60' }), { montant_estime: 4800.51, probabilite: 60 });
  assert.deepEqual(preparerEnjeu({ montant_estime: '', probabilite: '  ' }), { montant_estime: null, probabilite: null });
  assert.deepEqual(preparerEnjeu({ montant_estime: '1 200', probabilite: '0' }), { montant_estime: 1200, probabilite: 0 });
});

test('validerEnjeu : montant positif, probabilité entière de 0 à 100', () => {
  assert.deepEqual(validerEnjeu({ montant_estime: '', probabilite: '' }), {});
  assert.deepEqual(validerEnjeu({ montant_estime: '4 800,50', probabilite: '75' }), {});
  assert.deepEqual(Object.keys(validerEnjeu({ montant_estime: '-5', probabilite: '120' })).sort(), ['montant_estime', 'probabilite']);
  assert.deepEqual(Object.keys(validerEnjeu({ montant_estime: 'abc', probabilite: '12,5' })).sort(), ['montant_estime', 'probabilite']);
});
