// Aperçu d'une demande dans le tiroir latéral (liste des demandes) : l'essentiel
// et les accès directs, sans quitter la liste.
import { ouvrirTiroir } from './tiroir.js';
import { ligne } from './apercu-client.js';
import { el, lienBouton } from './dashboard-ui.js';
import { formaterDate } from '../engine/dates.js';
import { LIBELLES_STATUT, LIBELLES_TYPE, categorieStatut } from '../engine/statuts.js';

// demande : ligne de listerDemandes ; consultant : nom à afficher (admin seulement, sinon rien).
export function ouvrirApercuDemande(demande, { consultant } = {}) {
  const pastille = el('span', `cl-statut cl-statut--${categorieStatut(demande.statut)}`);
  pastille.append(el('span', 'cl-statut__point'), LIBELLES_STATUT[demande.statut] ?? demande.statut);

  const liste = el('dl', 'tiroir-fiche');
  liste.append(
    ligne('Statut', pastille),
    ligne('Client', demande.clients?.raison_sociale),
    ligne('Types', (demande.types || []).map((t) => LIBELLES_TYPE[t] ?? t).join(', '))
  );
  if (consultant !== undefined) liste.appendChild(ligne('Consultant', consultant ?? 'Non attribuée'));
  liste.append(ligne('Date limite', demande.date_limite ? formaterDate(demande.date_limite) : ''), ligne('Créée le', formaterDate(demande.created_at)));
  if (demande.archivee) liste.appendChild(ligne('Archivage', 'Demande archivée'));

  const base = `#/demandes/${demande.reference}`;
  const actions = [
    lienBouton(base, 'db-btn db-btn--primaire', 'Ouvrir la demande', 'arrow-right'),
    lienBouton(`${base}/cadrage`, 'db-btn db-btn--discret', 'Note de cadrage', 'file-text'),
  ];
  if (demande.client_id) actions.push(lienBouton(`#/clients/${demande.client_id}`, 'db-btn db-btn--discret', 'Fiche client', 'building-2'));
  return ouvrirTiroir({ titre: demande.reference, sousTitre: demande.clients?.raison_sociale || undefined, corps: liste, actions });
}
