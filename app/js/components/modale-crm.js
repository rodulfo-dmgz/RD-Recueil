// Fenêtre de formulaire du CRM (financements, factures). Le contenu est fourni
// par l'appelant ; `onEnvoi` valide et enregistre : il retourne false pour
// laisser la fenêtre ouverte (erreurs de champs déjà affichées) et lève une
// erreur dont le message s'affiche en bas du formulaire.
import { el } from './dashboard-ui.js';
import { bouton } from './champs-crm.js';

let compteur = 0;

export function ouvrirModaleCrm({ titre, noeuds, libelleEnvoi, onEnvoi, onFermee = () => {} }) {
  const dialog = el('dialog', 'modale-formulaire');
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
  const envoyer = el('button', 'db-btn db-btn--primaire', libelleEnvoi);
  envoyer.type = 'submit';
  actions.append(envoyer, bouton('db-btn db-btn--discret', 'Annuler', null, fermer));
  formulaire.append(entete, ...noeuds, erreurGenerale, actions);
  dialog.appendChild(formulaire);

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
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
}
