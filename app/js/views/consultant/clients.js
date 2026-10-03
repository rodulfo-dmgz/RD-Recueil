// Liste des clients et prospects (CRM, lot A) : recherche, filtre de statut,
// compteurs de demandes, export CSV. Réservé au staff. Section 4.2.
import { listerClientsDetail } from '../../services/clients.js';
import { creerTache } from '../../services/taches.js';
import { afficherToast } from '../../components/toast.js';
import { telechargerCsv } from '../../components/telechargement.js';
import { afficherSquelette } from '../../components/squelette.js';
import { construireEtatVide } from '../../components/etat-vide.js';
import { ouvrirApercuClient, pastillePersonne } from '../../components/apercu-client.js';
import { basculerDensite, densiteConfortable } from '../../components/allure.js';
import { el, icone, lienBouton } from '../../components/dashboard-ui.js';
import { genererCsv } from '../../engine/csv.js';
import { getProfil } from '../../store.js';
import { formaterMontant } from '../../engine/finance.js';
import { STATUTS_CLIENT, filtrerClients, libelleStatutClient } from '../../engine/fiche-client.js';
import { SEUILS_DORMANT, SEUIL_DORMANT_DEFAUT, clientsDormants, libelleInactivite, preparerRelanceDormant } from '../../engine/dormants.js';
import { formaterDate } from '../../engine/dates.js';

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

// Chiffres d'affaires : réservés à l'admin (lot C).
const COLONNES_CSV_FINANCE = [
  { libelle: 'CA signé (HT)', valeur: (c) => c.ca_signe ?? 0 },
  { libelle: 'Pipeline pondéré (HT)', valeur: (c) => c.pipeline_pondere ?? 0 },
];

function ligneClient(c, avecFinance) {
  const ligne = el('tr');

  const nom = el('td');
  const lien = el('a', 'cl-nom', c.raison_sociale);
  lien.href = `#/clients/${c.id}`;
  const blocNom = el('div');
  blocNom.appendChild(lien);
  if (c.nom_commercial) blocNom.appendChild(el('small', 'cl-sous-nom', c.nom_commercial));
  const ligneNom = el('div', 'cl-nom-ligne');
  ligneNom.appendChild(blocNom);
  nom.appendChild(ligneNom);
  // Aperçu dans le tiroir : bouton accessible au clavier, et clic sur la ligne à la souris.
  const apercu = el('button', 'cl-apercu');
  apercu.type = 'button';
  apercu.setAttribute('aria-label', `Aperçu de ${c.raison_sociale}`);
  apercu.appendChild(icone('panel-right-open'));
  apercu.addEventListener('click', (evenement) => {
    evenement.stopPropagation();
    ouvrirApercuClient(c, { avecFinance });
  });
  ligneNom.appendChild(apercu);
  ligne.addEventListener('click', (evenement) => {
    // Clic sur la ligne : seulement avec la nouvelle allure (l'allure actuelle reste inchangée).
    if (document.body.classList.contains('look-nouveau') && !evenement.target.closest('a, button')) ouvrirApercuClient(c, { avecFinance });
  });

  const statut = el('td');
  const pastille = el('span', `cl-statut cl-statut--${c.statut}`);
  pastille.append(el('span', 'cl-statut__point'), libelleStatutClient(c.statut));
  statut.appendChild(pastille);

  const contact = el('td');
  if (c.contact_principal) contact.appendChild(pastillePersonne(c.contact_principal));
  else contact.textContent = '-';

  const demandes = c.nb_demandes === 0 ? '-' : `${c.nb_demandes}${c.nb_actives > 0 ? ` (${c.nb_actives} en cours)` : ''}`;
  ligne.append(
    nom,
    el('td', null, c.siret || '-'),
    statut,
    el('td', null, c.ville || '-'),
    contact,
    el('td', null, demandes),
    el('td', null, c.nb_taches_ouvertes > 0 ? String(c.nb_taches_ouvertes) : '-'),
    el('td', null, formaterDate(c.derniere_activite))
  );
  if (avecFinance) ligne.insertBefore(el('td', null, c.ca_signe > 0 ? formaterMontant(c.ca_signe) : '-'), ligne.lastChild);
  return ligne;
}

