// Liste des clients et prospects (CRM, lot A) : recherche, filtre de statut,
// compteurs de demandes, export CSV. Réservé au staff. Section 4.2.
import { listerClientsDetail } from '../../services/clients.js';
import { afficherToast } from '../../components/toast.js';
import { telechargerCsv } from '../../components/telechargement.js';
import { el, icone, lienBouton } from '../../components/dashboard-ui.js';
import { genererCsv } from '../../engine/csv.js';
import { STATUTS_CLIENT, filtrerClients, libelleStatutClient } from '../../engine/fiche-client.js';

const COLONNES_CSV = [
  { libelle: 'Raison sociale', valeur: (c) => c.raison_sociale },
  { libelle: 'SIRET', valeur: (c) => c.siret ?? '' },
  { libelle: 'Statut', valeur: (c) => libelleStatutClient(c.statut) },
  { libelle: 'Ville', valeur: (c) => c.ville ?? '' },
  { libelle: 'Contact principal', valeur: (c) => c.contact_principal ?? '' },
  { libelle: 'Demandes', valeur: (c) => c.nb_demandes },
  { libelle: 'Demandes actives', valeur: (c) => c.nb_actives },
  { libelle: 'Demandes gagnées', valeur: (c) => c.nb_gagnees },
  { libelle: 'Tâches ouvertes', valeur: (c) => c.nb_taches_ouvertes ?? 0 },
  { libelle: 'Dernière activité', valeur: (c) => (c.derniere_activite ? c.derniere_activite.slice(0, 10) : '') },
];

function formaterDate(date) {
  return date ? new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
}

function ligneClient(c) {
  const ligne = el('tr');

  const nom = el('td');
  const lien = el('a', 'cl-nom', c.raison_sociale);
  lien.href = `#/clients/${c.id}`;
  nom.appendChild(lien);
  if (c.nom_commercial) nom.appendChild(el('small', 'cl-sous-nom', c.nom_commercial));

  const statut = el('td');
  const pastille = el('span', `cl-statut cl-statut--${c.statut}`);
  pastille.append(el('span', 'cl-statut__point'), libelleStatutClient(c.statut));
  statut.appendChild(pastille);

  const demandes = c.nb_demandes === 0 ? '-' : `${c.nb_demandes}${c.nb_actives > 0 ? ` (${c.nb_actives} en cours)` : ''}`;
  ligne.append(
    nom,
    el('td', null, c.siret || '-'),
    statut,
    el('td', null, c.ville || '-'),
    el('td', null, c.contact_principal || '-'),
    el('td', null, demandes),
    el('td', null, c.nb_taches_ouvertes > 0 ? String(c.nb_taches_ouvertes) : '-'),
    el('td', null, formaterDate(c.derniere_activite))
  );
  return ligne;
}

function construireTableau(clients) {
  const tableau = el('table', 'db-table');
  const tete = el('thead');
  const ligneTete = el('tr');
  for (const t of ['Entreprise', 'SIRET', 'Statut', 'Ville', 'Contact principal', 'Demandes', 'Tâches', 'Dernière activité']) {
    ligneTete.appendChild(el('th', null, t));
  }
  tete.appendChild(ligneTete);
  const corps = el('tbody');
  for (const c of clients) corps.appendChild(ligneClient(c));
  tableau.append(tete, corps);
  const defilement = el('div', 'db-table-defilement');
  defilement.appendChild(tableau);
  return defilement;
}

export async function vueClients() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let clients;
  try {
    clients = await listerClientsDetail();
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger les clients</h1></main>';
    return;
  }

  const main = el('main', 'db');

  const entete = el('div', 'cl-entete');
  entete.appendChild(el('h1', null, 'Clients'));
  const actions = el('div', 'cl-entete__actions');
  const exporter = el('button', 'db-btn db-btn--discret');
  exporter.type = 'button';
  exporter.append(icone('download'), el('span', null, 'Exporter en CSV'));
  actions.append(exporter, lienBouton('#/clients/nouveau', 'db-btn db-btn--primaire', 'Nouveau client ou prospect', 'plus'));
  entete.appendChild(actions);
  main.appendChild(entete);

  const filtres = el('div', 'cl-filtres');
  const recherche = el('input', 'champ-saisie cl-recherche');
  recherche.type = 'search';
  recherche.placeholder = 'Rechercher un nom, un SIRET, une ville, un contact…';
  recherche.setAttribute('aria-label', 'Rechercher un client');
  const statut = el('select', 'champ-saisie cl-statut-filtre');
  statut.setAttribute('aria-label', 'Filtrer par statut');
  statut.innerHTML = '<option value="">Clients et prospects</option>' + STATUTS_CLIENT.map((s) => `<option value="${s.valeur}">${s.libelle}</option>`).join('');
  filtres.append(recherche, statut);
  main.appendChild(filtres);

  const carte = el('section', 'db-carte');
  const compteur = el('p', 'cl-compteur texte-doux');
  const resultat = el('div');
  carte.append(compteur, resultat);
  main.appendChild(carte);

  let visibles = [];
  function rafraichir() {
    visibles = filtrerClients(clients, { recherche: recherche.value, statut: statut.value });
    compteur.textContent = `${visibles.length} sur ${clients.length} ${clients.length > 1 ? 'clients' : 'client'}`;
    resultat.innerHTML = '';
    if (visibles.length === 0) {
      resultat.appendChild(el('p', 'db-vide texte-doux', clients.length === 0 ? 'Aucun client pour le moment.' : 'Aucun client ne correspond à cette recherche.'));
      return;
    }
    resultat.appendChild(construireTableau(visibles));
  }
  recherche.addEventListener('input', rafraichir);
  statut.addEventListener('change', rafraichir);

  exporter.addEventListener('click', () => {
    if (visibles.length === 0) {
      afficherToast('Aucun client à exporter.', { type: 'erreur' });
      return;
    }
    telechargerCsv(`clients-${new Date().toISOString().slice(0, 10)}.csv`, genererCsv(visibles, COLONNES_CSV));
  });

  rafraichir();
  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
