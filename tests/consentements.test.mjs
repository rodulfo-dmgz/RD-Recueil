import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MOIS_CONSERVATION,
  TYPES_CONSENTEMENT,
  consentementActif,
  donneesARevoir,
  etatConsentement,
  libelleEtatConsentement,
  libelleTypeConsentement,
  preparerConsentement,
  sansConsentementEmail,
  validerConsentement,
} from '../app/js/engine/consentements.js';

const MAINTENANT = new Date(2026, 9, 3, 12, 0); // 3 octobre 2026

test('libellés des types et des états', () => {
  assert.deepEqual(TYPES_CONSENTEMENT.map((t) => t.valeur), ['email_commercial', 'telephone', 'lettre_information']);
  assert.equal(libelleTypeConsentement('telephone'), 'Téléphone');
  assert.equal(libelleTypeConsentement('x'), 'x');
  assert.equal(libelleEtatConsentement('non_renseigne'), 'Non renseigné');
  assert.equal(libelleEtatConsentement('expire'), 'Expiré');
});

test('etatConsentement : absent, accordé, refusé, retiré, expiré (jour d’expiration compris)', () => {
  assert.equal(etatConsentement(undefined, MAINTENANT), 'non_renseigne');
  assert.equal(etatConsentement({ statut: 'accorde' }, MAINTENANT), 'accorde');
  assert.equal(etatConsentement({ statut: 'accorde', date_expiration: '2026-10-03' }, MAINTENANT), 'accorde'); // expire à la fin du jour
  assert.equal(etatConsentement({ statut: 'accorde', date_expiration: '2026-10-02' }, MAINTENANT), 'expire');
  assert.equal(etatConsentement({ statut: 'accorde', date_expiration: '2027-01-01' }, MAINTENANT), 'accorde');
  assert.equal(etatConsentement({ statut: 'refuse', date_expiration: '2020-01-01' }, MAINTENANT), 'refuse');
  assert.equal(etatConsentement({ statut: 'retire' }, MAINTENANT), 'retire');
});

test('consentementActif : seulement accordé et non expiré', () => {
  assert.equal(consentementActif({ statut: 'accorde' }, MAINTENANT), true);
  assert.equal(consentementActif({ statut: 'retire' }, MAINTENANT), false);
  assert.equal(consentementActif({ statut: 'accorde', date_expiration: '2025-01-01' }, MAINTENANT), false);
  assert.equal(consentementActif(null, MAINTENANT), false);
});

test('sansConsentementEmail : seulement pour un contact qui a un e-mail', () => {
  const consentements = [
    { contact_id: 'k1', type: 'email_commercial', statut: 'accorde' },
    { contact_id: 'k2', type: 'email_commercial', statut: 'retire' },
    { contact_id: 'k3', type: 'telephone', statut: 'accorde' },
    { contact_id: 'k4', type: 'email_commercial', statut: 'accorde', date_expiration: '2025-12-31' },
  ];
  assert.equal(sansConsentementEmail({ id: 'k1', email: 'a@t.fr' }, consentements, MAINTENANT), false);
  assert.equal(sansConsentementEmail({ id: 'k2', email: 'a@t.fr' }, consentements, MAINTENANT), true); // retiré
  assert.equal(sansConsentementEmail({ id: 'k3', email: 'a@t.fr' }, consentements, MAINTENANT), true); // autre type
  assert.equal(sansConsentementEmail({ id: 'k4', email: 'a@t.fr' }, consentements, MAINTENANT), true); // expiré
  assert.equal(sansConsentementEmail({ id: 'k5', email: 'a@t.fr' }, [], MAINTENANT), true); // jamais renseigné
  assert.equal(sansConsentementEmail({ id: 'k5', email: '  ' }, [], MAINTENANT), false); // pas d'e-mail
  assert.equal(sansConsentementEmail({ id: 'k5' }, undefined, MAINTENANT), false);
});

test('preparerConsentement : textes vides en null', () => {
  assert.deepEqual(
    preparerConsentement({ statut: 'accorde', date_consentement: '2026-10-03', source: ' Formulaire ', preuve: '  ', date_expiration: '' }),
    { statut: 'accorde', date_consentement: '2026-10-03', source: 'Formulaire', preuve: null, date_expiration: null },
  );
});

