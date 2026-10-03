// Fiche client (CRM, lot A) : en-tête, informations modifiables, import des
// données d'une demande, dernières étapes. Réservé au staff. Section 4.2.
import { bouton } from '../../components/champs-crm.js';
import { formaterDate } from '../../engine/dates.js';
import {
  obtenirClient,
  enregistrerClient,
  supprimerClient,
  listerDemandesClient,
  lireImportDisponible,
  listerResponsables,
} from '../../services/clients.js';
import { listerJalons } from '../../services/jalons.js';
import { getProfil } from '../../store.js';
import { navigate } from '../../router.js';
import { afficherToast } from '../../components/toast.js';
import { construireFormulaireClient } from '../../components/formulaire-client.js';
import { construireOngletContacts } from './client-contacts.js';
import { construireListeJournal } from '../../components/liste-journal.js';
import { construireListeReclamations } from '../../components/liste-reclamations.js';
import { construireOngletActivite } from './client-activite.js';
import { construireOngletDemandes, construireOngletDocuments } from './client-demandes.js';
import { el, icone, lienBouton, mini } from '../../components/dashboard-ui.js';
import { definirNomClientFil } from '../../components/entete.js';
import { libelleJalon } from '../../engine/jalons.js';
import { formaterMontant } from '../../engine/finance.js';
import {
  CHAMPS_FICHE,
  SOURCES_CLIENT,
  extraireFicheClient,
  libelleChampFiche,
  libelleStatutClient,
  planImportFiche,
} from '../../engine/fiche-client.js';

const MAX_ETAPES = 8;
const ONGLETS = [
  { cle: 'apercu', libelle: 'Aperçu', chemin: (id) => `#/clients/${id}` },
  { cle: 'activite', libelle: 'Activité', chemin: (id) => `#/clients/${id}/activite` },
  { cle: 'contacts', libelle: 'Contacts', chemin: (id) => `#/clients/${id}/contacts` },
  { cle: 'demandes', libelle: 'Demandes', chemin: (id) => `#/clients/${id}/demandes` },
  { cle: 'documents', libelle: 'Documents', chemin: (id) => `#/clients/${id}/documents` },
  { cle: 'reclamations', libelle: 'Réclamations', chemin: (id) => `#/clients/${id}/reclamations` },
  // Journal d'audit de la fiche : admin seulement.
  { cle: 'modifications', libelle: 'Modifications', chemin: (id) => `#/clients/${id}/modifications`, admin: true },
];

function construireOnglets(id, actif, estAdmin) {
  const nav = el('nav', 'cl-onglets');
  nav.setAttribute('aria-label', 'Sections de la fiche');
  for (const o of ONGLETS.filter((o) => !o.admin || estAdmin)) {
    const lien = el('a', `cl-onglet${o.cle === actif ? ' cl-onglet--actif' : ''}`, o.libelle);
    lien.href = o.chemin(id);
    if (o.cle === actif) lien.setAttribute('aria-current', 'page');
    nav.appendChild(lien);
  }
  return nav;
}

function construireEntete(client, { demandes, estAdmin, avecModifier, onModifier, onStatut, onSupprimer }) {
  const carte = el('section', 'db-carte cl-fiche-entete');

  const identite = el('div', 'cl-fiche-entete__identite');
  identite.appendChild(el('h1', null, client.raison_sociale));
  if (client.nom_commercial) identite.appendChild(el('p', 'cl-sous-nom', client.nom_commercial));
  const meta = el('p', 'cl-fiche-entete__meta texte-doux');
  const pastille = el('span', `cl-statut cl-statut--${client.statut}`);
  pastille.append(el('span', 'cl-statut__point'), libelleStatutClient(client.statut));
  meta.append(pastille, [client.siret, client.ville].filter(Boolean).join(' · '));
  identite.appendChild(meta);
  carte.appendChild(identite);

  const actions = el('div', 'cl-fiche-entete__actions');
  actions.appendChild(lienBouton(`#/demandes/nouvelle/${client.id}`, 'db-btn db-btn--primaire', 'Nouvelle demande', 'plus'));
  if (avecModifier) actions.appendChild(bouton('db-btn db-btn--discret', 'Modifier', 'pencil', onModifier));
  if (client.statut === 'archive') actions.appendChild(bouton('db-btn db-btn--discret', 'Désarchiver', 'archive-restore', () => onStatut('client')));
  else actions.appendChild(bouton('db-btn db-btn--discret', 'Archiver', 'archive', () => onStatut('archive')));
  if (estAdmin && demandes.length === 0) actions.appendChild(bouton('db-btn db-btn--discret', 'Supprimer', 'trash-2', onSupprimer));
  carte.appendChild(actions);
  return carte;
}

