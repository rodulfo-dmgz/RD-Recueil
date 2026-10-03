// Aperçu d'un client dans le tiroir latéral (liste des clients) : l'essentiel de la
// fiche et les accès directs, sans quitter la liste. Le CA signé n'est montré
// qu'à l'admin.
import { ouvrirTiroir } from './tiroir.js';
import { el, lienBouton } from './dashboard-ui.js';
import { formaterDate } from '../engine/dates.js';
import { formaterMontant } from '../engine/finance.js';
import { libelleStatutClient } from '../engine/fiche-client.js';
import { initiales } from '../engine/texte.js';

// Pastille d'une personne : initiales et nom.
export function pastillePersonne(nom) {
  const chip = el('span', 'chip');
  chip.append(el('span', 'chip__avatar', initiales(nom)), el('span', 'chip__nom', nom));
  return chip;
}

export function ligne(libelle, valeur) {
  const bloc = el('div', 'tiroir-fiche__ligne');
  bloc.append(el('dt', null, libelle));
  const dd = el('dd');
  if (valeur instanceof Node) dd.appendChild(valeur);
  else dd.textContent = valeur === null || valeur === undefined || valeur === '' ? '-' : String(valeur);
  bloc.appendChild(dd);
  return bloc;
}

export function ouvrirApercuClient(client, { avecFinance = false } = {}) {
  const pastille = el('span', `cl-statut cl-statut--${client.statut}`);
  pastille.append(el('span', 'cl-statut__point'), libelleStatutClient(client.statut));

  const liste = el('dl', 'tiroir-fiche');
  liste.append(
    ligne('Statut', pastille),
    ligne('SIRET', client.siret),
    ligne('Ville', client.ville),
    ligne('Contact principal', client.contact_principal ? pastillePersonne(client.contact_principal) : '-'),
    ligne('Demandes', client.nb_demandes ? `${client.nb_demandes}${client.nb_actives > 0 ? ` dont ${client.nb_actives} en cours` : ''}` : 'Aucune'),
    ligne('Tâches ouvertes', client.nb_taches_ouvertes > 0 ? String(client.nb_taches_ouvertes) : 'Aucune'),
    ligne('Dernière activité', formaterDate(client.derniere_activite))
  );
  if (avecFinance) liste.appendChild(ligne('CA signé', client.ca_signe > 0 ? formaterMontant(client.ca_signe) : '-'));
  if (client.email_general) liste.appendChild(ligne('E-mail', client.email_general));
  if (client.telephone) liste.appendChild(ligne('Téléphone', client.telephone));

  const base = `#/clients/${client.id}`;
  return ouvrirTiroir({
    titre: client.raison_sociale,
    sousTitre: client.nom_commercial || undefined,
    corps: liste,
    actions: [
      lienBouton(base, 'db-btn db-btn--primaire', 'Ouvrir la fiche', 'arrow-right'),
      lienBouton(`${base}/contacts`, 'db-btn db-btn--discret', 'Contacts', 'users'),
      lienBouton(`${base}/demandes`, 'db-btn db-btn--discret', 'Demandes', 'layout-list'),
    ],
  });
}
