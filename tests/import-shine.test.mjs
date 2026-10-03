import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  analyserExportBanque,
  decoderCsv,
  demandesCorrespondantes,
  extraireFacturesPayees,
  lireCsv,
  lireDateCsv,
  lireMontantCsv,
  planifierImport,
  preparerApplication,
} from '../app/js/engine/import-shine.js';

// Même forme que l'export Shine, avec des données inventées.
const TITRES =
  'Transaction ID;Date de la valeur;Date d\'opération;IBAN;Type de transaction;Transaction personnelle;Category;Débit;Crédit;Solde mouvement;Solde bancaire;Libellé;Nom de la contrepartie;Montant HT;Montant de TVA total;Pièces;Date d\'ajout pièces;Commentaire';

function ligne({ id, operation, debit = '0,00', credit = '0,00', libelle = 'Virement', ht = credit, pieces = '' }) {
  const q = (v) => `"${v}"`;
  return [id, operation, operation, 'FR76XXXX', 'Virement', 'Non', 'DEFAULT', debit, credit, credit, '0,00', libelle, 'Contrepartie', ht, '0,00', pieces, '', '']
    .map(q)
    .join(';');
}

const FICHIER = [
  TITRES,
  ligne({ id: 't1', operation: '06/09/2021', credit: '1000,00', pieces: 'FACTURE_3_Madame Test Un_2021-09-04.pdf' }),
  ligne({ id: 't2', operation: '08/09/2021', debit: '4,68', libelle: 'Abonnement Shine', pieces: 'ACH_2021-09-08_abonnement.pdf' }),
  ligne({ id: 't3', operation: '21/09/2021', credit: '420,00', pieces: 'FACTURE_2_Madame Test Un_2021-09-04.pdf' }),
  ligne({ id: 't4', operation: '10/11/2021', credit: '200,00', pieces: 'FACTURE_5_SARL Test Deux_2021-11-08.pdf' }),
  ligne({ id: 't5', operation: '20/11/2021', credit: '100,00', pieces: 'FACTURE_5_SARL Test Deux_2021-11-08.pdf' }),
  ligne({ id: 't6', operation: '23/12/2021', credit: '100,00', libelle: 'Indemnité' }),
].join('\r\n');

test('decoderCsv : UTF-8 valide conservé, Windows-1252 sinon, BOM retiré', () => {
  assert.equal(decoderCsv(new TextEncoder().encode('Libellé;é')), 'Libellé;é');
  assert.equal(decoderCsv(Buffer.from('Libellé;Débit', 'latin1')), 'Libellé;Débit');
  assert.equal(decoderCsv(new TextEncoder().encode('﻿abc')), 'abc');
});

test('lireCsv : guillemets, séparateur et retour à la ligne dans une cellule, guillemets doublés', () => {
  const lignes = lireCsv('a;"b;c";"d ""e"" f"\r\n"x\ny";;z\r\n\r\n');
  assert.deepEqual(lignes, [
    ['a', 'b;c', 'd "e" f'],
    ['x\ny', '', 'z'],
  ]);
});

test('lireMontantCsv et lireDateCsv', () => {
  assert.equal(lireMontantCsv('1000,00'), 1000);
  assert.equal(lireMontantCsv('1 250,50'), 1250.5);
  assert.equal(lireMontantCsv('-4,68'), -4.68);
  assert.equal(lireMontantCsv(''), null);
  assert.equal(lireMontantCsv('abc'), null);
  assert.equal(lireDateCsv('06/09/2021'), '2021-09-06');
  assert.equal(lireDateCsv('31/02/2021'), null);
  assert.equal(lireDateCsv('2021-09-06'), null);
  assert.equal(lireDateCsv(''), null);
});

test('analyserExportBanque : colonnes reconnues malgré les accents', () => {
  const { mouvements, erreur } = analyserExportBanque(FICHIER);
  assert.equal(erreur, null);
  assert.equal(mouvements.length, 6);
  assert.deepEqual(mouvements[0], {
    transactionId: 't1',
    dateOperation: '2021-09-06',
    credit: 1000,
    montantHt: 1000,
    libelle: 'Virement',
    contrepartie: 'Contrepartie',
    pieces: 'FACTURE_3_Madame Test Un_2021-09-04.pdf',
  });
});

test('analyserExportBanque : fichier vide ou autre format refusé avec un message', () => {
  assert.match(analyserExportBanque('').erreur, /vide/);
  const autre = analyserExportBanque('Nom;Prenom\r\nA;B');
  assert.match(autre.erreur, /export bancaire Shine/);
  assert.deepEqual(autre.mouvements, []);
});

test('extraireFacturesPayees : numéro, client, émission et paiement lus ; paiements multiples additionnés', () => {
  const { mouvements } = analyserExportBanque(FICHIER);
  const { factures, autresCredits } = extraireFacturesPayees(mouvements);
  assert.equal(autresCredits, 1); // l'indemnité sans facture
  assert.deepEqual(
    factures.map((f) => [f.numero, f.client, f.dateEmission, f.datePaiement, f.montantHt, f.nbPaiements]),
    [
      ['2', 'Madame Test Un', '2021-09-04', '2021-09-21', 420, 1],
      ['3', 'Madame Test Un', '2021-09-04', '2021-09-06', 1000, 1],
      ['5', 'SARL Test Deux', '2021-11-08', '2021-11-20', 300, 2],
    ]
  );
  assert.deepEqual(factures[2].transactions, ['t4', 't5']);
});