function construireImport(client, importation, onImporter) {
  if (!importation) return null;
  const extraction = extraireFicheClient(importation.reponses, importation.questions);
  const { aAppliquer } = planImportFiche(client, extraction);
  const cles = Object.keys(aAppliquer);
  if (cles.length === 0) return null;

  const bandeau = el('section', 'db-carte cl-import');
  const titre = el('h2', 'db-titre');
  titre.append(icone('download'), el('span', null, `La demande ${importation.demande.reference} complète cette fiche`));
  bandeau.appendChild(titre);
  bandeau.appendChild(el('p', 'texte-doux', 'Ces informations figurent dans le questionnaire et manquent à la fiche. Rien n’est écrasé.'));
  const liste = el('ul', 'cl-import__liste');
  for (const cle of cles) {
    const ligne = el('li');
    ligne.append(el('strong', null, `${libelleChampFiche(cle)} : `), String(aAppliquer[cle]));
    liste.appendChild(ligne);
  }
  bandeau.appendChild(liste);
  bandeau.appendChild(bouton('db-btn db-btn--primaire', `Importer ${cles.length} information${cles.length > 1 ? 's' : ''}`, 'download', () => onImporter(aAppliquer)));
  return bandeau;
}

function construireInformations(client, responsables) {
  const carte = el('section', 'db-carte');
  const titre = el('h2', 'db-titre');
  titre.append(icone('building-2'), el('span', null, 'Informations'));
  carte.appendChild(titre);

  const groupes = {};
  for (const champ of CHAMPS_FICHE) (groupes[champ.groupe] ??= []).push(champ);
  const responsable = responsables.find((r) => r.user_id === client.responsable_id);
  groupes.Suivi = [
    { libelle: 'Source', valeur: SOURCES_CLIENT.find((s) => s.valeur === client.source)?.libelle },
    { libelle: 'Responsable', valeur: responsable ? responsable.nom || responsable.email : null },
    { libelle: 'Contact principal', valeur: client.contact_principal },
  ];

  for (const [nomGroupe, champs] of Object.entries(groupes)) {
    carte.appendChild(el('h3', 'cl-groupe', nomGroupe));
    const dl = el('dl', 'cl-infos');
    for (const c of champs) {
      const valeur = 'cle' in c ? client[c.cle] : c.valeur;
      dl.appendChild(el('dt', null, c.libelle));
      dl.appendChild(el('dd', valeur ? null : 'texte-doux', valeur || '-'));
    }
    carte.appendChild(dl);
  }

  carte.appendChild(el('h3', 'cl-groupe', 'Notes internes'));
  carte.appendChild(el('p', client.notes ? 'cl-notes-lecture' : 'texte-doux', client.notes || 'Aucune note.'));
  return carte;
}

function construireEtapes(jalons, demandes) {
  const carte = el('section', 'db-carte');
  const titre = el('h2', 'db-titre');
  titre.append(icone('history'), el('span', null, 'Dernières étapes'));
  carte.appendChild(titre);

  const ids = new Set(demandes.map((d) => d.id));
  const maintenant = Date.now();
  const recents = jalons
    .filter((j) => ids.has(j.demande_id) && j.type !== 'echeance' && new Date(j.date) <= maintenant)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_ETAPES);
  if (recents.length === 0) {
    carte.appendChild(el('p', 'db-vide texte-doux', 'Aucune étape pour le moment.'));
    return carte;
  }
  const liste = el('ul', 'cl-etapes');
  for (const j of recents) {
    const ligne = el('li', 'cl-etapes__ligne');
    const lien = el('a', null, j.reference);
    lien.href = `#/demandes/${j.reference}`;
    ligne.append(el('span', 'cl-etapes__date', formaterDate(j.date, { heure: true })), el('span', null, libelleJalon(j.type)), lien);
    liste.appendChild(ligne);
  }
  carte.appendChild(liste);
  return carte;
}

