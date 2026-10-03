import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chiffres, normaliserMots, normaliserTexte } from '../app/js/engine/texte.js';
import { cleCouple, detecterDoublons, jetonsNom, nomsProches, planifierFusion } from '../app/js/engine/doublons.js';

const client = (id, raison_sociale, extra = {}) => ({ id, raison_sociale, statut: 'client', ville: null, code_postal: null, ...extra });

test('texte : accents, casse, ponctuation, chiffres', () => {
  assert.equal(normaliserTexte('  Société Générale '), 'societe generale');
  assert.equal(normaliserMots('Sté ABC-Formation (SAS)'), 'ste abc formation sas');
  assert.equal(chiffres('01 02.03-04'), '01020304');
  assert.equal(normaliserTexte(null), '');
});

test('jetonsNom : formes juridiques et mots de liaison ignorés, triés, sans doublon', () => {
  assert.deepEqual(jetonsNom('ABC Formation SAS'), ['abc', 'formation']);
  assert.deepEqual(jetonsNom('Société des Établissements Martin et Fils'), ['fils', 'martin']);
  assert.deepEqual(jetonsNom('Test test TEST'), ['test']);
  assert.deepEqual(jetonsNom(''), []);
});

test('nomsProches : mêmes mots ou inclusion, pas de rapprochement trop court', () => {
  assert.equal(nomsProches('ABC FORMATION', 'ABC Formation SAS'), true);
  assert.equal(nomsProches('Anatol', 'Anatol Conseil'), true);
  assert.equal(nomsProches('Formation ABC', 'ABC formation'), true);
  assert.equal(nomsProches('ABC Formation', 'XYZ Conseil'), false);
  assert.equal(nomsProches('AB', 'AB Conseil'), false); // moins de 4 lettres
  assert.equal(nomsProches('SARL', 'SAS'), false); // plus aucun mot utile
  assert.equal(nomsProches('', 'ABC Formation'), false);
});

test('cleCouple : indépendante de l’ordre et de la casse', () => {
  assert.equal(cleCouple('B', 'a'), 'a|b');
  assert.equal(cleCouple('a', 'B'), cleCouple('B', 'a'));
});

test('detecterDoublons : nom proche et même ville, ou même code postal', () => {
  const clients = [
    client('1', 'ABC FORMATION', { ville: 'Montpellier' }),
    client('2', 'ABC Formation SAS', { ville: 'montpellier ' }),
    client('3', 'ABC Formation', { ville: 'Lyon' }), // autre ville : pas rapproché
    client('4', 'Anatol Conseil', { code_postal: '34000' }),
    client('5', 'Anatol', { code_postal: '34 000', ville: 'Autre' }), // même code postal
  ];
  const couples = detecterDoublons(clients);
  assert.deepEqual(couples.map((c) => c.cle), ['1|2', '4|5']);
  assert.equal(couples[0].raisons[0].type, 'nom');
});

test('detecterDoublons : le nom commercial compte, les archivés et les couples ignorés sont écartés', () => {
  const clients = [
    client('1', 'Société Dupont', { ville: 'Nîmes', nom_commercial: 'Dupont Formation' }),
    client('2', 'Dupont Formation', { ville: 'Nimes' }),
    client('3', 'Dupont Formation', { ville: 'Nimes', statut: 'archive' }),
    client('4', 'Martin Conseil', { ville: 'Paris' }),
    client('5', 'Martin Conseil', { ville: 'Paris' }),
  ];
  assert.deepEqual(detecterDoublons(clients).map((c) => c.cle), ['4|5', '1|2']); // même nombre de raisons : ordre alphabétique
  assert.deepEqual(detecterDoublons(clients, [], [{ client_a: '4', client_b: '5' }]).map((c) => c.cle), ['1|2']);
  // un couple ignoré enregistré dans l'autre ordre l'est aussi
  assert.deepEqual(detecterDoublons(clients, [], [{ client_a: '5', client_b: '4' }]).map((c) => c.cle), ['1|2']);
});

test('detecterDoublons : un même e-mail de contact chez deux clients, raisons cumulées en premier', () => {
  const clients = [client('1', 'Alpha', { ville: 'Paris' }), client('2', 'Beta', { ville: 'Lyon' }), client('3', 'Alpha SAS', { ville: 'Paris' })];
  const contacts = [
    { client_id: '1', email: 'Marie@Exemple.fr' },
    { client_id: '2', email: 'marie@exemple.fr' },
    { client_id: '3', email: 'marie@exemple.fr' },
    { client_id: '2', email: '' },
    { client_id: '9', email: 'marie@exemple.fr' }, // client inconnu ou archivé
  ];
  const couples = detecterDoublons(clients, contacts);
  assert.deepEqual(couples.map((c) => c.cle), ['1|3', '1|2', '2|3']);
  assert.deepEqual(couples[0].raisons.map((r) => r.type), ['nom', 'contact']); // deux raisons
  assert.match(couples[1].raisons[0].detail, /marie@exemple\.fr/);
});

test('detecterDoublons : listes vides', () => {
  assert.deepEqual(detecterDoublons(), []);
  assert.deepEqual(detecterDoublons([client('1', 'Seul')]), []);
});

const garde = { raison_sociale: 'A', statut: 'prospect', siret: null, ville: 'Paris', opco: '', responsable_id: null, notes: null };
const absorbe = { raison_sociale: 'B', statut: 'client', siret: '82518678600018', ville: 'Lyon', opco: 'Atlas', source: 'salon', responsable_id: 'u1', notes: 'nota' };

test('planifierFusion : champs complétés sans écrasement, statut, notes, responsable', () => {
  const p = planifierFusion({ garde, absorbe, comptes: { demandes: 2, activites: 3, taches: 1 } });
  assert.deepEqual(p.champsCompletes.map((c) => [c.cle, c.valeur]), [['siret', '82518678600018'], ['opco', 'Atlas'], ['source', 'salon']]);
  assert.equal(p.devientClient, true);
  assert.equal(p.notesAjoutees, true);
  assert.equal(p.responsableRepris, true);
  assert.deepEqual([p.demandes, p.activites, p.taches], [2, 3, 1]);
});

test('planifierFusion : contacts fusionnés ou déplacés, perte du contact principal', () => {
  const p = planifierFusion({
    garde: { ...garde, statut: 'client' },
    absorbe: { ...absorbe, notes: '', responsable_id: null },
    contactsGarde: [{ email: 'x@t.fr', principal: true }],
    contactsAbsorbe: [
      { prenom: 'Ana', nom: 'Un', email: 'X@T.FR', principal: false },
      { prenom: 'Bob', nom: 'Deux', email: 'b@t.fr', principal: true },
      { email: '' },
    ],
  });
  assert.deepEqual(p.contactsFusionnes, ['Ana Un']);
  assert.deepEqual(p.contactsDeplaces, ['Bob Deux', 'Contact sans nom']);
  assert.equal(p.principalPerdu, true);
  assert.equal(p.devientClient, false);
  assert.equal(p.notesAjoutees, false);
  assert.equal(p.responsableRepris, false);
  // la fiche gardée sans contact principal : pas de perte
  assert.equal(planifierFusion({ garde, absorbe, contactsAbsorbe: [{ email: 'b@t.fr', principal: true }] }).principalPerdu, false);
});
