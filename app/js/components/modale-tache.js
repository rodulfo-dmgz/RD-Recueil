// Fenêtre « Créer une nouvelle tâche » (pages Liste et Kanban des tâches) : nom,
// client, message, statut, membres de l'équipe, date, urgence, type et pièces
// jointes. Un consultant est toujours membre et responsable de ses tâches (la base
// l'impose) ; l'admin choisit librement, le premier membre coché devient responsable.
import { ouvrirModaleCrm } from './modale-crm.js';
import { el, icone } from './dashboard-ui.js';
import { champ, champSelect } from './champs-crm.js';
import { afficherToast } from './toast.js';
import { STATUTS_TACHE, TYPES_TACHE, URGENCES, preparerTache, validerNouvelleTache } from '../engine/taches.js';
import { EXTENSIONS_FICHIER_AUTORISEES, validerFichierDepot } from '../engine/validation.js';
import { cleJour } from '../engine/jalons.js';
import { creerTacheComplete } from '../services/taches.js';

const MAX_FICHIERS = 10;

const nomMembre = (m) => m.nom || m.email || 'Membre';

// Sélecteur de membres : bloc repliable avec une case par membre de l'équipe.
// fixe : identifiant qui reste coché (un consultant ne peut pas se retirer).
function selecteurMembres(equipe, coches, fixe) {
  const bloc = el('details', 'membres-tache');
  const resume = el('summary', 'champ-saisie membres-tache__resume');
  bloc.appendChild(resume);
  const liste = el('div', 'membres-tache__liste');
  liste.setAttribute('role', 'group');
  liste.setAttribute('aria-label', 'Membres de la tâche');
  const majResume = () => {
    const noms = equipe.filter((m) => coches.has(m.user_id)).map(nomMembre);
    resume.textContent = noms.length === 0 ? 'Aucun membre' : noms.length <= 2 ? noms.join(', ') : `${noms[0]}, ${noms[1]} +${noms.length - 2}`;
  };
  for (const membre of equipe) {
    const label = el('label', 'membres-tache__ligne');
    const case_ = el('input');
    case_.type = 'checkbox';
    case_.checked = coches.has(membre.user_id);
    case_.disabled = membre.user_id === fixe;
    case_.addEventListener('change', () => {
      if (case_.checked) coches.add(membre.user_id);
      else coches.delete(membre.user_id);
      majResume();
    });
    label.append(case_, el('span', null, nomMembre(membre)));
    liste.appendChild(label);
  }
  bloc.appendChild(liste);
  majResume();
  return bloc;
}

// options : { clients, equipe, profil, estAdmin, clientId, statut, onCree(tache) }
export function ouvrirModaleTache({ clients, equipe, profil, estAdmin, clientId = '', statut = 'a_faire', onCree = () => {} }) {
  const titre = champ('Nom de la tâche', 'titre', '');
  titre.input.placeholder = 'Entrez le nom de la tâche';
  titre.input.required = true;

  const client = champSelect('client_id', 'Client', clients.map((c) => ({ valeur: c.id, libelle: c.raison_sociale })), clientId, 'Choisir un client');

  const messageWrapper = el('label', 'cl-champ');
  messageWrapper.appendChild(el('span', 'cl-champ__libelle', 'Message'));
  const message = el('textarea', 'champ-saisie');
  message.rows = 4;
  message.placeholder = 'Entrez votre message ici…';
  messageWrapper.appendChild(message);

  const choixStatut = champSelect('statut', 'Statut', STATUTS_TACHE.map((s) => ({ valeur: s.valeur, libelle: s.libelle })), statut);
  const choixUrgence = champSelect('urgence', 'Urgence', URGENCES.map((u) => ({ valeur: u.valeur, libelle: u.libelle })), 'moyenne');
  const echeance = champ('Date', 'echeance', cleJour(new Date()), 'date');
  const choixType = champSelect('type', 'Type', TYPES_TACHE, 'autre');

  const coches = new Set(profil?.user_id ? [profil.user_id] : []);
  const membresWrapper = el('div', 'cl-champ');
  membresWrapper.appendChild(el('span', 'cl-champ__libelle', 'Membres de l’équipe'));
  const erreurMembres = el('span', 'cl-champ__erreur');
  erreurMembres.setAttribute('role', 'alert');
  membresWrapper.append(selecteurMembres(equipe, coches, estAdmin ? null : profil?.user_id), erreurMembres);

  const grille = el('div', 'modale-tache__grille');
  grille.append(choixStatut.wrapper, membresWrapper, echeance.wrapper, choixUrgence.wrapper, choixType.wrapper);

  // Pièces jointes : choisies ici, envoyées après la création de la tâche.
  const fichiers = [];
  const entree = el('input');
  entree.type = 'file';
  entree.multiple = true;
  entree.hidden = true;
  entree.accept = EXTENSIONS_FICHIER_AUTORISEES.map((e) => `.${e}`).join(',');
  const liste = el('ul', 'modale-tache__fichiers');
  const aide = el('span', 'texte-doux modale-tache__aide', `PDF, Word, Excel, PowerPoint ou image, 20 Mo maximum par fichier (${MAX_FICHIERS} fichiers au plus).`);
  const erreurFichiers = el('span', 'cl-champ__erreur');
  erreurFichiers.setAttribute('role', 'alert');
  function rendreFichiers() {
    liste.replaceChildren();
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
      liste.appendChild(li);
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
  const joindre = el('button', 'db-btn db-btn--discret');
  joindre.type = 'button';
  joindre.append(icone('paperclip'), el('span', null, 'Joindre des fichiers'));
  joindre.addEventListener('click', () => entree.click());
  const piecesJointes = el('div', 'modale-tache__pieces');
  piecesJointes.append(joindre, entree, aide, erreurFichiers, liste);

  ouvrirModaleCrm({
    titre: 'Créer une nouvelle tâche',
    large: true,
    libelleEnvoi: 'Créer une tâche',
    noeuds: [titre.wrapper, client.wrapper, messageWrapper, grille, piecesJointes],
    onEnvoi: async () => {
      const valeurs = {
        titre: titre.input.value,
        client_id: client.select.value,
        echeance: echeance.input.value,
        type: choixType.select.value,
        urgence: choixUrgence.select.value,
        statut: choixStatut.select.value,
      };
      const erreurs = validerNouvelleTache(valeurs);
      titre.erreur.textContent = erreurs.titre ?? '';
      client.erreur.textContent = erreurs.client_id ?? '';
      echeance.erreur.textContent = erreurs.echeance ?? '';
      const responsable = estAdmin ? equipe.find((m) => coches.has(m.user_id))?.user_id : profil.user_id;
      erreurMembres.textContent = responsable ? '' : 'Choisissez au moins un membre.';
      if (Object.keys(erreurs).length > 0 || !responsable) return false;

      const champs = { ...preparerTache({ titre: valeurs.titre, description: message.value, type: valeurs.type, echeance: valeurs.echeance }), statut: valeurs.statut, urgence: valeurs.urgence, assignee_id: responsable };
      const { tache, echecs } = await creerTacheComplete({ clientId: valeurs.client_id, champs, membres: [...coches], fichiers });
      afficherToast('Tâche créée.', { type: 'succes' });
      if (echecs.membres.length > 0) afficherToast('La tâche est créée, mais les autres membres n’ont pas pu être ajoutés.', { type: 'erreur' });
      if (echecs.fichiers.length > 0) afficherToast(`Pièces jointes non envoyées : ${echecs.fichiers.join(' ; ')}`, { type: 'erreur' });
      onCree(tache);
    },
  });
  titre.input.focus();
}
