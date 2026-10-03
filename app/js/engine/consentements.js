// Consentements des contacts et données à revoir (CRM, lot F). Fonctions pures.
//
// Un consentement par contact et par type : son état courant (accordé, refusé,
// retiré) avec la date, la source, la preuve en texte libre et l'expiration.

import { cleJour } from './jalons.js';
import { moisEcoules } from './dormants.js';
import { estVide, nomComplet } from './fiche-client.js';

export const TYPES_CONSENTEMENT = [
  { valeur: 'email_commercial', libelle: 'E-mail commercial' },
  { valeur: 'telephone', libelle: 'Téléphone' },
  { valeur: 'lettre_information', libelle: 'Lettre d’information' },
];

export const STATUTS_CONSENTEMENT = [
  { valeur: 'accorde', libelle: 'Accordé' },
  { valeur: 'refuse', libelle: 'Refusé' },
  { valeur: 'retire', libelle: 'Retiré' },
];

// Suggestions pour "comment le consentement a été obtenu" (la saisie reste libre).
export const SOURCES_CONSENTEMENT = ['Formulaire', 'Oral (appel ou rendez-vous)', 'E-mail', 'Salon', 'Contrat', 'Autre'];

// Durée de conservation des fiches sans activité (section 8.3 de l'architecture).
export const MOIS_CONSERVATION = 36;

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function libelleTypeConsentement(type) {
  return TYPES_CONSENTEMENT.find((t) => t.valeur === type)?.libelle ?? type;
}

const LIBELLES_ETAT = { non_renseigne: 'Non renseigné', accorde: 'Accordé', refuse: 'Refusé', retire: 'Retiré', expire: 'Expiré' };

export function libelleEtatConsentement(etat) {
  return LIBELLES_ETAT[etat] ?? etat;
}

// État d'un consentement (ou de son absence) : un consentement accordé dont la
// date d'expiration est dépassée est "expiré".
export function etatConsentement(consentement, maintenant = new Date()) {
  if (!consentement) return 'non_renseigne';
  if (consentement.statut === 'accorde' && consentement.date_expiration && consentement.date_expiration < cleJour(maintenant)) return 'expire';
  return consentement.statut;
}

export function consentementActif(consentement, maintenant = new Date()) {
  return etatConsentement(consentement, maintenant) === 'accorde';
}

// Un contact qui a une adresse e-mail sans consentement actif à l'e-mail commercial.
export function sansConsentementEmail(contact, consentements = [], maintenant = new Date()) {
  if (estVide(contact.email)) return false;
  const consentement = consentements.find((c) => c.contact_id === contact.id && c.type === 'email_commercial');
  return !consentementActif(consentement, maintenant);
}

function propre(v) {
  return estVide(v) ? null : String(v).trim();
}

// Formulaire -> ligne de `consentements` (sans contact_id ni type).
export function preparerConsentement(valeurs) {
  return {
    statut: valeurs.statut,
    date_consentement: propre(valeurs.date_consentement),
    source: propre(valeurs.source),
    preuve: propre(valeurs.preuve),
    date_expiration: propre(valeurs.date_expiration),
  };
}

export function validerConsentement(valeurs) {
  const erreurs = {};
  if (!STATUTS_CONSENTEMENT.some((s) => s.valeur === valeurs.statut)) erreurs.statut = 'Choisissez un statut.';
  const date = propre(valeurs.date_consentement);
  const expiration = propre(valeurs.date_expiration);
  if (!date || !FORMAT_DATE.test(date)) erreurs.date_consentement = 'Indiquez la date.';
  if (expiration && !FORMAT_DATE.test(expiration)) erreurs.date_expiration = 'Date d’expiration invalide.';
  else if (expiration && date && FORMAT_DATE.test(date) && expiration < date) erreurs.date_expiration = 'L’expiration ne peut pas précéder la date du consentement.';
  if (valeurs.statut === 'accorde' && !propre(valeurs.source)) erreurs.source = 'Indiquez comment le consentement a été obtenu.';
  return erreurs;
}

// Écran "Données à revoir" (admin). clients : lignes de v_clients ; contacts :
// { id, client_id, prenom, nom } ; consentements : lignes de `consentements`.
//  - fiches : clients et prospects (archivés compris) sans activité depuis
//    `mois` mois ou plus, les plus anciennes d'abord ;
//  - consentementsExpires : consentements accordés dont l'expiration est dépassée.
export function donneesARevoir({ clients = [], contacts = [], consentements = [] } = {}, { maintenant = new Date(), mois = MOIS_CONSERVATION } = {}) {
  const fiches = clients
    .filter((c) => c.derniere_activite)
    .map((c) => ({ client: c, moisInactifs: moisEcoules(c.derniere_activite, maintenant) }))
    .filter((f) => f.moisInactifs >= mois)
    .sort((a, b) => new Date(a.client.derniere_activite) - new Date(b.client.derniere_activite));
  const contactParId = new Map(contacts.map((k) => [k.id, k]));
  const clientParId = new Map(clients.map((c) => [c.id, c]));
  const consentementsExpires = consentements
    .filter((c) => etatConsentement(c, maintenant) === 'expire')
    .map((c) => {
      const contact = contactParId.get(c.contact_id) ?? null;
      return { consentement: c, contact, nomContact: contact ? nomComplet(contact) || contact.email || 'Contact sans nom' : 'Contact inconnu', client: contact ? clientParId.get(contact.client_id) ?? null : null };
    })
    .sort((a, b) => a.consentement.date_expiration.localeCompare(b.consentement.date_expiration));
  return { fiches, consentementsExpires };
}
