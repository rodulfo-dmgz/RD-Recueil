import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  delaiTraitementJours,
  estOuverte,
  filtrerReclamations,
  kpisReclamations,
  libelleGravite,
  libelleStatutReclamation,
  preparerReclamation,
  validerReclamation,
} from '../app/js/engine/reclamations.js';

const rec = (extra = {}) => ({ statut: 'ouverte', gravite: 'mineure', date_reception: '2026-09-01', date_cloture: null, objet: 'Objet', ...extra });

test('libellés et état ouvert', () => {
  assert.equal(libelleGravite('critique'), 'Critique');
  assert.equal(libelleGravite('x'), 'x');
  assert.equal(libelleStatutReclamation('en_cours'), 'En cours');
  assert.equal(estOuverte(rec()), true);
  assert.equal(estOuverte(rec({ statut: 'en_cours' })), true);
  assert.equal(estOuverte(rec({ statut: 'cloturee' })), false);
});

test('preparerReclamation : valeurs par défaut, textes vides en null', () => {
  assert.deepEqual(
    preparerReclamation({ objet: ' Retard ', date_reception: '2026-10-03', description: '', gravite: '', statut: '', responsable_id: '', demande_id: '', action_corrective: '  ' }),
    { demande_id: null, date_reception: '2026-10-03', objet: 'Retard', description: null, gravite: 'mineure', statut: 'ouverte', responsable_id: null, action_corrective: null },
  );
});

test('validerReclamation : objet, date, listes, action corrective pour clôturer', () => {
  assert.deepEqual(validerReclamation({ objet: 'Retard', date_reception: '2026-10-03', gravite: 'majeure', statut: 'en_cours' }), {});
  assert.ok(validerReclamation({ objet: '  ', date_reception: '2026-10-03' }).objet);
  assert.ok(validerReclamation({ objet: 'x', date_reception: '' }).date_reception);
  assert.ok(validerReclamation({ objet: 'x', date_reception: '03/10/2026' }).date_reception);
  assert.ok(validerReclamation({ objet: 'x', date_reception: '2026-10-03', gravite: 'grave' }).gravite);
  assert.ok(validerReclamation({ objet: 'x', date_reception: '2026-10-03', statut: 'fermee' }).statut);
  assert.ok(validerReclamation({ objet: 'x', date_reception: '2026-10-03', statut: 'cloturee' }).action_corrective);
  assert.deepEqual(validerReclamation({ objet: 'x', date_reception: '2026-10-03', statut: 'cloturee', action_corrective: 'Process revu' }), {});
});

test('delaiTraitementJours : seulement pour une clôturée, jamais négatif', () => {
  assert.equal(delaiTraitementJours(rec({ statut: 'cloturee', date_cloture: '2026-09-11' })), 10);
  assert.equal(delaiTraitementJours(rec({ statut: 'cloturee', date_cloture: '2026-09-01' })), 0);
  assert.equal(delaiTraitementJours(rec({ statut: 'cloturee', date_cloture: '2026-08-01' })), 0);
  assert.equal(delaiTraitementJours(rec()), null);
  assert.equal(delaiTraitementJours(rec({ statut: 'cloturee' })), null);
  assert.equal(delaiTraitementJours(rec({ statut: 'cloturee', date_reception: '2026-02-27', date_cloture: '2026-03-02' })), 3);
});

test('kpisReclamations : comptes et délai moyen', () => {
  const k = kpisReclamations([
    rec({ statut: 'ouverte', gravite: 'critique' }),
    rec({ statut: 'en_cours' }),
    rec({ statut: 'cloturee', date_cloture: '2026-09-11' }), // 10 jours
    rec({ statut: 'cloturee', date_reception: '2026-09-01', date_cloture: '2026-09-06' }), // 5 jours
    rec({ statut: 'cloturee', gravite: 'critique', date_cloture: '2026-09-02' }), // 1 jour : clôturée, pas "critique ouverte"
  ]);
  assert.deepEqual(k, { total: 5, ouvertes: 2, enCours: 1, cloturees: 3, critiquesOuvertes: 1, delaiMoyenJours: 5.3 });
  assert.deepEqual(kpisReclamations(), { total: 0, ouvertes: 0, enCours: 0, cloturees: 0, critiquesOuvertes: 0, delaiMoyenJours: null });
  assert.equal(kpisReclamations([rec()]).delaiMoyenJours, null);
});

test('filtrerReclamations : statut, gravité, recherche sans accents sur objet, client et référence', () => {
  const liste = [
    rec({ objet: 'Retard de livraison', clients: { raison_sociale: 'ABC Formation' }, demandes: { reference: 'RDF-2026-0001' } }),
    rec({ statut: 'cloturee', gravite: 'critique', objet: 'Qualité du support', date_cloture: '2026-09-05' }),
    rec({ statut: 'en_cours', gravite: 'majeure', objet: 'Facture erronée', description: 'Montant incorrect' }),
  ];
  assert.equal(filtrerReclamations(liste).length, 3);
  assert.equal(filtrerReclamations(liste, { statut: 'ouvertes' }).length, 2);
  assert.equal(filtrerReclamations(liste, { statut: 'cloturee' }).length, 1);
  assert.equal(filtrerReclamations(liste, { gravite: 'majeure' }).length, 1);
  assert.equal(filtrerReclamations(liste, { recherche: 'qualite' }).length, 1); // accents ignorés
  assert.equal(filtrerReclamations(liste, { recherche: 'abc' }).length, 1); // client
  assert.equal(filtrerReclamations(liste, { recherche: 'rdf-2026' }).length, 1); // référence
  assert.equal(filtrerReclamations(liste, { recherche: 'incorrect' }).length, 1); // description
  assert.equal(filtrerReclamations(liste, { statut: 'ouvertes', gravite: 'critique' }).length, 0);
  assert.deepEqual(filtrerReclamations(), []);
});

test('export CSV des réclamations : valeurs lisibles et délai de traitement', async () => {
  const { COLONNES_CSV_RECLAMATIONS } = await import('../app/js/engine/reclamations.js');
  const { genererCsv } = await import('../app/js/engine/csv.js');
  const csv = genererCsv(
    [
      { objet: 'Retard', description: null, gravite: 'majeure', statut: 'cloturee', date_reception: '2026-09-01', date_cloture: '2026-09-11', action_corrective: 'Process revu', clients: { raison_sociale: 'ABC' }, demandes: { reference: 'RDF-1' } },
      { objet: 'Question', description: 'Détail', gravite: 'mineure', statut: 'ouverte', date_reception: '2026-10-01', date_cloture: null, action_corrective: null, clients: { raison_sociale: 'XYZ' }, demandes: null },
    ],
    COLONNES_CSV_RECLAMATIONS,
  );
  const lignes = csv.split('\r\n');
  assert.equal(lignes[0], 'Client;Demande;Date de réception;Objet;Description;Gravité;Statut;Date de clôture;Délai de traitement (jours);Action corrective');
  assert.equal(lignes[1], 'ABC;RDF-1;01/09/2026;Retard;;Majeure;Clôturée;11/09/2026;10;Process revu');
  assert.equal(lignes[2], 'XYZ;;01/10/2026;Question;Détail;Mineure;Ouverte;;;');
});