function construireTableau(clients, avecFinance) {
  const tableau = el('table', 'db-table db-table--dense');
  const tete = el('thead');
  const ligneTete = el('tr');
  for (const t of ['Entreprise', 'SIRET', 'Statut', 'Ville', 'Contact principal', 'Demandes', 'Tâches', ...(avecFinance ? ['CA signé'] : []), 'Dernière activité']) {
    ligneTete.appendChild(el('th', null, t));
  }
  tete.appendChild(ligneTete);
  const corps = el('tbody');
  for (const c of clients) corps.appendChild(ligneClient(c, avecFinance));
  tableau.append(tete, corps);
  const defilement = el('div', 'db-table-defilement');
  defilement.appendChild(tableau);
  return defilement;
}

// Vue "Clients dormants" : même liste, avec le temps d'inactivité et la création
// d'une tâche de relance en un clic.
function construireTableauDormants(clients, avecFinance, profil) {
  const tableau = el('table', 'db-table');
  const tete = el('thead');
  const ligneTete = el('tr');
  for (const t of ['Entreprise', 'Contact principal', 'Dernière activité', 'Inactif depuis', ...(avecFinance ? ['CA signé'] : []), 'Relance']) ligneTete.appendChild(el('th', null, t));
  tete.appendChild(ligneTete);
  const corps = el('tbody');
  for (const c of clients) {
    const ligne = el('tr');
    const nom = el('td');
    const lien = el('a', 'cl-nom', c.raison_sociale);
    lien.href = `#/clients/${c.id}`;
    nom.appendChild(lien);
    ligne.append(nom, el('td', null, c.contact_principal || '-'), el('td', null, formaterDate(c.derniere_activite)), el('td', null, libelleInactivite(c.moisInactifs)));
    if (avecFinance) ligne.appendChild(el('td', null, c.ca_signe > 0 ? formaterMontant(c.ca_signe) : '-'));
    const action = el('td');
    if (c.nb_taches_ouvertes > 0) action.appendChild(el('small', 'texte-doux cl-relance-info', `${c.nb_taches_ouvertes} tâche(s) ouverte(s)`));
    const relancer = el('button', 'db-btn db-btn--discret');
    relancer.type = 'button';
    relancer.append(icone('list-plus'), el('span', null, 'Créer une tâche de relance'));
    relancer.addEventListener('click', async () => {
      relancer.disabled = true;
      try {
        // Le responsable du client reçoit la relance ; à défaut, l'utilisateur connecté.
        await creerTache(c.id, preparerRelanceDormant(c, { assigneeId: c.responsable_id || profil?.user_id }));
        afficherToast(`Tâche de relance créée pour ${c.raison_sociale}.`, { type: 'succes' });
        relancer.replaceWith(el('span', 'texte-doux', 'Relance créée'));
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
        relancer.disabled = false;
      }
    });
    action.appendChild(relancer);
    ligne.appendChild(action);
    corps.appendChild(ligne);
  }
  tableau.append(tete, corps);
  const defilement = el('div', 'db-table-defilement');
  defilement.appendChild(tableau);
  return defilement;
}