test('validerConsentement : statut, date, expiration, source obligatoire pour un accord', () => {
  assert.deepEqual(validerConsentement({ statut: 'accorde', date_consentement: '2026-10-03', source: 'Oral' }), {});
  assert.deepEqual(validerConsentement({ statut: 'refuse', date_consentement: '2026-10-03' }), {}); // la source n'est exigée que pour un accord
  assert.deepEqual(validerConsentement({ statut: 'retire', date_consentement: '2026-10-03' }), {});
  assert.ok(validerConsentement({ statut: '', date_consentement: '2026-10-03' }).statut);
  assert.ok(validerConsentement({ statut: 'accorde', date_consentement: '', source: 'x' }).date_consentement);
  assert.ok(validerConsentement({ statut: 'accorde', date_consentement: '03/10/2026', source: 'x' }).date_consentement);
  assert.ok(validerConsentement({ statut: 'accorde', date_consentement: '2026-10-03' }).source);
  assert.ok(validerConsentement({ statut: 'accorde', date_consentement: '2026-10-03', source: 'x', date_expiration: '2026-01-01' }).date_expiration);
  assert.ok(validerConsentement({ statut: 'accorde', date_consentement: '2026-10-03', source: 'x', date_expiration: 'bientôt' }).date_expiration);
  assert.deepEqual(validerConsentement({ statut: 'accorde', date_consentement: '2026-10-03', source: 'x', date_expiration: '2026-10-03' }), {});
});

test('donneesARevoir : fiches sans activité depuis 36 mois, toutes catégories, les plus anciennes d’abord', () => {
  assert.equal(MOIS_CONSERVATION, 36);
  const clients = [
    { id: 'a', raison_sociale: 'Récent', statut: 'client', derniere_activite: '2026-01-01T09:00:00' },
    { id: 'b', raison_sociale: 'Limite', statut: 'prospect', derniere_activite: '2023-10-03T09:00:00' }, // 36 mois pile
    { id: 'c', raison_sociale: 'Ancien archivé', statut: 'archive', derniere_activite: '2021-05-10T09:00:00' },
    { id: 'd', raison_sociale: 'Presque', statut: 'client', derniere_activite: '2023-10-04T09:00:00' }, // 35 mois
    { id: 'e', raison_sociale: 'Sans date', statut: 'client', derniere_activite: null },
  ];
  const r = donneesARevoir({ clients }, { maintenant: MAINTENANT });
  assert.deepEqual(r.fiches.map((f) => f.client.id), ['c', 'b']);
  assert.deepEqual(r.fiches.map((f) => f.moisInactifs), [64, 36]);
  assert.deepEqual(donneesARevoir({ clients }, { maintenant: MAINTENANT, mois: 24 }).fiches.map((f) => f.client.id), ['c', 'b', 'd']); // 35 mois : inclus à 24
  assert.deepEqual(donneesARevoir({ clients }, { maintenant: MAINTENANT, mois: 60 }).fiches.map((f) => f.client.id), ['c']);
});

test('donneesARevoir : consentements expirés avec leur contact et leur fiche', () => {
  const clients = [{ id: 'a', raison_sociale: 'ABC', statut: 'client', derniere_activite: '2026-01-01T09:00:00' }];
  const contacts = [{ id: 'k1', client_id: 'a', prenom: 'Marie', nom: 'Dupont' }, { id: 'k2', client_id: 'a', email: 'x@t.fr' }];
  const consentements = [
    { contact_id: 'k1', type: 'email_commercial', statut: 'accorde', date_expiration: '2026-06-01' },
    { contact_id: 'k2', type: 'telephone', statut: 'accorde', date_expiration: '2026-01-15' },
    { contact_id: 'k1', type: 'telephone', statut: 'accorde', date_expiration: '2027-01-01' }, // pas expiré
    { contact_id: 'k1', type: 'lettre_information', statut: 'retire', date_expiration: '2020-01-01' }, // retiré : rien à revoir
    { contact_id: 'zz', type: 'telephone', statut: 'accorde', date_expiration: '2026-02-01' }, // contact inconnu
  ];
  const r = donneesARevoir({ clients, contacts, consentements }, { maintenant: MAINTENANT });
  assert.deepEqual(r.consentementsExpires.map((e) => [e.nomContact, e.consentement.date_expiration, e.client?.raison_sociale ?? null]), [
    ['x@t.fr', '2026-01-15', 'ABC'],
    ['Contact inconnu', '2026-02-01', null],
    ['Marie Dupont', '2026-06-01', 'ABC'],
  ]);
  assert.deepEqual(donneesARevoir(), { fiches: [], consentementsExpires: [] });
});
