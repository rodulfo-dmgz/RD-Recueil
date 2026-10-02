import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  normaliserSiret,
  extraireFicheClient,
  planImportFiche,
  planImportContacts,
  nomComplet,
  libelleStatutClient,
  filtrerClients,
  preparerFiche,
  validerFiche,
  FORMES_JURIDIQUES,
  EFFECTIFS,
  OPCOS,
  ficheDepuisSirene,
  preparerContact,
  validerContact,
} from '../app/js/engine/fiche-client.js';

const QUESTIONS = [
  { id: 'TC-1.02', options: [{ valeur: 'sas', libelle: 'SAS' }, { valeur: 'sarl', libelle: 'SARL' }] },
  { id: 'TC-1.08', options: [{ valeur: '11-a-49', libelle: '11 à 49' }] },
  {
    id: 'TC-1.10',
    options: [
      { valeur: 'akto', libelle: 'AKTO' },
      { valeur: 'je-ne-sais-pas', libelle: 'Je ne sais pas' },
    ],
  },
];

const r = (question_id, valeur, nsp = false) => ({ question_id, valeur, nsp });

test('normaliserSiret : espaces et séparateurs retirés', () => {
  assert.equal(normaliserSiret('825 186 786 00018'), '82518678600018');
  assert.equal(normaliserSiret(null), '');
  assert.equal(normaliserSiret('abc'), '');
});

test('extraireFicheClient : identité TC-1 avec libellés lisibles', () => {
  const { champs } = extraireFicheClient(
    [
      r('TC-1.02', 'sas'),
      r('TC-1.03', '825 186 786 00018'),
      r('TC-1.04', ' 7022Z '),
      r('TC-1.05', 'Conseil'),
      r('TC-1.06', { rue: '3 rue des Lilas', cp: '34000', ville: 'Montpellier' }),
      r('TC-1.08', '11-a-49'),
      r('TC-1.10', 'akto'),
      r('TC-1.11', 'https://exemple.fr'),
    ],
    QUESTIONS
  );
  assert.deepEqual(champs, {
    forme_juridique: 'SAS',
    siret: '82518678600018',
    code_naf: '7022Z',
    secteur: 'Conseil',
    adresse: '3 rue des Lilas',
    code_postal: '34000',
    ville: 'Montpellier',
    effectif: '11 à 49',
    opco: 'AKTO',
    site_web: 'https://exemple.fr',
  });
});

test('extraireFicheClient : NSP, vides et "je ne sais pas" ignorés', () => {
  const { champs } = extraireFicheClient(
    [r('TC-1.02', null, true), r('TC-1.04', '  '), r('TC-1.10', 'je-ne-sais-pas'), r('TC-1.06', { rue: '', cp: '', ville: '' })],
    QUESTIONS
  );
  assert.deepEqual(champs, {});
});

test('extraireFicheClient : contacts TC-2 avec rôles, même personne fusionnée par e-mail', () => {
  const { contacts } = extraireFicheClient(
    [
      r('TC-2.01', { nom: 'Marie Dupont', fonction: 'DG', email: 'Marie@abc.fr' }),
      r('TC-2.02', { nom: 'Paul Martin', email: 'paul@abc.fr', tel: '0600000000' }),
      r('TC-2.03', { nom: 'M. Dupont', email: 'marie@abc.fr', tel: '0411223344' }),
      r('TC-2.04', { nom: '', email: '' }),
    ],
    QUESTIONS
  );
  assert.equal(contacts.length, 2);
  assert.deepEqual(contacts[0], {
    nom: 'Marie Dupont',
    fonction: 'DG',
    email: 'marie@abc.fr',
    telephone: '0411223344',
    roles: ['decideur', 'administratif', 'financeur'],
  });
  assert.deepEqual(contacts[1].roles, ['operationnel']);
});

