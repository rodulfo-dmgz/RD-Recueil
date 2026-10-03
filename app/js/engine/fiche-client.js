// Fiche client (CRM, lot A) : constantes d'affichage, normalisation du SIRET
// et import des réponses TC-1 (identité) et TC-2 (interlocuteurs) d'une
// demande vers la fiche et les contacts. Fonctions pures : l'import ne remplit
// que ce qui est vide et ne touche jamais à une saisie manuelle.

import { normaliserTexte } from './texte.js';

export const STATUTS_CLIENT = [
  { valeur: 'prospect', libelle: 'Prospect' },
  { valeur: 'client', libelle: 'Client' },
  { valeur: 'archive', libelle: 'Archivé' },
];

export const SOURCES_CLIENT = [
  { valeur: 'site_web', libelle: 'Site web' },
  { valeur: 'recommandation', libelle: 'Recommandation' },
  { valeur: 'linkedin', libelle: 'LinkedIn' },
  { valeur: 'salon', libelle: 'Salon' },
  { valeur: 'partenaire', libelle: 'Partenaire' },
  { valeur: 'ancien_client', libelle: 'Ancien client' },
  { valeur: 'telephone', libelle: 'Téléphone' },
  { valeur: 'autre', libelle: 'Autre' },
];

export const ROLES_CONTACT = [
  { valeur: 'decideur', libelle: 'Décideur' },
  { valeur: 'rh', libelle: 'RH' },
  { valeur: 'financeur', libelle: 'Financeur' },
  { valeur: 'administratif', libelle: 'Administratif' },
  { valeur: 'operationnel', libelle: 'Opérationnel' },
  { valeur: 'referent_handicap', libelle: 'Référent handicap' },
  { valeur: 'autre', libelle: 'Autre' },
];

// Contacts TC-2 repris dans le CRM, avec le ou les rôles qu'ils impliquent.
const CONTACTS_TC2 = [
  { question: 'TC-2.01', roles: ['decideur'] },
  { question: 'TC-2.02', roles: ['operationnel'] },
  { question: 'TC-2.03', roles: ['administratif', 'financeur'] },
  { question: 'TC-2.04', roles: ['referent_handicap'] },
];

const CHAMPS_CONTACT = ['prenom', 'nom', 'fonction', 'email', 'telephone'];

