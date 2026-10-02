// Échanges notés et tâches d'un client (CRM, lot B) : libellés, classement par
// échéance, report, validation des formulaires, historique fusionné et
// conversion en éléments de calendrier. Fonctions pures, sans DOM ni Supabase.
// Une échéance est une date AAAA-MM-JJ sans heure.
import { cleJour, libelleJalon } from './jalons.js';

export const TYPES_ACTIVITE = [
  { valeur: 'note', libelle: 'Note' },
  { valeur: 'appel', libelle: 'Appel' },
  { valeur: 'email', libelle: 'E-mail' },
  { valeur: 'rendez_vous', libelle: 'Rendez-vous' },
  { valeur: 'autre', libelle: 'Autre' },
];

export const TYPES_TACHE = [
  { valeur: 'appel', libelle: 'Appel' },
  { valeur: 'email', libelle: 'E-mail' },
  { valeur: 'relance', libelle: 'Relance' },
  { valeur: 'rendez_vous', libelle: 'Rendez-vous' },
  { valeur: 'autre', libelle: 'Autre' },
];

const MS_JOUR = 24 * 60 * 60 * 1000;
const FORMAT_CLE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function libelleTypeActivite(type) {
  return TYPES_ACTIVITE.find((t) => t.valeur === type)?.libelle ?? type;
}

export function libelleTypeTache(type) {
  return TYPES_TACHE.find((t) => t.valeur === type)?.libelle ?? type;
}

