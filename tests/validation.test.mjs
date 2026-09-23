import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validerReponse, validerFichierDepot } from '../app/js/engine/validation.js';

function q(overrides) {
  return { id: 'Q', type: 'texte', obligatoire: true, options: [], ...overrides };
}

test('texte : longueur 1 à 300', () => {
  assert.equal(validerReponse(q({ type: 'texte' }), { valeur: 'bonjour' }), null);
  assert.match(validerReponse(q({ type: 'texte' }), { valeur: 'x'.repeat(301) }), /300/);
});

test('obligatoire vide -> erreur, facultatif vide -> ok', () => {
  assert.match(validerReponse(q({ obligatoire: true }), { valeur: '' }), /obligatoire/i);
  assert.equal(validerReponse(q({ obligatoire: false }), { valeur: '' }), null);
});

test('nsp="Je ne sais pas" rend toute réponse valide', () => {
  assert.equal(validerReponse(q({ obligatoire: true, type: 'siret' }), { valeur: null, nsp: true }), null);
});

test('nombre : entier positif', () => {
  assert.equal(validerReponse(q({ type: 'nombre' }), { valeur: 12 }), null);
  assert.match(validerReponse(q({ type: 'nombre' }), { valeur: -1 }), /entier/i);
  assert.match(validerReponse(q({ type: 'nombre' }), { valeur: 1.5 }), /entier/i);
});

test('montant : positif, 2 décimales max', () => {
  assert.equal(validerReponse(q({ type: 'montant' }), { valeur: 2400.5 }), null);
  assert.match(validerReponse(q({ type: 'montant' }), { valeur: 2400.555 }), /décimales/i);
});

test('date : ISO 8601', () => {
  assert.equal(validerReponse(q({ type: 'date' }), { valeur: '2026-11-02' }), null);
  assert.match(validerReponse(q({ type: 'date' }), { valeur: '02/11/2026' }), /date/i);
});

test('periode : fin >= début', () => {
  const question = q({ type: 'periode' });
  assert.equal(validerReponse(question, { valeur: { debut: '2026-01-01', fin: '2026-02-01' } }), null);
  assert.match(validerReponse(question, { valeur: { debut: '2026-02-01', fin: '2026-01-01' } }), /postérieure/i);
});

test('choix_unique : valeur dans les options', () => {
  const question = q({ type: 'choix_unique', options: [{ valeur: 'a' }, { valeur: 'b' }] });
  assert.equal(validerReponse(question, { valeur: 'a' }), null);
  assert.match(validerReponse(question, { valeur: 'c' }), /invalide/i);
});

test('choix_multiple : au moins 1 si obligatoire', () => {
  const question = q({ type: 'choix_multiple', obligatoire: true, options: [{ valeur: 'a' }, { valeur: 'b' }] });
  assert.equal(validerReponse(question, { valeur: ['a'] }), null);
  assert.match(validerReponse(question, { valeur: [] }), /au moins une/i);
});

test('oui_non', () => {
  const question = q({ type: 'oui_non' });
  assert.equal(validerReponse(question, { valeur: 'oui' }), null);
  assert.match(validerReponse(question, { valeur: 'peut-être' }), /oui.*non/i);
});

test('classement : toutes les valeurs présentes', () => {
  const question = q({ type: 'classement', options: [{ valeur: 'a' }, { valeur: 'b' }, { valeur: 'c' }] });
  assert.equal(validerReponse(question, { valeur: ['c', 'a', 'b'] }), null);
  assert.match(validerReponse(question, { valeur: ['a', 'b'] }), /tous les éléments/i);
});

test('tableau : au moins une ligne si obligatoire', () => {
  const question = q({ type: 'tableau', obligatoire: true });
  assert.equal(validerReponse(question, { valeur: [{ a: '1' }] }), null);
  assert.match(validerReponse(question, { valeur: [] }), /ligne/i);
});

test('contact : nom + e-mail obligatoires, e-mail valide', () => {
  const question = q({ type: 'contact', obligatoire: false });
  assert.equal(validerReponse(question, { valeur: { nom: 'Dupont', email: 'a@b.fr' } }), null);
  assert.match(validerReponse(question, { valeur: { nom: 'Dupont', email: 'pas-un-email' } }), /invalide/i);
  assert.match(validerReponse(question, { valeur: { nom: '', email: 'a@b.fr' } }), /obligatoire/i);
});

test('adresse : code postal à 5 chiffres', () => {
  const question = q({ type: 'adresse', obligatoire: false });
  assert.equal(validerReponse(question, { valeur: { rue: '1 rue X', cp: '75001', ville: 'Paris' } }), null);
  assert.match(validerReponse(question, { valeur: { rue: '1 rue X', cp: '750', ville: 'Paris' } }), /postal/i);
});

test('siret : 14 chiffres + clé de Luhn', () => {
  const question = q({ type: 'siret', obligatoire: false });

  // Génère un SIRET valide (algorithme de Luhn) sans dépendre d'un vrai numéro connu.
  const base13 = '1234567890123';
  let somme = 0;
  for (let j = 0; j < base13.length; j++) {
    let n = Number(base13[base13.length - 1 - j]);
    if (j % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  const cle = (10 - (somme % 10)) % 10;
  const siretValide = base13 + cle;

  assert.equal(validerReponse(question, { valeur: siretValide }), null);
  assert.match(validerReponse(question, { valeur: '00000000000001' }), /clé/i);
  assert.match(validerReponse(question, { valeur: '123' }), /14 chiffres/i);
});

test('url : http(s) uniquement', () => {
  const question = q({ type: 'url', obligatoire: false });
  assert.equal(validerReponse(question, { valeur: 'https://rd-formation.com' }), null);
  assert.match(validerReponse(question, { valeur: 'pas-une-url' }), /invalide/i);
});

test('fichier : dépôt - taille et extension', () => {
  assert.equal(validerFichierDepot({ nom: 'fiche.pdf', taille: 1000 }), null);
  assert.match(validerFichierDepot({ nom: 'fiche.exe', taille: 1000 }), /autorisé/i);
  assert.match(validerFichierDepot({ nom: 'gros.pdf', taille: 21 * 1024 * 1024 }), /volumineux/i);
});
