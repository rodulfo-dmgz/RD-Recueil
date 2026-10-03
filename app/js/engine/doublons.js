// Détection et fusion de clients en doublon (CRM, lot E). Fonctions pures :
// l'écran propose les couples, la base fait la fusion (rpc_fusionner_clients).
//
// Deux clients forment un doublon possible quand :
//  - leurs noms sont proches (mêmes mots, ou tous les mots de l'un dans l'autre,
//    accents, casse et formes juridiques ignorés) ET ils sont dans la même ville
//    ou ont le même code postal ;
//  - ou ils ont chacun un contact de même e-mail.
// Un SIRET identique est déjà impossible (index unique en base).

import { chiffres, normaliserMots, normaliserTexte } from './texte.js';
import { CHAMPS_FICHE, estVide, nomComplet } from './fiche-client.js';

// Mots sans valeur pour reconnaître un nom d'entreprise.
const MOTS_VIDES = new Set([
  'sarl', 'sas', 'sasu', 'eurl', 'sa', 'snc', 'sci', 'scop', 'selarl', 'ste', 'societe', 'ets', 'etablissements',
  'et', 'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd',
]);

// "ABC Formation SAS" -> ["abc", "formation"] (triés, sans doublon).
export function jetonsNom(nom) {
  const jetons = normaliserMots(nom)
    .split(' ')
    .filter((m) => m.length >= 1 && !MOTS_VIDES.has(m));
  return [...new Set(jetons)].sort();
}

// Mêmes mots, ou tous les mots du plus court dans l'autre (au moins 4 lettres
// au total pour éviter de rapprocher "AB" de tout ce qui contient "AB").
export function nomsProches(a, b) {
  const ja = jetonsNom(a);
  const jb = jetonsNom(b);
  if (ja.length === 0 || jb.length === 0) return false;
  const [court, long] = ja.length <= jb.length ? [ja, jb] : [jb, ja];
  if (court.join('').length < 4) return false;
  return court.every((j) => long.includes(j));
}

// Clé stable d'un couple : le plus petit identifiant d'abord, comme la table
// `doublons_ignores` (client_a < client_b).
export function cleCouple(idA, idB) {
  const [a, b] = [String(idA).toLowerCase(), String(idB).toLowerCase()].sort();
  return `${a}|${b}`;
}

function nomsDuClient(c) {
  return [c.raison_sociale, c.nom_commercial].filter((n) => !estVide(n));
}

function memeLieu(a, b) {
  const villeA = normaliserMots(a.ville);
  const villeB = normaliserMots(b.ville);
  const cpA = chiffres(a.code_postal);
  const cpB = chiffres(b.code_postal);
  return (villeA !== '' && villeA === villeB) || (cpA !== '' && cpA === cpB);
}

// clients : lignes de v_clients ; contacts : { client_id, email, prenom, nom } ;
// ignores : lignes de doublons_ignores ({ client_a, client_b }). Les clients
// archivés sont écartés. Retourne les couples { a, b, raisons } (a et b : les
// deux fiches), ceux qui cumulent le plus de raisons en premier.
export function detecterDoublons(clients = [], contacts = [], ignores = []) {
  const actifs = clients.filter((c) => c.statut !== 'archive');
  const ignorees = new Set(ignores.map((i) => cleCouple(i.client_a, i.client_b)));
  const couples = new Map();
  const ajouter = (a, b, raison) => {
    const cle = cleCouple(a.id, b.id);
    if (ignorees.has(cle)) return;
    const couple = couples.get(cle) ?? { cle, a, b, raisons: [] };
    if (!couple.raisons.some((r) => r.type === raison.type && r.detail === raison.detail)) couple.raisons.push(raison);
    couples.set(cle, couple);
  };

  // Noms proches dans un même lieu : on ne compare que les clients d'une même
  // ville ou d'un même code postal.
  const seaux = new Map();
  const classer = (cle, valeur, c) => {
    if (valeur === '') return;
    if (!seaux.has(`${cle}:${valeur}`)) seaux.set(`${cle}:${valeur}`, []);
    seaux.get(`${cle}:${valeur}`).push(c);
  };
  for (const c of actifs) {
    classer('ville', normaliserMots(c.ville), c);
    classer('cp', chiffres(c.code_postal), c);
  }
  for (const groupe of seaux.values()) {
    for (let i = 0; i < groupe.length; i += 1) {
      for (let j = i + 1; j < groupe.length; j += 1) {
        const [a, b] = [groupe[i], groupe[j]];
        if (a.id === b.id || !memeLieu(a, b)) continue;
        if (nomsDuClient(a).some((na) => nomsDuClient(b).some((nb) => nomsProches(na, nb)))) {
          ajouter(a, b, { type: 'nom', detail: 'Noms proches, même ville ou même code postal' });
        }
      }
    }
  }

  // Un même e-mail de contact chez deux clients.
  const parId = new Map(actifs.map((c) => [c.id, c]));
  const parEmail = new Map();
  for (const k of contacts) {
    const email = normaliserTexte(k.email);
    if (email === '' || !parId.has(k.client_id)) continue;
    if (!parEmail.has(email)) parEmail.set(email, new Map());
    parEmail.get(email).set(k.client_id, k);
  }
  for (const [email, clientsDuMail] of parEmail) {
    const ids = [...clientsDuMail.keys()];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        ajouter(parId.get(ids[i]), parId.get(ids[j]), { type: 'contact', detail: `Contact de même e-mail : ${email}` });
      }
    }
  }

  return [...couples.values()].sort(
    (x, y) => y.raisons.length - x.raisons.length || String(x.a.raison_sociale).localeCompare(String(y.a.raison_sociale), 'fr')
  );
}

// Ce que la fusion de `absorbe` dans `garde` va faire, pour le résumé affiché
// avant confirmation. Reproduit les règles de rpc_fusionner_clients (0045) ;
// la base reste seule juge. `comptes` : { demandes, activites, taches } de la
// fiche absorbée (nombres fournis par l'écran).
export function planifierFusion({ garde, absorbe, contactsGarde = [], contactsAbsorbe = [], comptes = {} }) {
  const champs = [...CHAMPS_FICHE.filter((c) => c.cle !== 'raison_sociale'), { cle: 'source', libelle: 'Source' }];
  const completes = champs
    .filter((c) => estVide(garde[c.cle]) && !estVide(absorbe[c.cle]))
    .map((c) => ({ cle: c.cle, libelle: c.libelle, valeur: String(absorbe[c.cle]).trim() }));
  const emailsGarde = new Set(contactsGarde.map((k) => normaliserTexte(k.email)).filter((e) => e !== ''));
  const fusionnes = [];
  const deplaces = [];
  for (const k of contactsAbsorbe) {
    const email = normaliserTexte(k.email);
    (email !== '' && emailsGarde.has(email) ? fusionnes : deplaces).push(nomComplet(k) || k.email || 'Contact sans nom');
  }
  const principalGarde = contactsGarde.some((k) => k.principal);
  const principalPerdu = principalGarde && contactsAbsorbe.some((k) => k.principal && !emailsGarde.has(normaliserTexte(k.email)));
  return {
    demandes: comptes.demandes ?? 0,
    activites: comptes.activites ?? 0,
    taches: comptes.taches ?? 0,
    contactsDeplaces: deplaces,
    contactsFusionnes: fusionnes,
    principalPerdu,
    champsCompletes: completes,
    devientClient: garde.statut === 'prospect' && absorbe.statut === 'client',
    notesAjoutees: !estVide(absorbe.notes),
    responsableRepris: !garde.responsable_id && Boolean(absorbe.responsable_id),
  };
}
