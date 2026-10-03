import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STATUTS_TACHE, URGENCES, classerTaches, colonnesKanban, deplacerTache, estOuverte, libelleDateLongue, libelleStatutTache, libelleUrgence, membresDeTache, nomFichierSur, tachesVersJalons, validerNouvelleTache } from '../app/js/engine/taches.js';

const maintenant = new Date('2026-10-10T10:00:00Z');
const tache = (id, statut, echeance, extra = {}) => ({ id, titre: `T${id}`, statut, echeance, created_at: `2026-10-0${id}T08:00:00Z`, client_id: 'c', ...extra });
const ids = (liste) => liste.map((t) => t.id);

test('statuts : quatre colonnes, Complet pour terminee, annulée sans colonne', () => {
  assert.deepEqual(STATUTS_TACHE.map((s) => s.valeur), ['a_faire', 'en_cours', 'a_reviser', 'terminee']);
  assert.equal(libelleStatutTache('terminee'), 'Complet');
  assert.equal(libelleStatutTache('annulee'), 'Annulée');
  assert.equal(libelleStatutTache('a_reviser'), 'À réviser');
});

test('estOuverte : à faire, en cours et à réviser seulement', () => {
  for (const s of ['a_faire', 'en_cours', 'a_reviser']) assert.equal(estOuverte({ statut: s }), true);
  for (const s of ['terminee', 'annulee']) assert.equal(estOuverte({ statut: s }), false);
  assert.equal(estOuverte(null), false);
});

test('classerTaches et calendrier : une tâche en cours ou à réviser reste ouverte', () => {
  const taches = [tache(1, 'en_cours', '2026-10-09'), tache(2, 'a_reviser', '2026-10-10'), tache(3, 'terminee', '2026-10-01'), tache(4, 'annulee', '2026-10-01')];
  const g = classerTaches(taches, maintenant);
  assert.deepEqual(ids(g.enRetard), [1]);
  assert.deepEqual(ids(g.aujourdhui), [2]);
  assert.equal(tachesVersJalons(taches).length, 2);
});

test('colonnesKanban : une colonne par statut, tri par échéance, annulées exclues', () => {
  const taches = [tache(1, 'a_faire', '2026-10-12'), tache(2, 'a_faire', '2026-10-11'), tache(3, 'en_cours', '2026-10-20'), tache(4, 'annulee', '2026-10-01')];
  const colonnes = colonnesKanban(taches, { maintenant });
  assert.deepEqual(colonnes.map((c) => c.valeur), ['a_faire', 'en_cours', 'a_reviser', 'terminee']);
  assert.deepEqual(ids(colonnes[0].taches), [2, 1]);
  assert.deepEqual(ids(colonnes[1].taches), [3]);
  assert.deepEqual(colonnes[2].taches, []);
  assert.deepEqual(colonnes[3].taches, []);
});

test('colonnesKanban : « Complet » ne garde que les 30 derniers jours, plus récentes d’abord', () => {
  const taches = [
    tache(1, 'terminee', '2026-09-01', { terminee_le: '2026-09-01T10:00:00Z' }), // trop ancienne
    tache(2, 'terminee', '2026-10-01', { terminee_le: '2026-10-02T10:00:00Z' }),
    tache(3, 'terminee', '2026-10-01', { terminee_le: '2026-10-08T10:00:00Z' }),
  ];
  assert.deepEqual(ids(colonnesKanban(taches, { maintenant })[3].taches), [3, 2]);
  assert.deepEqual(ids(colonnesKanban(taches, { maintenant, joursComplet: 60 })[3].taches), [3, 2, 1]);
});

test('deplacerTache : change le statut sans modifier l’original, gère la date de fin', () => {
  const taches = [tache(1, 'a_faire', '2026-10-12'), tache(2, 'en_cours', '2026-10-12')];
  const apres = deplacerTache(taches, 1, 'terminee', maintenant);
  assert.equal(apres[0].statut, 'terminee');
  assert.equal(apres[0].terminee_le, maintenant.toISOString());
  assert.equal(taches[0].statut, 'a_faire');
  assert.equal(apres[1], taches[1]);
  const retour = deplacerTache(apres, 1, 'en_cours', maintenant);
  assert.equal(retour[0].terminee_le, null);
});

test('membresDeTache : responsable d’abord, autres membres, sans doublon, nom ou e-mail', () => {
  const tache = {
    assignee_id: 'u1',
    assignee: { nom: 'Rodulfo', email: 'r@x.fr' },
    membres: [{ user_id: 'u2', profil: { nom: null, email: 'm@x.fr' } }, { user_id: 'u1', profil: { nom: 'Rodulfo' } }, { user_id: 'u3', profil: null }],
  };
  assert.deepEqual(membresDeTache(tache), [
    { user_id: 'u1', nom: 'Rodulfo' },
    { user_id: 'u2', nom: 'm@x.fr' },
    { user_id: 'u3', nom: 'Membre' },
  ]);
  assert.deepEqual(membresDeTache({}), []);
  assert.deepEqual(membresDeTache(null), []);
});

test('nomFichierSur : sans accents ni espaces, extension conservée en minuscules', () => {
  assert.equal(nomFichierSur('Devis été 2026 (v2).PDF'), 'Devis-ete-2026-v2.pdf');
  assert.equal(nomFichierSur('../../etc/passwd.docx'), 'etc-passwd.docx');
  assert.equal(nomFichierSur('éé'), 'ee');
  assert.equal(nomFichierSur('***.png'), 'fichier.png');
  assert.equal(nomFichierSur(''), 'fichier');
});

test('validerNouvelleTache : titre, client, date, urgence et statut', () => {
  const valide = { titre: 'Appeler', client_id: 'c1', echeance: '2026-10-10', type: 'appel', urgence: 'haute', statut: 'en_cours' };
  assert.deepEqual(validerNouvelleTache(valide), {});
  assert.deepEqual(Object.keys(validerNouvelleTache({ ...valide, titre: ' ', client_id: '', echeance: '2026-02-31', urgence: 'x', statut: 'annulee' })).sort(), ['client_id', 'echeance', 'statut', 'titre', 'urgence']);
  assert.deepEqual(validerNouvelleTache({ titre: 'x', client_id: 'c', echeance: '2026-10-10' }), {}); // urgence et statut facultatifs
  assert.equal(libelleUrgence('haute'), 'Haute');
  assert.equal(libelleUrgence(undefined), 'Moyenne');
  assert.deepEqual(URGENCES.map((u) => u.valeur), ['faible', 'moyenne', 'haute']);
});

test('libelleDateLongue : jour sur deux chiffres, mois en toutes lettres', () => {
  assert.equal(libelleDateLongue('2028-01-05'), '05 janvier 2028');
  assert.equal(libelleDateLongue('2026-10-31'), '31 octobre 2026');
  assert.equal(libelleDateLongue('2026-02-31'), '');
  assert.equal(libelleDateLongue(null), '');
});
