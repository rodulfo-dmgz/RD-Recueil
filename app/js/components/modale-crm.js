// Fenêtre de formulaire du CRM (financements, factures, doublons). Le contenu est
// fourni par l'appelant ; `onEnvoi` valide et enregistre : il retourne false pour
// laisser la fenêtre ouverte (erreurs de champs déjà affichées) et lève une
// erreur dont le message s'affiche en bas du formulaire.
//  - sans `libelleEnvoi`, la fenêtre est en lecture seule : un seul bouton "Fermer" ;
//  - la fonction retourne { envoyer, fermer } : le bouton d'envoi (à désactiver
//    tant qu'une confirmation manque) et la fermeture.
import { el } from './dashboard-ui.js';
import { bouton } from './champs-crm.js';

let compteur = 0;

export function ouvrirModaleCrm({ titre, noeuds, libelleEnvoi, onEnvoi, onFermee = () => {}, large = false }) {
  const dialog = el('dialog', `modale-formulaire${large ? ' modale-formulaire--large' : ''}`);
  const idTitre = `modale-crm-titre-${++compteur}`;
  dialog.setAttribute('aria-labelledby', idTitre);
  // Fermeture unique : bouton, fond, Échap (événement close) ou après l'envoi.
  let termine = false;
  const fermer = () => {
    if (dialog.open) dialog.close();
    if (termine) return;
    termine = true;
    dialog.remove();
    onFermee();
  };

  const formulaire = el('form', 'cl-form');
  formulaire.noValidate = true;
  const entete = el('h2', null, titre);
  entete.id = idTitre;
  const erreurGenerale = el('p', 'cl-champ__erreur');
  erreurGenerale.setAttribute('role', 'alert');
  const actions = el('div', 'modale-formulaire__actions');
  let envoyer = null;
  if (libelleEnvoi) {
    envoyer = el('button', 'db-btn db-btn--primaire', libelleEnvoi);
    envoyer.type = 'submit';
    actions.appendChild(envoyer);
  }
  actions.appendChild(bouton('db-btn db-btn--discret', libelleEnvoi ? 'Annuler' : 'Fermer', null, fermer));
  formulaire.append(entete, ...noeuds, erreurGenerale, actions);
  dialog.appendChild(formulaire);

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    if (!envoyer || envoyer.disabled) return;
    erreurGenerale.textContent = '';
    envoyer.disabled = true;
    try {
      if ((await onEnvoi()) === false) {
        envoyer.disabled = false;
        return;
      }
      fermer();
    } catch (err) {
      erreurGenerale.textContent = err.message;
      envoyer.disabled = false;
    }
  });
  dialog.addEventListener('click', (evenement) => {
    if (evenement.target === dialog) fermer();
  });
  dialog.addEventListener('cancel', fermer);
  dialog.addEventListener('close', fermer);
  document.body.appendChild(dialog);
  dialog.showModal();
  return { envoyer, fermer };
}