export async function vueClients({ dormants = false } = {}) {
  const estAdmin = getProfil()?.role === 'admin';
  const app = document.getElementById('app');
  afficherSquelette(app, 'tableau');

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
  if (estAdmin) actions.appendChild(lienBouton('#/clients/doublons', 'db-btn db-btn--discret', 'Doublons', 'copy'));
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
  statut.innerHTML =
    '<option value="">Clients et prospects</option>' +
    STATUTS_CLIENT.map((s) => `<option value="${s.valeur}">${s.libelle}</option>`).join('') +
    '<option value="dormants">Clients dormants</option>';
  if (dormants) statut.value = 'dormants';
  // Seuil d'inactivité, seulement pour la vue des dormants.
  const seuil = el('select', 'champ-saisie cl-statut-filtre');
  seuil.setAttribute('aria-label', 'Sans activité depuis');
  seuil.innerHTML = SEUILS_DORMANT.map((m) => `<option value="${m}"${m === SEUIL_DORMANT_DEFAUT ? ' selected' : ''}>Sans activité depuis ${m} mois</option>`).join('');
  // Densité des tableaux (visible seulement avec la nouvelle allure).
  const densite = el('button', 'db-btn db-btn--discret cl-densite');
  densite.type = 'button';
  densite.appendChild(icone('rows-3'));
  const libelleDensite = el('span');
  densite.appendChild(libelleDensite);
  filtres.append(recherche, statut, seuil, densite);
  main.appendChild(filtres);

  const carte = el('section', 'db-carte');
  const compteur = el('p', 'cl-compteur texte-doux');
  const resultat = el('div');
  carte.append(compteur, resultat);
  main.appendChild(carte);

  function majDensite() {
    resultat.classList.toggle('tableau-confortable', densiteConfortable());
    libelleDensite.textContent = densiteConfortable() ? 'Confortable' : 'Compacte';
    densite.setAttribute('aria-label', `Densité du tableau : ${libelleDensite.textContent.toLowerCase()}. Changer.`);
  }
  densite.addEventListener('click', () => {
    basculerDensite();
    majDensite();
  });
  majDensite();

  let visibles = [];
  function rafraichir() {
    const modeDormants = statut.value === 'dormants';
    seuil.hidden = !modeDormants;
    if (modeDormants) {
      visibles = clientsDormants(filtrerClients(clients, { recherche: recherche.value, statut: 'client' }), { mois: Number(seuil.value) });
      compteur.textContent = `${visibles.length} client${visibles.length > 1 ? 's' : ''} dormant${visibles.length > 1 ? 's' : ''} : déjà acheteurs, sans demande en cours et sans activité depuis ${seuil.value} mois ou plus`;
      resultat.innerHTML = '';
      if (visibles.length === 0) {
        resultat.appendChild(
          construireEtatVide({ icone: 'moon', titre: 'Aucun client dormant avec ce seuil', texte: 'Tous vos clients ont eu une activité récente, ou n’ont pas encore acheté. Essayez un seuil plus court.' })
        );
      }
      else resultat.appendChild(construireTableauDormants(visibles, estAdmin, getProfil()));
      if (window.lucide) window.lucide.createIcons();
      return;
    }
    visibles = filtrerClients(clients, { recherche: recherche.value, statut: statut.value });
    compteur.textContent = `${visibles.length} sur ${clients.length} ${clients.length > 1 ? 'clients' : 'client'}`;
    resultat.innerHTML = '';
    if (visibles.length === 0) {
      resultat.appendChild(
        clients.length === 0
          ? construireEtatVide({ icone: 'building-2', titre: 'Aucun client pour le moment', texte: 'Créez votre premier client ou prospect pour suivre ses demandes, ses contacts et ses échanges.', action: { libelle: 'Nouveau client ou prospect', href: '#/clients/nouveau' } })
          : construireEtatVide({
              icone: 'search-x',
              titre: 'Aucun client ne correspond',
              texte: 'Modifiez votre recherche ou le filtre de statut.',
              action: {
                libelle: 'Effacer la recherche',
                onClick: () => {
                  recherche.value = '';
                  statut.value = '';
                  rafraichir();
                },
              },
            })
      );
      if (window.lucide) window.lucide.createIcons();
      return;
    }
    resultat.appendChild(construireTableau(visibles, estAdmin));
  }
  recherche.addEventListener('input', rafraichir);
  statut.addEventListener('change', rafraichir);
  seuil.addEventListener('change', rafraichir);

  exporter.addEventListener('click', () => {
    if (visibles.length === 0) {
      afficherToast('Aucun client à exporter.', { type: 'erreur' });
      return;
    }
    telechargerCsv(`clients-${new Date().toISOString().slice(0, 10)}.csv`, genererCsv(visibles, estAdmin ? [...COLONNES_CSV, ...COLONNES_CSV_FINANCE] : COLONNES_CSV));
  });

  rafraichir();
  app.innerHTML = '';
  app.appendChild(main);
  if (window.lucide) window.lucide.createIcons();
}
