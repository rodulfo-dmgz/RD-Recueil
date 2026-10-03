// Fenêtre « Créer une nouvelle tâche » (pages Liste et Kanban des tâches) : nom,
// client, message, puis une rangée de pastilles (statut, membres, date, urgence,
// type) et le trombone des pièces jointes en bas à gauche. Un consultant est
// toujours membre et responsable de ses tâches (la base l'impose) ; l'admin choisit
// librement, le premier membre coché devient responsable.
import { ouvrirModaleCrm } from './modale-crm.js';
import { el, icone } from './dashboard-ui.js';
import { champ } from './champs-crm.js';
import { afficherToast } from './toast.js';
import { STATUTS_TACHE, TYPES_TACHE, URGENCES, preparerTache, validerNouvelleTache } from '../engine/taches.js';
import { EXTENSIONS_FICHIER_AUTORISEES, validerFichierDepot } from '../engine/validation.js';
import { cleJour } from '../engine/jalons.js';
import { creerTacheComplete } from '../services/taches.js';

const MAX_FICHIERS = 10;

const nomMembre = (m) => m.nom || m.email || 'Membre';

// Pastille de formulaire : icône (ou point de couleur) à gauche, champ natif, chevron pour les listes.
function pastille({ nomIcone, libelle, champ: noeud, point = false, liste = true }) {
  const boite = el('label', 'pastille-champ');
  boite.appendChild(point ? el('span', 'pastille-champ__point') : icone(nomIcone));
  noeud.setAttribute('aria-label', libelle);
  noeud.classList.add('pastille-champ__champ');
  boite.appendChild(noeud);
  if (liste) boite.appendChild(icone('chevron-down'));
  return boite;
}

function liste(options, valeur, libelle) {
  const select = el('select');
  for (const o of options) select.appendChild(Object.assign(document.createElement('option'), { value: o.valeur, textContent: o.libelle }));
  select.value = valeur;
  select.name = libelle;
  return select;
}

// Sélecteur de membres : pastille qui déplie une liste à cases (une par membre de l'équipe).
// fixe : identifiant qui reste coché (un consultant ne peut pas se retirer).
function selecteurMembres(equipe, coches, fixe) {
  const bloc = el('details', 'membres-tache');
  const resume = el('summary', 'pastille-champ membres-tache__resume');
  const texte = el('span', 'membres-tache__texte');
  resume.append(icone('users'), texte, icone('chevron-down'));
  bloc.appendChild(resume);
  const panneau = el('div', 'membres-tache__liste');
  panneau.setAttribute('role', 'group');
  panneau.setAttribute('aria-label', 'Membres de la tâche');
  const majResume = () => {
    const noms = equipe.filter((m) => coches.has(m.user_id)).map(nomMembre);
    texte.textContent = noms.length === 0 ? 'Aucun membre' : noms.length === 1 ? noms[0] : `${noms[0]} +${noms.length - 1}`;
  };
  for (const membre of equipe) {
    const ligne = el('label', 'membres-tache__ligne');
    const case_ = el('input');
    case_.type = 'checkbox';
    case_.checked = coches.has(membre.user_id);
    case_.disabled = membre.user_id === fixe;
    case_.addEventListener('change', () => {
      if (case_.checked) coches.add(membre.user_id);
      else coches.delete(membre.user_id);
      majResume();
    });
    ligne.append(case_, el('span', null, nomMembre(membre)));
    panneau.appendChild(ligne);
  }
  bloc.appendChild(panneau);
  majResume();
  return bloc;
}

