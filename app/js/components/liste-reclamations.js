// Liste des réclamations (CRM, lot F) : page "Réclamations" (tous les clients
// visibles, avec indicateurs et filtres) et onglet "Réclamations" d'une fiche
// (`clientId`). Création et modification dans une fenêtre ; la clôture exige
// l'action corrective.
import { listerReclamations, listerDemandesDuClient, enregistrerReclamation } from '../services/reclamations.js';
import { afficherToast } from './toast.js';
import { el } from './dashboard-ui.js';
import { bouton, champ, champSelect, zoneTexte } from './champs-crm.js';
import { ouvrirModaleCrm } from './modale-crm.js';
import { cleJour } from '../engine/jalons.js';
import {
  GRAVITES,
  STATUTS_RECLAMATION,
  delaiTraitementJours,
  filtrerReclamations,
  kpisReclamations,
  libelleGravite,
  libelleStatutReclamation,
  preparerReclamation,
  validerReclamation,
} from '../engine/reclamations.js';

function formaterDate(cle) {
  return cle ? `${cle.slice(8, 10)}/${cle.slice(5, 7)}/${cle.slice(0, 4)}` : '-';
}

function mini(libelle, valeur, detail) {
  const bloc = el('div', 'db-mini');
  bloc.append(el('span', 'db-mini__valeur', valeur), el('span', 'db-mini__libelle', libelle));
  if (detail) bloc.appendChild(el('span', 'db-mini__detail texte-doux', detail));
  return bloc;
}

// clients : [{ id, raison_sociale }] proposés à la création ; responsables :
// [{ user_id, nom, email }] ; reclamation : à modifier (sinon création).
function ouvrirModale({ reclamation, clientId, clients, responsables, onEnregistre }) {
  const client = champSelect('client_id', 'Client *', clients.map((c) => ({ valeur: c.id, libelle: c.raison_sociale })), reclamation?.client_id ?? clientId ?? '', 'Choisir un client…');
  client.select.disabled = Boolean(reclamation || clientId);
  const demande = champSelect('demande_id', 'Demande concernée', [], reclamation?.demande_id ?? '', 'Aucune demande en particulier');
  const date = champ('Reçue le *', 'date_reception', reclamation?.date_reception ?? cleJour(new Date()), 'date');
  const objet = champ('Objet *', 'objet', reclamation?.objet);
  const gravite = champSelect('gravite', 'Gravité', GRAVITES, reclamation?.gravite ?? 'mineure');
  const statut = champSelect('statut', 'Statut', STATUTS_RECLAMATION, reclamation?.statut ?? 'ouverte');
  const responsable = champSelect('responsable_id', 'Responsable', responsables.map((r) => ({ valeur: r.user_id, libelle: r.nom || r.email })), reclamation?.responsable_id ?? '', 'Moi (par défaut)');
  const description = zoneTexte('Description', 'description', reclamation?.description, 3);
  const action = zoneTexte('Action corrective (obligatoire pour clôturer)', 'action_corrective', reclamation?.action_corrective, 3);
  const groupe = el('div', 'cl-form__groupe');
  groupe.append(client.wrapper, demande.wrapper, date.wrapper, gravite.wrapper, statut.wrapper, responsable.wrapper);

  // Les demandes proposées sont celles du client choisi.
  async function chargerDemandes() {
    const choisi = client.select.value;
    demande.select.innerHTML = '';
    demande.select.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Aucune demande en particulier' }));
    if (!choisi) return;
    try {
      for (const d of await listerDemandesDuClient(choisi)) {
        demande.select.appendChild(Object.assign(document.createElement('option'), { value: d.id, textContent: d.reference, selected: d.id === reclamation?.demande_id }));
      }
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
    }
  }
  client.select.addEventListener('change', chargerDemandes);

  ouvrirModaleCrm({
    titre: reclamation ? 'Modifier la réclamation' : 'Nouvelle réclamation',
    noeuds: [groupe, objet.wrapper, description.wrapper, action.wrapper],
    libelleEnvoi: reclamation ? 'Enregistrer' : 'Enregistrer la réclamation',
    large: true,
    onEnvoi: async () => {
      const saisie = {
        demande_id: demande.select.value,
        date_reception: date.input.value,
        objet: objet.input.value,
        description: description.zone.value,
        gravite: gravite.select.value,
        statut: statut.select.value,
        responsable_id: responsable.select.value,
        action_corrective: action.zone.value,
      };
      const erreurs = validerReclamation(saisie);
      client.erreur.textContent = client.select.value ? '' : 'Choisissez un client.';
      date.erreur.textContent = erreurs.date_reception ?? '';
      objet.erreur.textContent = erreurs.objet ?? '';
      const invalide = [
        [!client.select.value, client.select],
        [erreurs.date_reception, date.input],
        [erreurs.objet, objet.input],
        [erreurs.action_corrective, action.zone],
      ].find(([ko]) => ko);
      if (invalide) {
        if (erreurs.action_corrective && invalide[1] === action.zone) afficherToast(erreurs.action_corrective, { type: 'erreur' });
        invalide[1].focus();
        return false;
      }
      const ligne = preparerReclamation(saisie);
      if (!ligne.responsable_id) delete ligne.responsable_id; // à la création : le créateur, par la base
      await enregistrerReclamation(client.select.value, reclamation?.id ?? null, ligne);
      afficherToast(reclamation ? 'Réclamation enregistrée.' : 'Réclamation enregistrée : elle est ouverte.', { type: 'succes' });
      onEnregistre();
    },
  });
  chargerDemandes();
}