test('planImportFiche : ne remplit que les champs vides, signale les autres', () => {
  const fiche = { ville: 'Nîmes', secteur: '', code_naf: null };
  const extraction = { champs: { ville: 'Montpellier', secteur: 'Conseil', code_naf: '7022Z' } };
  const { aAppliquer, ignores } = planImportFiche(fiche, extraction);
  assert.deepEqual(aAppliquer, { secteur: 'Conseil', code_naf: '7022Z' });
  assert.deepEqual(ignores, ['ville']);
});

test('planImportContacts : création, enrichissement sans écrasement, premier principal', () => {
  const existants = [{ id: 'k1', nom: 'Paul Martin', email: 'paul@abc.fr', telephone: null, roles: ['rh'], principal: false }];
  const extraits = [
    { nom: 'Marie Dupont', fonction: 'DG', email: 'marie@abc.fr', telephone: null, roles: ['decideur'] },
    { nom: 'Paul M.', fonction: null, email: 'paul@abc.fr', telephone: '0600000000', roles: ['operationnel'] },
    { nom: 'Eva', fonction: null, email: 'eva@abc.fr', telephone: null, roles: ['referent_handicap'] },
  ];
  const plan = planImportContacts(existants, extraits);
  assert.equal(plan.aCreer.length, 2);
  assert.equal(plan.aCreer[0].principal, true);
  assert.equal(plan.aCreer[1].principal, false);
  assert.deepEqual(plan.aEnrichir, [{ id: 'k1', roles: ['rh', 'operationnel'], telephone: '0600000000' }]);
});

test('planImportContacts : un principal existant est conservé, contact identique ignoré', () => {
  const existants = [{ id: 'k1', nom: 'Marie', email: 'marie@abc.fr', roles: ['decideur'], principal: true, fonction: 'DG', telephone: '1' }];
  const extraits = [
    { nom: 'Marie', email: 'marie@abc.fr', fonction: 'Autre', telephone: '2', roles: ['decideur'] },
    { nom: 'Eva', email: 'eva@abc.fr', roles: ['rh'] },
  ];
  const plan = planImportContacts(existants, extraits);
  assert.deepEqual(plan.dejaIdentiques, ['k1']);
  assert.equal(plan.aCreer[0].principal, false);
});

test('nomComplet et libelleStatutClient', () => {
  assert.equal(nomComplet({ prenom: 'Marie', nom: 'Dupont' }), 'Marie Dupont');
  assert.equal(nomComplet({ prenom: null, nom: 'Dupont' }), 'Dupont');
  assert.equal(libelleStatutClient('prospect'), 'Prospect');
});

test('filtrerClients : archivés masqués par défaut, filtre de statut', () => {
  const clients = [
    { raison_sociale: 'A', statut: 'client' },
    { raison_sociale: 'B', statut: 'prospect' },
    { raison_sociale: 'C', statut: 'archive' },
  ];
  assert.deepEqual(filtrerClients(clients).map((c) => c.raison_sociale), ['A', 'B']);
  assert.deepEqual(filtrerClients(clients, { statut: 'archive' }).map((c) => c.raison_sociale), ['C']);
  assert.deepEqual(filtrerClients(clients, { statut: 'prospect' }).map((c) => c.raison_sociale), ['B']);
});

test('filtrerClients : recherche sans casse ni accents, SIRET avec espaces', () => {
  const clients = [
    { raison_sociale: 'Éolienne du Sud', statut: 'client', ville: 'Nîmes', siret: '82518678600018', contact_principal: 'Marie Dupont' },
    { raison_sociale: 'Autre', statut: 'client', siret: null },
  ];
  assert.equal(filtrerClients(clients, { recherche: 'eolienne' }).length, 1);
  assert.equal(filtrerClients(clients, { recherche: 'NIMES' }).length, 1);
  assert.equal(filtrerClients(clients, { recherche: 'dupont' }).length, 1);
  assert.equal(filtrerClients(clients, { recherche: '825 186 786' }).length, 1);
  assert.equal(filtrerClients(clients, { recherche: 'zzz' }).length, 0);
  assert.equal(filtrerClients(clients, { recherche: '12' }).length, 0);
});

