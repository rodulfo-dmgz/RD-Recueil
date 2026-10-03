// Doublons de clients (admin, CRM lot E) : couples détectés, comparaison,
// fusion (irréversible, avec résumé et confirmation) et mise de côté d'un couple.
import { listerClientsDetail, listerContacts } from '../../services/clients.js';
import { listerContactsPourDoublons, listerDoublonsIgnores, ignorerCouple, retablirCouple, compterRattaches, fusionnerClients } from '../../services/doublons.js';
import { invaliderRecherche } from '../../services/recherche.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { el } from '../../components/dashboard-ui.js';
import { bouton, caseACocher } from '../../components/champs-crm.js';
import { ouvrirModaleCrm } from '../../components/modale-crm.js';
import { detecterDoublons, planifierFusion } from '../../engine/doublons.js';
import { CHAMPS_FICHE, SOURCES_CLIENT, estVide, libelleStatutClient } from '../../engine/fiche-client.js';

const AUTO_VIDE = '-';

function descriptionFiche(c) {
  return [c.ville, c.siret ? `SIRET ${c.siret}` : null, libelleStatutClient(c.statut), `${c.nb_demandes ?? 0} demande(s)`].filter(Boolean).join(' · ');
}

function valeurAffichee(cle, valeur) {
  if (estVide(valeur)) return AUTO_VIDE;
  if (cle === 'statut') return libelleStatutClient(valeur);
  if (cle === 'source') return SOURCES_CLIENT.find((s) => s.valeur === valeur)?.libelle ?? valeur;
  return String(valeur);
}

// Comparaison côte à côte, lecture seule ; les champs qui diffèrent sont signalés.
function ouvrirComparaison(a, b) {
  const lignes = [
    ...CHAMPS_FICHE.map((c) => ({ cle: c.cle, libelle: c.libelle })),
    { cle: 'source', libelle: 'Source' },
    { cle: 'statut', libelle: 'Statut' },
    { cle: 'notes', libelle: 'Notes' },
    { cle: 'nb_demandes', libelle: 'Demandes (hors archivées)' },
  ];
  const tableau = el('table', 'db-table dbl-compare');
  const tete = el('tr');
  ['', a.raison_sociale, b.raison_sociale].forEach((t) => tete.appendChild(el('th', null, t)));
  tableau.appendChild(el('thead')).appendChild(tete);
  const corps = el('tbody');
  for (const l of lignes) {
    const va = valeurAffichee(l.cle, a[l.cle]);
    const vb = valeurAffichee(l.cle, b[l.cle]);
    const tr = el('tr', va !== vb ? 'dbl-diff' : null);
    tr.append(el('th', null, l.libelle), el('td', null, va), el('td', null, vb));
    corps.appendChild(tr);
  }
  tableau.appendChild(corps);
  const defilement = el('div', 'db-table-defilement');
  defilement.appendChild(tableau);
  ouvrirModaleCrm({
    titre: 'Comparer les deux fiches',
    noeuds: [el('p', 'texte-doux', 'Les lignes surlignées diffèrent d’une fiche à l’autre.'), defilement],
    large: true,
  });
}

// Chargement de ce qu'il faut pour le résumé : contacts et nombres rattachés.
async function chargerCote(client) {
  const [contacts, comptes] = await Promise.all([listerContacts(client.id), compterRattaches(client.id)]);
  return { client, contacts, comptes };
}