test('extraireFacturesPayees : un débit avec pièce facture est ignoré, liste vide sans erreur', () => {
  const { mouvements } = analyserExportBanque([TITRES, ligne({ id: 'd1', operation: '01/01/2021', debit: '50,00', pieces: 'FACTURE_9_X_2021-01-01.pdf' })].join('\n'));
  assert.deepEqual(extraireFacturesPayees(mouvements), { factures: [], autresCredits: 0 });
  assert.deepEqual(extraireFacturesPayees(), { factures: [], autresCredits: 0 });
});

test('planifierImport : nouvelle, paiement à enregistrer, déjà à jour ; rien d’autre', () => {
  const { mouvements } = analyserExportBanque(FICHIER);
  const { factures } = extraireFacturesPayees(mouvements);
  const plan = planifierImport(factures, [
    { id: 'f2', demande_id: 'd', numero: '2', date_paiement: null },
    { id: 'f3', demande_id: 'd', numero: '3', date_paiement: '2021-09-06' },
    { id: 'fx', demande_id: 'd', numero: null, date_paiement: null },
  ]);
  assert.deepEqual(plan.map((p) => [p.numero, p.etat]), [
    ['2', 'paiement_a_enregistrer'],
    ['3', 'deja_a_jour'],
    ['5', 'nouvelle'],
  ]);
  assert.equal(plan[0].existante.id, 'f2');
  assert.equal(plan[2].existante, null);
  // Rejouer le même fichier ne crée rien de plus : tout est "déjà à jour" une fois appliqué.
  const apres = planifierImport(factures, factures.map((f) => ({ id: f.numero, numero: f.numero, date_paiement: f.datePaiement })));
  assert.ok(apres.every((p) => p.etat === 'deja_a_jour'));
});

// Contrôle sur le vrai fichier déposé par l'utilisateur (non versionné) : on ne
// vérifie que des comptes, jamais de données personnelles.
const REEL = new URL('../docs/exemples/BQ_2021-01-01_2021-12-31.csv', import.meta.url);
test('fichier réel d’exemple : lisible et factures détectées', { skip: !existsSync(REEL) }, () => {
  const { mouvements, erreur } = analyserExportBanque(decoderCsv(readFileSync(REEL)));
  assert.equal(erreur, null);
  assert.equal(mouvements.length, 13);
  assert.ok(mouvements.every((m) => m.dateOperation));
  const { factures, autresCredits } = extraireFacturesPayees(mouvements);
  assert.equal(factures.length, 4);
  assert.equal(autresCredits, 1);
  assert.ok(factures.every((f) => f.montantHt > 0 && f.dateEmission && f.datePaiement));
});

const DEMANDES = [
  { id: 'd1', reference: 'REC-1', clients: { raison_sociale: 'TEST UN' } },
  { id: 'd2', reference: 'REC-2', clients: { raison_sociale: 'Test Un' } },
  { id: 'd3', reference: 'REC-3', clients: { raison_sociale: 'SARL TEST DEUX' } },
  { id: 'd4', reference: 'REC-4', clients: { raison_sociale: 'Autre Société' } },
  { id: 'd5', reference: 'REC-5', clients: null },
];

test('demandesCorrespondantes : civilités et forme juridique ignorées, accents et casse aussi', () => {
  assert.deepEqual(demandesCorrespondantes('Madame Test Un', DEMANDES), ['d1', 'd2']);
  assert.deepEqual(demandesCorrespondantes('SARL Test Deux', DEMANDES), ['d3']);
  assert.deepEqual(demandesCorrespondantes('Société Autre', DEMANDES), ['d4']);
  assert.deepEqual(demandesCorrespondantes('Inconnu Total', DEMANDES), []);
  assert.deepEqual(demandesCorrespondantes('', DEMANDES), []);
  assert.deepEqual(demandesCorrespondantes('Madame', DEMANDES), []); // plus aucun mot utile
  assert.deepEqual(demandesCorrespondantes('Test Un', undefined), []);
});

test('preparerApplication : créations, paiements, ignorées ; rien pour ce qui est à jour', () => {
  const { mouvements } = analyserExportBanque(FICHIER);
  const { factures } = extraireFacturesPayees(mouvements);
  const plan = planifierImport(factures, [
    { id: 'f2', demande_id: 'd1', numero: '2', date_paiement: null },
    { id: 'f3', demande_id: 'd1', numero: '3', date_paiement: '2021-09-06' },
  ]);
  const r = preparerApplication(plan, { 5: 'd3' });
  assert.deepEqual(r.paiements, [{ id: 'f2', numero: '2', date_paiement: '2021-09-21' }]);
  assert.deepEqual(r.creations, [{ demande_id: 'd3', numero: '5', montant_ht: 300, date_emission: '2021-11-08', date_paiement: '2021-11-20', source: 'import' }]);
  assert.deepEqual(r.ignorees, []);
  assert.equal(r.dejaAJour, 1);
  const sansChoix = preparerApplication(plan, {});
  assert.deepEqual(sansChoix.creations, []);
  assert.deepEqual(sansChoix.ignorees, [{ numero: '5', raison: 'Aucune demande choisie' }]);
  assert.deepEqual(preparerApplication(), { creations: [], paiements: [], ignorees: [], dejaAJour: 0 });
});