test('suggestions : mêmes libellés que le questionnaire (TC-1.02, TC-1.08, TC-1.10)', () => {
  const { questions } = JSON.parse(readFileSync(new URL('../data/questionnaire.json', import.meta.url), 'utf8'));
  const libelles = (id) => questions.find((q) => q.id === id).options.map((o) => o.libelle).filter((l) => l !== 'Je ne sais pas');
  assert.deepEqual(FORMES_JURIDIQUES, libelles('TC-1.02'));
  assert.deepEqual(EFFECTIFS, libelles('TC-1.08'));
  assert.deepEqual(OPCOS, libelles('TC-1.10'));
});

test('preparerFiche : espaces retirés, vides en null, SIRET sans espaces', () => {
  const fiche = preparerFiche({ raison_sociale: '  ACME ', siret: '825 186 786 00018', ville: ' ', notes: 'à suivre', source: '', statut: 'prospect', responsable_id: '' });
  assert.equal(fiche.raison_sociale, 'ACME');
  assert.equal(fiche.siret, '82518678600018');
  assert.equal(fiche.ville, null);
  assert.equal(fiche.notes, 'à suivre');
  assert.equal(fiche.source, null);
  assert.equal(fiche.statut, 'prospect');
  assert.equal(fiche.responsable_id, null);
  assert.equal('statut' in preparerFiche({ raison_sociale: 'A' }), false);
});

test('validerFiche : raison sociale, SIRET et e-mail', () => {
  assert.deepEqual(validerFiche({ raison_sociale: 'A', siret: '', email_general: '' }), {});
  assert.deepEqual(validerFiche({ raison_sociale: 'A', siret: '825 186 786 00018', email_general: 'a@b.fr' }), {});
  const e = validerFiche({ raison_sociale: ' ', siret: '123', email_general: 'pas-un-mail' });
  assert.deepEqual(Object.keys(e).sort(), ['email_general', 'raison_sociale', 'siret']);
});

test('ficheDepuisSirene : convertit les valeurs SIRENE en champs de la fiche', () => {
  const fiche = ficheDepuisSirene({
    raisonSociale: 'ACME',
    codeNaf: '70.22Z',
    secteurActivite: 'Activités spécialisées',
    formeJuridique: 'sas',
    effectif: '11-a-49',
    adresse: { rue: '3 rue des Lilas', cp: '34000', ville: 'Montpellier' },
  });
  assert.deepEqual(fiche, {
    raison_sociale: 'ACME',
    code_naf: '70.22Z',
    secteur: 'Activités spécialisées',
    forme_juridique: 'SAS',
    effectif: '11 à 49',
    adresse: '3 rue des Lilas',
    code_postal: '34000',
    ville: 'Montpellier',
  });
  assert.deepEqual(ficheDepuisSirene({ raisonSociale: null, adresse: null, formeJuridique: 'inconnue' }), {});
});

test('preparerContact : nettoyage, e-mail en minuscules, rôles valides', () => {
  const c = preparerContact({ prenom: ' Marie ', nom: 'Dupont', email: ' Marie@ABC.fr ', telephone: '', roles: ['rh', 'rh', 'inconnu', 'decideur'], principal: 1 });
  assert.deepEqual(c, {
    prenom: 'Marie', nom: 'Dupont', fonction: null, email: 'marie@abc.fr', telephone: null,
    roles: ['rh', 'decideur'], principal: true, actif: true, notes: null,
  });
  assert.equal(preparerContact({ nom: 'A', actif: false }).actif, false);
});

test('validerContact : nom obligatoire, e-mail valide', () => {
  assert.deepEqual(validerContact({ nom: 'Dupont', email: '' }), {});
  assert.deepEqual(validerContact({ nom: 'Dupont', email: 'marie@abc.fr' }), {});
  assert.deepEqual(Object.keys(validerContact({ nom: ' ', email: 'x' })).sort(), ['email', 'nom']);
});

test('planImportContacts : un contact sans nom reprend son e-mail comme nom', () => {
  const plan = planImportContacts([], [{ nom: null, email: 'eva@abc.fr', roles: ['rh'] }]);
  assert.equal(plan.aCreer[0].nom, 'eva@abc.fr');
});