function lignesResume(plan, garde, absorbe) {
  const lignes = [];
  const nombre = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  lignes.push(
    `Passent sur « ${garde.raison_sociale} » : ${nombre(plan.demandes, 'demande')}, ${nombre(plan.activites, 'échange')} et ${nombre(plan.taches, 'tâche')}.`
  );
  if (plan.contactsDeplaces.length > 0) lignes.push(`Contacts déplacés : ${plan.contactsDeplaces.join(', ')}.`);
  if (plan.contactsFusionnes.length > 0) lignes.push(`Contacts fusionnés avec ceux de même e-mail : ${plan.contactsFusionnes.join(', ')}.`);
  if (plan.principalPerdu) lignes.push('Le contact principal de l’ancienne fiche ne sera plus principal : la fiche gardée a déjà le sien.');
  if (plan.champsCompletes.length > 0) {
    lignes.push(`Champs vides complétés : ${plan.champsCompletes.map((c) => `${c.libelle} (${valeurAffichee(c.cle, c.valeur)})`).join(', ')}.`);
  }
  if (plan.devientClient) lignes.push('La fiche gardée passe de prospect à client.');
  if (plan.notesAjoutees) lignes.push(`Les notes de « ${absorbe.raison_sociale} » sont ajoutées à celles de la fiche gardée.`);
  if (plan.responsableRepris) lignes.push('Le responsable de l’ancienne fiche est repris.');
  lignes.push(`La fiche « ${absorbe.raison_sociale} » sera supprimée définitivement ; la fusion est notée dans l'historique de la fiche gardée.`);
  return lignes;
}

async function ouvrirFusion(couple, onFusionne) {
  let cotes;
  try {
    cotes = await Promise.all([chargerCote(couple.a), chargerCote(couple.b)]);
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    return;
  }
  const [coteA, coteB] = cotes;
  // Par défaut on garde la fiche qui porte le plus de demandes.
  let gardeA = Number(couple.b.nb_demandes ?? 0) <= Number(couple.a.nb_demandes ?? 0);

  const choix = el('fieldset', 'cl-form__roles');
  choix.appendChild(el('legend', null, 'Fiche à garder'));
  const nomRadio = `garder-${Date.now()}`;
  const radios = [coteA, coteB].map((cote, i) => {
    const libelle = el('label', 'cl-case');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = nomRadio;
    radio.value = String(i);
    radio.checked = (i === 0) === gardeA;
    libelle.append(radio, el('span', null, `${cote.client.raison_sociale} (${descriptionFiche(cote.client)})`));
    choix.appendChild(libelle);
    return radio;
  });

  const resume = el('ul', 'dbl-resume');
  const confirmation = caseACocher('Je comprends que cette fusion est définitive.', 'confirmer', false);
  let modale = null;

  function rendreResume() {
    const [garde, absorbe] = gardeA ? [coteA, coteB] : [coteB, coteA];
    const plan = planifierFusion({
      garde: garde.client,
      absorbe: absorbe.client,
      contactsGarde: garde.contacts,
      contactsAbsorbe: absorbe.contacts,
      comptes: absorbe.comptes,
    });
    resume.innerHTML = '';
    for (const texte of lignesResume(plan, garde.client, absorbe.client)) resume.appendChild(el('li', null, texte));
  }
  radios.forEach((radio) =>
    radio.addEventListener('change', () => {
      gardeA = radios[0].checked;
      rendreResume();
    })
  );
  rendreResume();

  modale = ouvrirModaleCrm({
    titre: 'Fusionner deux fiches',
    noeuds: [choix, el('p', 'texte-doux', 'Ce qui va se passer :'), resume, confirmation.wrapper],
    libelleEnvoi: 'Fusionner définitivement',
    large: true,
    onEnvoi: async () => {
      const [garde, absorbe] = gardeA ? [couple.a, couple.b] : [couple.b, couple.a];
      await fusionnerClients(garde.id, absorbe.id);
      invaliderRecherche();
      afficherToast(`« ${absorbe.raison_sociale} » a été fusionnée dans « ${garde.raison_sociale} ».`, { type: 'succes' });
      onFusionne();
    },
  });
  modale.envoyer.disabled = true;
  confirmation.input.addEventListener('change', () => {
    modale.envoyer.disabled = !confirmation.input.checked;
  });
}