// avecFiltres : page complète (indicateurs, filtres) ; sinon liste d'une fiche.
export function construireListeReclamations({ clientId = null, clients = [], responsables = [], avecFiltres = false } = {}) {
  const racine = el('div', 'rc');
  let reclamations = [];
  const noms = Object.fromEntries(responsables.map((r) => [r.user_id, r.nom || r.email]));

  const entete = el('div', 'cl-entete');
  const kpis = el('div', 'db-minis');
  kpis.hidden = !avecFiltres;
  entete.appendChild(bouton('db-btn db-btn--primaire', 'Nouvelle réclamation', 'plus', () => ouvrirModale({ clientId, clients, responsables, onEnregistre: charger })));
  racine.append(entete, kpis);

  const filtres = el('div', 'cl-filtres');
  const recherche = el('input', 'champ-saisie cl-recherche');
  recherche.type = 'search';
  recherche.placeholder = 'Rechercher un objet, un client…';
  recherche.setAttribute('aria-label', 'Rechercher une réclamation');
  const statut = el('select', 'champ-saisie cl-statut-filtre');
  statut.setAttribute('aria-label', 'Filtrer par statut');
  statut.innerHTML = '<option value="ouvertes">Ouvertes et en cours</option><option value="">Toutes</option><option value="cloturee">Clôturées</option>';
  const gravite = el('select', 'champ-saisie cl-statut-filtre');
  gravite.setAttribute('aria-label', 'Filtrer par gravité');
  gravite.innerHTML = '<option value="">Toutes gravités</option>' + GRAVITES.map((g) => `<option value="${g.valeur}">${g.libelle}</option>`).join('');
  if (avecFiltres) filtres.append(recherche, statut, gravite);
  racine.appendChild(filtres);

  const message = el('p', 'texte-doux');
  const liste = el('ul', 'rc-liste');
  racine.append(message, liste);

  function ligne(r) {
    const li = el('li', 'rc-ligne');
    const tete = el('div', 'rc-ligne__tete');
    tete.append(
      el('span', `cl-badge rc-gravite rc-gravite--${r.gravite}`, libelleGravite(r.gravite)),
      el('span', `cl-badge rc-statut rc-statut--${r.statut}`, libelleStatutReclamation(r.statut)),
      el('time', 'texte-doux', `Reçue le ${formaterDate(r.date_reception)}`)
    );
    li.appendChild(tete);
    const titre = el('p', 'rc-ligne__objet');
    titre.appendChild(el('strong', null, r.objet));
    if (!clientId && r.clients?.raison_sociale) {
      const lien = el('a', null, ` · ${r.clients.raison_sociale}`);
      lien.href = `#/clients/${r.client_id}`;
      titre.appendChild(lien);
    }
    if (r.demandes?.reference) titre.appendChild(el('span', 'texte-doux', ` · ${r.demandes.reference}`));
    li.appendChild(titre);
    if (r.description) li.appendChild(el('p', 'rc-ligne__texte texte-doux', r.description));
    const delai = delaiTraitementJours(r);
    const suivi = [r.responsable_id ? `Responsable : ${noms[r.responsable_id] ?? 'autre compte'}` : null, r.statut === 'cloturee' ? `Clôturée le ${formaterDate(r.date_cloture)}${delai !== null ? ` (${delai} jour${delai > 1 ? 's' : ''})` : ''}` : null].filter(Boolean);
    if (suivi.length > 0) li.appendChild(el('p', 'texte-doux rc-ligne__suivi', suivi.join(' · ')));
    if (r.action_corrective) li.appendChild(el('p', 'rc-ligne__texte', `Action corrective : ${r.action_corrective}`));
    li.appendChild(bouton('db-btn db-btn--discret', 'Modifier', 'pencil', () => ouvrirModale({ reclamation: r, clientId, clients, responsables, onEnregistre: charger })));
    return li;
  }

  function rendre() {
    const k = kpisReclamations(reclamations);
    kpis.innerHTML = '';
    kpis.append(
      mini('Ouvertes', String(k.ouvertes), k.critiquesOuvertes > 0 ? `dont ${k.critiquesOuvertes} critique(s)` : `${k.cloturees} clôturée(s)`),
      mini('Total', String(k.total)),
      mini('Délai moyen de traitement', k.delaiMoyenJours === null ? '-' : `${String(k.delaiMoyenJours).replace('.', ',')} j`)
    );
    const visibles = avecFiltres ? filtrerReclamations(reclamations, { statut: statut.value, gravite: gravite.value, recherche: recherche.value }) : reclamations;
    liste.innerHTML = '';
    visibles.forEach((r) => liste.appendChild(ligne(r)));
    message.textContent = visibles.length === 0 ? (reclamations.length === 0 ? 'Aucune réclamation enregistrée.' : 'Aucune réclamation ne correspond à ces critères.') : '';
    if (window.lucide) window.lucide.createIcons();
  }

  async function charger() {
    try {
      reclamations = await listerReclamations({ clientId: clientId || undefined });
      rendre();
    } catch (err) {
      message.textContent = '';
      afficherToast(err.message, { type: 'erreur' });
    }
  }
  [statut, gravite].forEach((s) => s.addEventListener('change', rendre));
  recherche.addEventListener('input', rendre);
  message.textContent = 'Chargement…';
  charger();
  return racine;
}