export function estVide(v) {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

// "825 186 786 00018" -> "82518678600018". Chaîne vide si rien d'exploitable.
export function normaliserSiret(siret) {
  return String(siret ?? '').replace(/\D/g, '');
}

export function libelleStatutClient(statut) {
  return STATUTS_CLIENT.find((s) => s.valeur === statut)?.libelle ?? statut;
}

export function libelleRole(role) {
  return ROLES_CONTACT.find((r) => r.valeur === role)?.libelle ?? role;
}

export function nomComplet(contact) {
  return [contact.prenom, contact.nom].filter((p) => !estVide(p)).join(' ');
}

// Réponses d'une demande (lignes { question_id, valeur, nsp }) et questions
// du questionnaire ({ id, options: [{ valeur, libelle }] }) -> ce que la
// demande apprend sur le client. Seules les valeurs renseignées sont
// retournées ; "je ne sais pas" et les réponses NSP sont ignorés.
export function extraireFicheClient(reponses, questions) {
  const parQuestion = new Map((reponses || []).map((r) => [r.question_id, r]));
  const questionParId = new Map((questions || []).map((q) => [q.id, q]));

  function valeurDe(id) {
    const r = parQuestion.get(id);
    if (!r || r.nsp || estVide(r.valeur)) return null;
    return r.valeur;
  }

  function libelleChoix(id) {
    const v = valeurDe(id);
    if (typeof v !== 'string' || v === 'je-ne-sais-pas') return null;
    const options = new Map((questionParId.get(id)?.options || []).map((o) => [o.valeur, o.libelle.replace(/\\?\*/g, '')]));
    return options.get(v) ?? v;
  }

  function texteDe(id) {
    const v = valeurDe(id);
    return typeof v === 'string' ? v.trim() : null;
  }

  const adresse = valeurDe('TC-1.06');
  const brut = {
    forme_juridique: libelleChoix('TC-1.02'),
    siret: normaliserSiret(valeurDe('TC-1.03')) || null,
    code_naf: texteDe('TC-1.04'),
    secteur: texteDe('TC-1.05'),
    adresse: adresse && typeof adresse === 'object' ? texteOuNull(adresse.rue) : null,
    code_postal: adresse && typeof adresse === 'object' ? texteOuNull(adresse.cp) : null,
    ville: adresse && typeof adresse === 'object' ? texteOuNull(adresse.ville) : null,
    effectif: libelleChoix('TC-1.08'),
    opco: libelleChoix('TC-1.10'),
    site_web: texteDe('TC-1.11'),
  };
  const champs = Object.fromEntries(Object.entries(brut).filter(([, v]) => !estVide(v)));

  const contacts = [];
  for (const { question, roles } of CONTACTS_TC2) {
    const v = valeurDe(question);
    if (!v || typeof v !== 'object') continue;
    const contact = {
      nom: texteOuNull(v.nom),
      fonction: texteOuNull(v.fonction),
      email: texteOuNull(v.email)?.toLowerCase() ?? null,
      telephone: texteOuNull(v.tel),
      roles: [...roles],
    };
    if (!contact.nom && !contact.email) continue;
    ajouterOuFusionner(contacts, contact);
  }
  return { champs, contacts };
}

function texteOuNull(v) {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function cleContact(c) {
  return !estVide(c.email) ? `e:${c.email.toLowerCase()}` : `n:${(c.nom ?? '').toLowerCase()}`;
}

// Une même personne citée à plusieurs titres devient un seul contact avec
// plusieurs rôles ; ses champs vides sont complétés par les mentions suivantes.
function ajouterOuFusionner(liste, contact) {
  const existant = liste.find((c) => cleContact(c) === cleContact(contact));
  if (!existant) {
    liste.push(contact);
    return;
  }
  existant.roles = [...new Set([...existant.roles, ...contact.roles])];
  for (const champ of CHAMPS_CONTACT) {
    if (estVide(existant[champ]) && !estVide(contact[champ])) existant[champ] = contact[champ];
  }
}

// Champs à écrire sur la fiche : uniquement ceux que la fiche n'a pas encore.
// `ignores` liste les champs que la demande renseigne mais que la fiche a déjà
// (affichés à l'utilisateur, jamais écrasés).
export function planImportFiche(fiche, extraction) {
  const aAppliquer = {};
  const ignores = [];
  for (const [champ, valeur] of Object.entries(extraction.champs)) {
    if (estVide(fiche?.[champ])) aAppliquer[champ] = valeur;
    else ignores.push(champ);
  }
  return { aAppliquer, ignores };
}

// Compare les contacts extraits à ceux de la fiche : création des nouveaux,
// enrichissement (rôles ajoutés, champs vides complétés) des existants.
// Le premier contact créé devient principal si la fiche n'en a pas encore.
export function planImportContacts(existants, extraits) {
  const liste = existants || [];
  const aCreer = [];
  const aEnrichir = [];
  const dejaIdentiques = [];
  let principalPris = liste.some((c) => c.principal);

  for (const extrait of extraits || []) {
    const cle = cleContact(extrait);
    const existant = liste.find((c) => cleContact(c) === cle);
    if (!existant) {
      const principal = !principalPris;
      if (principal) principalPris = true;
      aCreer.push({ ...extrait, nom: extrait.nom ?? extrait.email, principal });
      continue;
    }
    const roles = [...new Set([...(existant.roles || []), ...extrait.roles])];
    const champs = {};
    for (const champ of CHAMPS_CONTACT) {
      if (estVide(existant[champ]) && !estVide(extrait[champ])) champs[champ] = extrait[champ];
    }
    if (roles.length === (existant.roles || []).length && Object.keys(champs).length === 0) {
      dejaIdentiques.push(existant.id);
    } else {
      aEnrichir.push({ id: existant.id, roles, ...champs });
    }
  }
  return { aCreer, aEnrichir, dejaIdentiques };
}

// Liste des clients : recherche insensible à la casse et aux accents (nom,
// nom commercial, ville, contact principal, e-mail, SIRET avec ou sans
// espaces) et filtre de statut. Sans filtre de statut, les archivés sont
// masqués.
export function filtrerClients(clients, { recherche = '', statut = '' } = {}) {
  const terme = normaliserTexte(recherche);
  const termeChiffres = normaliserSiret(recherche);
  return (clients || []).filter((c) => {
    if (statut ? c.statut !== statut : c.statut === 'archive') return false;
    if (!terme) return true;
    const texte = [c.raison_sociale, c.nom_commercial, c.ville, c.contact_principal, c.email_general].map(normaliserTexte).join(' ');
    return texte.includes(terme) || (termeChiffres.length >= 3 && normaliserSiret(c.siret).includes(termeChiffres));
  });
}

// Suggestions de saisie : mêmes libellés que les choix TC-1.02, TC-1.08 et
// TC-1.10 du questionnaire (un test le vérifie), mais la saisie reste libre.
// Libellés des choix TC-1.02, TC-1.08 et TC-1.10 du questionnaire, par valeur
// (un test vérifie qu'ils restent identiques). Servent de suggestions de
// saisie et à convertir les données SIRENE ; la saisie reste libre.
const FORMES_PAR_VALEUR = {
  sarl: 'SARL',
  sas: 'SAS',
  sasu: 'SASU',
  eurl: 'EURL',
  sa: 'SA',
  'entreprise-individuelle': 'Entreprise individuelle',
  association: 'Association',
  'collectivite-territoriale': 'Collectivité territoriale',
  'etablissement-public': 'Établissement public',
  autre: 'Autre',
};
const EFFECTIFS_PAR_VALEUR = {
  'moins-de-11-salaries': 'Moins de 11 salariés',
  '11-a-49': '11 à 49',
  '50-a-249': '50 à 249',
  '250-a-999': '250 à 999',
  '1-000-et-plus': '1 000 et plus',
};
export const FORMES_JURIDIQUES = Object.values(FORMES_PAR_VALEUR);
export const EFFECTIFS = Object.values(EFFECTIFS_PAR_VALEUR);
export const OPCOS = [
  'AFDAS', 'AKTO', 'ATLAS', 'Constructys', 'OCAPIAT', 'OPCO 2i', 'OPCO Cohésion sociale',
  'OPCO Commerce', 'OPCO EP', 'OPCO Mobilités', 'OPCO Santé',
];

// Données d'une recherche SIRENE (services/entreprises.js) -> champs de la
// fiche, uniquement ceux que la recherche renseigne.
export function ficheDepuisSirene(etablissement) {
  const brut = {
    raison_sociale: etablissement.raisonSociale,
    code_naf: etablissement.codeNaf,
    secteur: etablissement.secteurActivite,
    forme_juridique: FORMES_PAR_VALEUR[etablissement.formeJuridique],
    effectif: EFFECTIFS_PAR_VALEUR[etablissement.effectif],
    adresse: etablissement.adresse?.rue,
    code_postal: etablissement.adresse?.cp,
    ville: etablissement.adresse?.ville,
  };
  return Object.fromEntries(Object.entries(brut).filter(([, v]) => !estVide(v)));
}

// Champs texte de la fiche, dans l'ordre d'affichage : `groupe` regroupe
// l'affichage, `suggestions` alimente une liste de saisie.
export const CHAMPS_FICHE = [
  { cle: 'raison_sociale', libelle: 'Raison sociale', groupe: 'Identité', obligatoire: true },
  { cle: 'nom_commercial', libelle: 'Nom commercial', groupe: 'Identité' },
  { cle: 'siret', libelle: 'SIRET', groupe: 'Identité' },
  { cle: 'forme_juridique', libelle: 'Forme juridique', groupe: 'Identité', suggestions: FORMES_JURIDIQUES },
  { cle: 'code_naf', libelle: 'Code NAF', groupe: 'Identité' },
  { cle: 'secteur', libelle: 'Secteur d’activité', groupe: 'Identité' },
  { cle: 'effectif', libelle: 'Effectif', groupe: 'Identité', suggestions: EFFECTIFS },
  { cle: 'opco', libelle: 'OPCO', groupe: 'Identité', suggestions: OPCOS },
  { cle: 'adresse', libelle: 'Adresse', groupe: 'Coordonnées' },
  { cle: 'code_postal', libelle: 'Code postal', groupe: 'Coordonnées' },
  { cle: 'ville', libelle: 'Ville', groupe: 'Coordonnées' },
  { cle: 'telephone', libelle: 'Téléphone', groupe: 'Coordonnées', type: 'tel' },
  { cle: 'email_general', libelle: 'E-mail général', groupe: 'Coordonnées', type: 'email' },
  { cle: 'site_web', libelle: 'Site web', groupe: 'Coordonnées', type: 'url' },
];

export function libelleChampFiche(cle) {
  return CHAMPS_FICHE.find((c) => c.cle === cle)?.libelle ?? cle;
}

// Valeurs du formulaire (chaînes) -> ligne à enregistrer : espaces retirés,
// vides remplacés par null, SIRET sans espaces. `statut` et `responsable_id`
// ne sont repris que s'ils sont fournis.
export function preparerFiche(valeurs) {
  const propre = (v) => (estVide(v) ? null : String(v).trim());
  const fiche = {};
  for (const { cle } of CHAMPS_FICHE) fiche[cle] = propre(valeurs[cle]);
  fiche.siret = normaliserSiret(valeurs.siret) || null;
  fiche.notes = propre(valeurs.notes);
  fiche.source = propre(valeurs.source);
  if ('statut' in valeurs) fiche.statut = valeurs.statut;
  if ('responsable_id' in valeurs) fiche.responsable_id = propre(valeurs.responsable_id);
  return fiche;
}

// Erreurs de saisie par champ ({} si tout va bien).
export function validerFiche(valeurs) {
  const erreurs = {};
  if (estVide(valeurs.raison_sociale)) erreurs.raison_sociale = 'La raison sociale est obligatoire.';
  const chiffres = normaliserSiret(valeurs.siret);
  if (!estVide(valeurs.siret) && chiffres.length !== 14) erreurs.siret = 'Le SIRET compte 14 chiffres.';
  if (!estVide(valeurs.email_general) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeurs.email_general.trim())) {
    erreurs.email_general = 'Adresse e-mail invalide.';
  }
  return erreurs;
}

// Questions dont les réponses alimentent la fiche et les contacts.
export const QUESTIONS_IMPORT = [
  'TC-1.02', 'TC-1.03', 'TC-1.04', 'TC-1.05', 'TC-1.06', 'TC-1.08', 'TC-1.10', 'TC-1.11',
  ...CONTACTS_TC2.map((c) => c.question),
];

// Valeurs du formulaire d'un contact -> ligne à enregistrer. L'e-mail est
// enregistré en minuscules (l'unicité par client y est insensible à la casse).
export function preparerContact(valeurs) {
  const propre = (v) => (estVide(v) ? null : String(v).trim());
  const rolesValides = new Set(ROLES_CONTACT.map((r) => r.valeur));
  return {
    prenom: propre(valeurs.prenom),
    nom: propre(valeurs.nom),
    fonction: propre(valeurs.fonction),
    email: propre(valeurs.email)?.toLowerCase() ?? null,
    telephone: propre(valeurs.telephone),
    roles: [...new Set((valeurs.roles || []).filter((r) => rolesValides.has(r)))],
    principal: Boolean(valeurs.principal),
    actif: valeurs.actif !== false,
    notes: propre(valeurs.notes),
  };
}

export function validerContact(valeurs) {
  const erreurs = {};
  if (estVide(valeurs.nom)) erreurs.nom = 'Le nom est obligatoire.';
  if (!estVide(valeurs.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeurs.email.trim())) erreurs.email = 'Adresse e-mail invalide.';
  return erreurs;
}
