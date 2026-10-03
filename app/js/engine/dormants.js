// Clients dormants (CRM, lot E). Fonctions pures.
//
// Un client est dormant quand il a déjà acheté (au moins une demande gagnée),
// n'a aucune demande en cours et n'a eu aucune activité depuis `mois` mois.
// L'activité est celle de v_clients.derniere_activite : fiche, demandes et
// échanges (les tâches n'y comptent pas). Les prospects et les archivés ne sont
// jamais dormants.

import { cleJour } from './jalons.js';
import { preparerTache } from './taches.js';

export const SEUILS_DORMANT = [6, 9, 12, 18, 24];
export const SEUIL_DORMANT_DEFAUT = 12;

// Mois entiers écoulés entre deux dates (jamais négatif).
export function moisEcoules(depuis, maintenant = new Date()) {
  const d = new Date(depuis);
  const n = new Date(maintenant);
  let mois = (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
  if (n.getDate() < d.getDate()) mois -= 1;
  return Math.max(0, mois);
}

// "14 mois", "1 mois", "moins d'un mois".
export function libelleInactivite(mois) {
  if (mois < 1) return 'moins d’un mois';
  return `${mois} mois`;
}

// clients : lignes de v_clients. Les plus anciennement actifs d'abord.
export function clientsDormants(clients = [], { mois = SEUIL_DORMANT_DEFAUT, maintenant = new Date() } = {}) {
  return clients
    .filter((c) => c.statut === 'client' && Number(c.nb_gagnees) > 0 && Number(c.nb_actives) === 0 && c.derniere_activite)
    .map((c) => ({ ...c, moisInactifs: moisEcoules(c.derniere_activite, maintenant) }))
    .filter((c) => c.moisInactifs >= mois)
    .sort((a, b) => new Date(a.derniere_activite) - new Date(b.derniere_activite));
}

// Tâche "Relancer <client>" du jour. `assignee_id` n'est repris que s'il est
// fourni (un consultant crée toujours pour lui : la base l'impose).
export function preparerRelanceDormant(client, { assigneeId, maintenant = new Date() } = {}) {
  const valeurs = {
    titre: `Relancer ${client.raison_sociale}`,
    description: `Client dormant : dernière activité il y a ${libelleInactivite(moisEcoules(client.derniere_activite, maintenant))}.`,
    type: 'relance',
    echeance: cleJour(maintenant),
  };
  if (assigneeId) valeurs.assignee_id = assigneeId;
  return preparerTache(valeurs);
}