function carteCouple(couple, { onComparer, onFusionner, onIgnorer }) {
  const carte = el('section', 'db-carte dbl-couple');
  const fiches = el('div', 'dbl-fiches');
  for (const c of [couple.a, couple.b]) {
    const bloc = el('div', 'dbl-fiche');
    const lien = el('a', 'dbl-fiche__nom', c.raison_sociale);
    lien.href = `#/clients/${c.id}`;
    bloc.append(lien, el('p', 'texte-doux', descriptionFiche(c)));
    fiches.appendChild(bloc);
  }
  const raisons = el('ul', 'dbl-raisons');
  couple.raisons.forEach((r) => raisons.appendChild(el('li', null, r.detail)));
  const actions = el('div', 'cl-form__actions');
  actions.append(
    bouton('db-btn db-btn--discret', 'Comparer', 'columns-2', onComparer),
    bouton('db-btn db-btn--primaire', 'Fusionner', 'merge', onFusionner),
    bouton('db-btn db-btn--discret', 'Ignorer', 'eye-off', onIgnorer)
  );
  carte.append(fiches, raisons, actions);
  return carte;
}

export async function vueClientsDoublons() {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  const main = el('main', 'db');
  main.appendChild(creerBoutonRetour('#/clients', 'Clients'));
  main.appendChild(el('h1', null, 'Doublons possibles'));
  main.appendChild(
    el(
      'p',
      'texte-doux',
      'Deux fiches sont rapprochées quand leurs noms sont proches et qu’elles sont dans la même ville ou ont le même code postal, ou quand elles ont un contact de même e-mail. Rien n’est fusionné sans votre confirmation. Un SIRET identique est déjà impossible.'
    )
  );
  const zone = el('div', 'db-principale');
  main.appendChild(zone);

  async function charger() {
    let clients;
    let contacts;
    let ignores;
    try {
      [clients, contacts, ignores] = await Promise.all([listerClientsDetail(), listerContactsPourDoublons(), listerDoublonsIgnores()]);
    } catch (err) {
      zone.innerHTML = '';
      zone.appendChild(el('p', 'cl-champ__erreur', err.message));
      return;
    }
    zone.innerHTML = '';
    const couples = detecterDoublons(clients, contacts, ignores);
    const recharger = () => charger();

    if (couples.length === 0) {
      zone.appendChild(el('p', 'db-vide texte-doux', 'Aucun doublon détecté.'));
    } else {
      zone.appendChild(el('p', 'texte-doux', `${couples.length} couple(s) à examiner.`));
      for (const couple of couples) {
        zone.appendChild(
          carteCouple(couple, {
            onComparer: () => ouvrirComparaison(couple.a, couple.b),
            onFusionner: () => ouvrirFusion(couple, recharger),
            onIgnorer: async () => {
              try {
                await ignorerCouple(couple.a.id, couple.b.id);
                afficherToast('Couple ignoré : il ne sera plus proposé.', { type: 'succes' });
                recharger();
              } catch (err) {
                afficherToast(err.message, { type: 'erreur' });
              }
            },
          })
        );
      }
    }

    // Couples mis de côté : on peut les remettre dans la liste.
    const parId = new Map(clients.map((c) => [c.id, c]));
    const mis = ignores.filter((i) => parId.has(i.client_a) && parId.has(i.client_b));
    if (mis.length > 0) {
      const details = el('details', 'db-carte dbl-ignores');
      details.appendChild(el('summary', null, `Couples ignorés (${mis.length})`));
      const liste = el('ul', 'dbl-ignores__liste');
      for (const i of mis) {
        const a = parId.get(i.client_a);
        const b = parId.get(i.client_b);
        const ligne = el('li');
        ligne.appendChild(el('span', null, `${a.raison_sociale} et ${b.raison_sociale}`));
        ligne.appendChild(
          bouton('db-btn db-btn--discret', 'Remettre dans la liste', 'undo-2', async () => {
            try {
              await retablirCouple(i.client_a, i.client_b);
              recharger();
            } catch (err) {
              afficherToast(err.message, { type: 'erreur' });
            }
          })
        );
        liste.appendChild(ligne);
      }
      details.appendChild(liste);
      zone.appendChild(details);
    }
    if (window.lucide) window.lucide.createIcons();
  }

  app.innerHTML = '';
  app.appendChild(main);
  await charger();
}