function estVide(v) {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

function propre(v) {
  return estVide(v) ? null : String(v).trim();
}

// Jours entiers depuis le 1er janvier 1970, sans effet des changements d'heure.
function numeroDeJour(cle) {
  const [, a, m, j] = FORMAT_CLE.exec(cle);
  return Date.UTC(Number(a), Number(m) - 1, Number(j)) / MS_JOUR;
}

export function estCleValide(cle) {
  if (typeof cle !== 'string' || !FORMAT_CLE.test(cle)) return false;
  const [, a, m, j] = FORMAT_CLE.exec(cle);
  const d = new Date(Date.UTC(Number(a), Number(m) - 1, Number(j)));
  return d.getUTCFullYear() === Number(a) && d.getUTCMonth() === Number(m) - 1 && d.getUTCDate() === Number(j);
}

// "2026-10-02" + 3 -> "2026-10-05".
export function ajouterJours(cle, jours) {
  return new Date((numeroDeJour(cle) + jours) * MS_JOUR).toISOString().slice(0, 10);
}

// Jours de retard d'une échéance (0 si elle n'est pas dépassée).
export function joursDeRetard(echeance, maintenant = new Date()) {
  return Math.max(0, numeroDeJour(cleJour(maintenant)) - numeroDeJour(echeance));
}

// Texte court : "En retard de 3 jours", "Hier", "Aujourd'hui", "Demain" ou la date.
export function libelleEcheance(echeance, maintenant = new Date()) {
  const ecart = numeroDeJour(echeance) - numeroDeJour(cleJour(maintenant));
  if (ecart < -1) return `En retard de ${-ecart} jours`;
  if (ecart === -1) return 'Hier';
  if (ecart === 0) return 'Aujourd’hui';
  if (ecart === 1) return 'Demain';
  const [a, m, j] = echeance.split('-').map(Number);
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Tâches à faire réparties en retard / aujourd'hui / cette semaine (les six
// jours suivants) / plus tard, chacune triée par échéance puis par création.
export function classerTaches(taches, maintenant = new Date()) {
  const aujourdhui = numeroDeJour(cleJour(maintenant));
  const groupes = { enRetard: [], aujourdhui: [], semaine: [], plusTard: [] };
  const ouvertes = (taches || [])
    .filter((t) => t.statut === 'a_faire')
    .sort((a, b) => a.echeance.localeCompare(b.echeance) || String(a.created_at).localeCompare(String(b.created_at)));
  for (const t of ouvertes) {
    const ecart = numeroDeJour(t.echeance) - aujourdhui;
    if (ecart < 0) groupes.enRetard.push(t);
    else if (ecart === 0) groupes.aujourdhui.push(t);
    else if (ecart <= 6) groupes.semaine.push(t);
    else groupes.plusTard.push(t);
  }
  return groupes;
}

// Formulaire d'une tâche -> ligne à enregistrer. `assignee_id` n'est repris que
// s'il est fourni (un consultant crée toujours pour lui : la base l'impose).
export function preparerTache(valeurs) {
  const tache = {
    titre: propre(valeurs.titre),
    description: propre(valeurs.description),
    type: valeurs.type || 'autre',
    echeance: propre(valeurs.echeance),
    contact_id: propre(valeurs.contact_id),
    demande_id: propre(valeurs.demande_id),
  };
  if ('assignee_id' in valeurs) tache.assignee_id = propre(valeurs.assignee_id);
  return tache;
}

export function validerTache(valeurs) {
  const erreurs = {};
  if (estVide(valeurs.titre)) erreurs.titre = 'Le titre est obligatoire.';
  if (!TYPES_TACHE.some((t) => t.valeur === (valeurs.type || 'autre'))) erreurs.type = 'Type inconnu.';
  if (estVide(valeurs.echeance)) erreurs.echeance = 'L’échéance est obligatoire.';
  else if (!estCleValide(String(valeurs.echeance).trim())) erreurs.echeance = 'Date invalide.';
  return erreurs;
}

// Formulaire d'un échange -> ligne à enregistrer. `date_activite` (saisie
// "datetime-local" ou ISO) est convertie en ISO ; vide, la base met l'instant présent.
export function preparerActivite(valeurs) {
  const activite = {
    type: valeurs.type || 'note',
    objet: propre(valeurs.objet),
    description: propre(valeurs.description),
    contact_id: propre(valeurs.contact_id),
    demande_id: propre(valeurs.demande_id),
  };
  const date = propre(valeurs.date_activite);
  if (date && !Number.isNaN(new Date(date).getTime())) activite.date_activite = new Date(date).toISOString();
  return activite;
}

export function validerActivite(valeurs) {
  const erreurs = {};
  if (estVide(valeurs.objet)) erreurs.objet = 'L’objet est obligatoire.';
  if (!TYPES_ACTIVITE.some((t) => t.valeur === (valeurs.type || 'note'))) erreurs.type = 'Type inconnu.';
  if (!estVide(valeurs.date_activite) && Number.isNaN(new Date(valeurs.date_activite).getTime())) erreurs.date_activite = 'Date invalide.';
  return erreurs;
}

// Historique d'un client : échanges notés et étapes passées de ses demandes,
// du plus récent au plus ancien. Les dates futures et les dates limites ne
// sont pas de l'historique. Élément : { genre: 'activite' | 'etape', id, date,
// titre, detail, type, reference, demande_id }.
export function fusionnerHistorique(activites, jalons, maintenant = new Date()) {
  const limite = new Date(maintenant).getTime();
  const echanges = (activites || []).map((a) => ({
    genre: 'activite',
    id: a.id,
    date: a.date_activite,
    titre: a.objet,
    detail: a.description ?? null,
    type: a.type,
    reference: null,
    demande_id: a.demande_id ?? null,
  }));
  const etapes = (jalons || [])
    .filter((j) => j.type !== 'echeance' && new Date(j.date).getTime() <= limite)
    .map((j) => ({
      genre: 'etape',
      id: `${j.demande_id}:${j.type}:${j.date}`,
      date: j.date,
      titre: libelleJalon(j.type),
      detail: null,
      type: j.type,
      reference: j.reference,
      demande_id: j.demande_id,
    }));
  return [...echanges, ...etapes].sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Tâches à faire -> éléments de calendrier (même forme que les jalons), placés
// à 9 h locales du jour d'échéance. `libelle` porte le titre de la tâche et
// `reference` le nom du client (tache.clients?.raison_sociale ou tache.client).
export function tachesVersJalons(taches) {
  return (taches || [])
    .filter((t) => t.statut === 'a_faire')
    .map((t) => {
      const [a, m, j] = t.echeance.split('-').map(Number);
      return {
        demande_id: t.demande_id ?? null,
        reference: t.clients?.raison_sociale ?? t.client ?? '',
        libelle: t.titre,
        type: 'tache',
        date: new Date(a, m - 1, j, 9).toISOString(),
        client_id: t.client_id,
        href: `#/clients/${t.client_id}/activite`,
      };
    });
}

// Valeur d'un champ "datetime-local" (AAAA-MM-JJThh:mm, heure locale).
export function versChampDatetime(date = new Date()) {
  const d = new Date(date);
  const deux = (n) => String(n).padStart(2, '0');
  return `${cleJour(d)}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
}