// options : { clients, equipe, profil, estAdmin, clientId, statut, onCree(tache) }
export function ouvrirModaleTache({ clients, equipe, profil, estAdmin, clientId = '', statut = 'a_faire', onCree = () => {} }) {
  let modale = null;
  const fermer = el('button', 'modale-tache__fermer');
  fermer.type = 'button';
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.appendChild(icone('x'));
  fermer.addEventListener('click', () => modale?.fermer());

  const titre = champ('Nom de la tâche', 'titre', '');
  titre.input.placeholder = 'Entrez le nom de la tâche';
  titre.input.required = true;

  const clientWrapper = el('label', 'cl-champ');
  clientWrapper.appendChild(el('span', 'cl-champ__libelle', 'Client'));
  const client = el('select', 'champ-saisie');
  client.name = 'client_id';
  client.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Choisir un client' }));
  for (const c of clients) client.appendChild(Object.assign(document.createElement('option'), { value: c.id, textContent: c.raison_sociale }));
  client.value = clientId;
  const erreurClient = el('span', 'cl-champ__erreur');
  erreurClient.setAttribute('role', 'alert');
  clientWrapper.append(client, erreurClient);

  const messageWrapper = el('label', 'cl-champ');
  messageWrapper.appendChild(el('span', 'cl-champ__libelle', 'Message'));
  const message = el('textarea', 'champ-saisie');
  message.rows = 4;
  message.placeholder = 'Entrez votre message ici…';
  messageWrapper.appendChild(message);

  // Rangée de pastilles : statut, membres, date, urgence, type.
  const choixStatut = liste(STATUTS_TACHE, statut, 'statut');
  const pastilleStatut = pastille({ libelle: 'Statut', champ: choixStatut, point: true });
  const majPoint = () => {
    const couleur = STATUTS_TACHE.find((s) => s.valeur === choixStatut.value)?.couleur ?? 'neutre';
    pastilleStatut.dataset.couleur = couleur;
  };
  choixStatut.addEventListener('change', majPoint);
  majPoint();

  const coches = new Set(profil?.user_id ? [profil.user_id] : []);
  const membres = selecteurMembres(equipe, coches, estAdmin ? null : profil?.user_id);

  const echeance = el('input');
  echeance.type = 'date';
  echeance.name = 'echeance';
  echeance.value = cleJour(new Date());
  const choixUrgence = liste(URGENCES, 'moyenne', 'urgence');
  const choixType = liste(TYPES_TACHE, 'autre', 'type');

  const rangee = el('div', 'modale-tache__pastilles');
  rangee.append(pastilleStatut, membres, pastille({ nomIcone: 'calendar', libelle: 'Date', champ: echeance, liste: false }), pastille({ nomIcone: 'flag', libelle: 'Urgence', champ: choixUrgence }), pastille({ nomIcone: 'tag', libelle: 'Type', champ: choixType }));
  const erreurs = el('span', 'cl-champ__erreur');
  erreurs.setAttribute('role', 'alert');

  // Pièces jointes : choisies ici, envoyées après la création de la tâche.
  const fichiers = [];
  const entree = el('input');
  entree.type = 'file';
  entree.multiple = true;
  entree.hidden = true;
  entree.accept = EXTENSIONS_FICHIER_AUTORISEES.map((e) => `.${e}`).join(',');
  const listeFichiers = el('ul', 'modale-tache__fichiers');
  const aide = el('p', 'texte-doux modale-tache__aide', `Pièces jointes : PDF, Word, Excel, PowerPoint ou image, 20 Mo maximum par fichier (${MAX_FICHIERS} au plus).`);
  const erreurFichiers = el('span', 'cl-champ__erreur');
  erreurFichiers.setAttribute('role', 'alert');
  function rendreFichiers() {
    listeFichiers.replaceChildren();
    fichiers.forEach((fichier, index) => {
      const li = el('li', 'modale-tache__fichier');
      const retirer = el('button', 'outils-filtre__retirer');
      retirer.type = 'button';
      retirer.setAttribute('aria-label', `Retirer ${fichier.name}`);
      retirer.appendChild(icone('x'));
      retirer.addEventListener('click', () => {
        fichiers.splice(index, 1);
        rendreFichiers();
      });
      li.append(icone('paperclip'), el('span', null, fichier.name), retirer);
      listeFichiers.appendChild(li);
    });
    if (window.lucide) window.lucide.createIcons();
  }
  entree.addEventListener('change', () => {
    const refus = [];
    for (const fichier of entree.files) {
      const erreur = validerFichierDepot({ nom: fichier.name, taille: fichier.size });
      if (erreur) refus.push(`${fichier.name} : ${erreur}`);
      else if (fichiers.length >= MAX_FICHIERS) refus.push(`${fichier.name} : ${MAX_FICHIERS} fichiers au plus.`);
      else fichiers.push(fichier);
    }
    entree.value = '';
    erreurFichiers.textContent = refus.join(' ');
    rendreFichiers();
  });
  const joindre = el('button', 'modale-tache__joindre');
  joindre.type = 'button';
  joindre.setAttribute('aria-label', 'Joindre des fichiers');
  joindre.title = 'Joindre des fichiers';
  joindre.append(icone('paperclip'), entree);
  joindre.addEventListener('click', (evenement) => {
    if (evenement.target !== entree) entree.click();
  });

  modale = ouvrirModaleCrm({
    titre: 'Créer une nouvelle tâche',
    classe: 'modale-tache',
    libelleEnvoi: 'Créer une tâche',
    piedGauche: joindre,
    noeuds: [fermer, titre.wrapper, clientWrapper, messageWrapper, rangee, erreurs, aide, erreurFichiers, listeFichiers],
    onEnvoi: async () => {
      const valeurs = {
        titre: titre.input.value,
        client_id: client.value,
        echeance: echeance.value,
        type: choixType.value,
        urgence: choixUrgence.value,
        statut: choixStatut.value,
      };
      const invalides = validerNouvelleTache(valeurs);
      titre.erreur.textContent = invalides.titre ?? '';
      erreurClient.textContent = invalides.client_id ?? '';
      const responsable = estAdmin ? equipe.find((m) => coches.has(m.user_id))?.user_id : profil.user_id;
      erreurs.textContent = invalides.echeance ?? (responsable ? '' : 'Choisissez au moins un membre.');
      if (Object.keys(invalides).length > 0 || !responsable) return false;

      const champs = { ...preparerTache({ titre: valeurs.titre, description: message.value, type: valeurs.type, echeance: valeurs.echeance }), statut: valeurs.statut, urgence: valeurs.urgence, assignee_id: responsable };
      const { tache, echecs } = await creerTacheComplete({ clientId: valeurs.client_id, champs, membres: [...coches], fichiers });
      afficherToast('Tâche créée.', { type: 'succes' });
      if (echecs.membres.length > 0) afficherToast('La tâche est créée, mais les autres membres n’ont pas pu être ajoutés.', { type: 'erreur' });
      if (echecs.fichiers.length > 0) afficherToast(`Pièces jointes non envoyées : ${echecs.fichiers.join(' ; ')}`, { type: 'erreur' });
      onCree(tache);
    },
  });
  if (window.lucide) window.lucide.createIcons();
  titre.input.focus();
}