export async function vueClientFiche(id, onglet = 'apercu') {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  let client;
  let demandes;
  let responsables;
  try {
    [client, demandes, responsables] = await Promise.all([obtenirClient(id), listerDemandesClient(id), listerResponsables()]);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger la fiche</h1></main>';
    return;
  }
  if (!client) {
    app.innerHTML = '<main class="conteneur"><h1>Client introuvable</h1><p class="texte-doux">Il n’existe pas, ou il n’est pas rattaché à votre compte.</p><p><a href="#/clients">Retour aux clients</a></p></main>';
    return;
  }

  definirNomClientFil(id, client.raison_sociale);

  // Éléments secondaires : leur échec n'empêche pas d'afficher la fiche.
  const [jalons, importation] = await Promise.all([listerJalons().catch(() => []), lireImportDisponible(id).catch(() => null)]);

  const estAdmin = getProfil()?.role === 'admin';
  let edition = false;

  async function enregistrer(champs, message) {
    await enregistrerClient(id, champs);
    afficherToast(message, { type: 'succes' });
    vueClientFiche(id, onglet);
  }

  function rendre() {
    const main = el('main', 'db');
    const retour = el('a', 'cl-retour');
    retour.href = '#/clients';
    retour.append(icone('arrow-left'), el('span', null, 'Tous les clients'));
    main.appendChild(retour);

    main.appendChild(
      construireEntete(client, {
        demandes,
        estAdmin,
        avecModifier: onglet === 'apercu',
        onModifier: () => {
          edition = !edition;
          rendre();
        },
        onStatut: (statut) =>
          enregistrer({ statut }, statut === 'archive' ? 'Client archivé.' : 'Client désarchivé.').catch((err) => afficherToast(err.message, { type: 'erreur' })),
        onSupprimer: async () => {
          if (!window.confirm(`Supprimer définitivement ${client.raison_sociale} ? Cette action est irréversible.`)) return;
          try {
            await supprimerClient(id);
            afficherToast('Client supprimé.', { type: 'succes' });
            navigate('/clients');
          } catch (err) {
            afficherToast(err.message, { type: 'erreur' });
          }
        },
      })
    );

    main.appendChild(construireOnglets(id, onglet, estAdmin));

    if (onglet === 'activite') {
      const ids = new Set(demandes.map((d) => d.id));
      main.appendChild(
        construireOngletActivite({
          client,
          demandes,
          jalons: jalons.filter((j) => ids.has(j.demande_id)),
          responsables,
          estAdmin,
          profilId: getProfil()?.user_id,
        })
      );
    } else if (onglet === 'contacts') {
      main.appendChild(construireOngletContacts({ client, importation }));
    } else if (onglet === 'demandes') {
      main.appendChild(construireOngletDemandes({ client, demandes }));
    } else if (onglet === 'documents') {
      main.appendChild(construireOngletDocuments({ demandes }));
    } else if (onglet === 'reclamations') {
      const carteReclamations = el('section', 'db-carte');
      carteReclamations.appendChild(construireListeReclamations({ clientId: id, clients: [client], responsables: responsables ?? [] }));
      main.appendChild(carteReclamations);
    } else if (onglet === 'modifications' && estAdmin) {
      const carteJournal = el('section', 'db-carte');
      carteJournal.appendChild(construireListeJournal({ clientId: id, noms: Object.fromEntries((responsables ?? []).map((r) => [r.user_id, r.nom || r.email])) }));
      main.appendChild(carteJournal);
    } else if (edition) {
      const carte = el('section', 'db-carte');
      carte.appendChild(
        construireFormulaireClient({
          valeurs: client,
          responsables,
          avecResponsable: estAdmin,
          onAnnuler: () => {
            edition = false;
            rendre();
          },
          onEnregistrer: (champs) => enregistrer(champs, 'Fiche enregistrée.'),
        })
      );
      main.appendChild(carte);
    } else {
      const banniere = construireImport(client, importation, (champs) =>
        enregistrer(champs, 'Informations importées.').catch((err) => afficherToast(err.message, { type: 'erreur' }))
      );
      if (banniere) main.appendChild(banniere);

      const minis = el('div', 'db-minis cl-minis');
      minis.append(
        mini('Demandes', client.nb_demandes),
        mini('En cours', client.nb_actives),
        mini('Gagnées', client.nb_gagnees),
        mini('Tâches ouvertes', client.nb_taches_ouvertes ?? 0),
        ...(estAdmin ? [mini('CA signé (HT)', formaterMontant(client.ca_signe)), mini('En cours, pondéré (HT)', formaterMontant(client.pipeline_pondere))] : []),
        mini('Dernière activité', formaterDate(client.derniere_activite))
      );
      main.appendChild(minis);
      main.appendChild(construireInformations(client, responsables));
      main.appendChild(construireEtapes(jalons, demandes));
    }

    app.innerHTML = '';
    app.appendChild(main);
    if (window.lucide) window.lucide.createIcons();
  }

  rendre();
}
