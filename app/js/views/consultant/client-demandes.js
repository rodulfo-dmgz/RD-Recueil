// Onglets Demandes et Documents de la fiche client (CRM, lot A). Réservé au staff.
import { listerDocumentsClient } from '../../services/documents.js';
import { chargerReponsesStaff } from '../../services/reponses.js';
import { afficherToast } from '../../components/toast.js';
import { creerCarteListe } from '../../components/liste-navigation.js';
import { construireLignesDemande } from '../../components/documents-demande.js';
import { el, icone, lienBouton } from '../../components/dashboard-ui.js';
import { LIBELLES_STATUT, LIBELLES_TYPE, categorieStatut } from '../../engine/statuts.js';
import { formaterDate } from '../../engine/dates.js';

export function construireOngletDemandes({ client, demandes }) {
  const conteneur = el('div', 'cl-contacts');

  const entete = el('div', 'cl-entete');
  entete.appendChild(el('h2', 'db-titre', `Demandes (${demandes.length})`));
  entete.appendChild(lienBouton(`#/demandes/nouvelle/${client.id}`, 'db-btn db-btn--primaire', 'Nouvelle demande', 'plus'));
  conteneur.appendChild(entete);

  if (demandes.length === 0) {
    conteneur.appendChild(el('p', 'db-vide texte-doux', 'Aucune demande pour ce client.'));
    return conteneur;
  }

  const carte = el('section', 'db-carte');
  const tableau = el('table', 'db-table');
  const tete = el('thead');
  const ligneTete = el('tr');
  for (const t of ['Référence', 'Statut', 'Types', 'Date limite', 'Créée le']) ligneTete.appendChild(el('th', null, t));
  tete.appendChild(ligneTete);
  const corps = el('tbody');
  for (const d of demandes) {
    const ligne = el('tr');

    const reference = el('td');
    const lien = el('a', 'cl-nom', d.reference);
    lien.href = `#/demandes/${d.reference}`;
    reference.appendChild(lien);
    if (d.archivee) reference.appendChild(el('small', 'cl-sous-nom', 'Archivée'));

    const statut = el('td');
    statut.appendChild(el('span', `demande-carte__statut demande-carte__statut--${categorieStatut(d.statut)}`, LIBELLES_STATUT[d.statut] || d.statut));

    const types = (d.types || []).map((t) => LIBELLES_TYPE[t] || t).join(', ') || '-';
    ligne.append(reference, statut, el('td', null, types), el('td', null, formaterDate(d.date_limite)), el('td', null, formaterDate(d.created_at)));
    corps.appendChild(ligne);
  }
  tableau.append(tete, corps);
  const defilement = el('div', 'db-table-defilement');
  defilement.appendChild(tableau);
  carte.appendChild(defilement);
  conteneur.appendChild(carte);
  return conteneur;
}

// Documents tels que le client les voit : brouillons exclus.
export function construireOngletDocuments({ demandes }) {
  const conteneur = el('div', 'cl-contacts');
  const entete = el('div', 'cl-entete');
  const titre = el('h2', 'db-titre');
  titre.append(icone('folder-open'), el('span', null, 'Documents'));
  entete.appendChild(titre);
  conteneur.appendChild(entete);
  conteneur.appendChild(el('p', 'texte-doux', 'Documents partagés avec le client, par demande. Les brouillons n’apparaissent pas.'));

  const contenu = el('div', 'cl-contacts');
  contenu.appendChild(el('p', 'texte-doux', 'Chargement…'));
  conteneur.appendChild(contenu);

  (async () => {
    const documents = await listerDocumentsClient(demandes.map((d) => d.id));
    contenu.innerHTML = '';
    let blocs = 0;
    for (const demande of demandes) {
      const elements = await construireLignesDemande(demande, documents, { lireReponses: chargerReponsesStaff });
      if (elements.length === 0) continue;
      blocs += 1;
      contenu.appendChild(el('h3', 'cl-groupe', demande.reference));
      contenu.appendChild(creerCarteListe(elements));
    }
    if (blocs === 0) contenu.appendChild(el('p', 'db-vide texte-doux', 'Aucun document pour le moment.'));
    if (window.lucide) window.lucide.createIcons();
  })().catch((err) => {
    afficherToast(err.message, { type: 'erreur' });
    contenu.innerHTML = '';
    contenu.appendChild(el('p', 'cl-champ__erreur', err.message));
  });
  return conteneur;
}
