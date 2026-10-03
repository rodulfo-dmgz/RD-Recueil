// Carte "Consultant responsable" de la vue 360 (lot Accès) : l'admin choisit
// le consultant à qui la demande est attribuée. Un consultant ne voit que
// les demandes qui lui sont attribuées ; seul l'admin peut les attribuer
// (fonction rpc_assigner_demande, journalisée, avec notification).
import { assignerDemande } from '../services/demandes.js';
import { listerResponsables } from '../services/clients.js';
import { afficherToast } from './toast.js';
import { el, icone } from './dashboard-ui.js';
import { champSelect } from './champs-crm.js';

// onAttribue : appelé après l'attribution (la vue se recharge).
export function construireCarteAttribution({ demande, onAttribue }) {
  const carte = el('section', 'db-carte');
  carte.appendChild(el('p', 'texte-doux', 'Chargement…'));

  listerResponsables()
    .then((responsables) => {
      carte.innerHTML = '';
      const titre = el('h2', 'db-titre');
      titre.append(icone('user-check'), el('span', null, 'Consultant responsable'));
      carte.appendChild(titre);

      const options = responsables.map((r) => ({ valeur: r.user_id, libelle: `${r.nom || r.email}${r.role === 'admin' ? ' (admin)' : ''}` }));
      const choix = champSelect('consultant_id', 'Demande attribuée à', options, demande.consultant_id, demande.consultant_id ? undefined : 'Non attribuée');
      carte.appendChild(choix.wrapper);
      carte.appendChild(el('p', 'texte-doux', 'Un consultant ne voit que les demandes qui lui sont attribuées. Seul l’administrateur peut les attribuer.'));

      const actions = el('div', 'cl-form__actions');
      const bouton = el('button', 'db-btn db-btn--primaire', 'Attribuer');
      bouton.type = 'button';
      bouton.addEventListener('click', async () => {
        if (!choix.select.value || choix.select.value === demande.consultant_id) return;
        bouton.disabled = true;
        try {
          await assignerDemande(demande.id, choix.select.value);
          afficherToast('Demande attribuée.', { type: 'succes' });
          onAttribue();
        } catch (err) {
          afficherToast(err.message, { type: 'erreur' });
          bouton.disabled = false;
        }
      });
      actions.appendChild(bouton);
      carte.appendChild(actions);
      if (window.lucide) window.lucide.createIcons();
    })
    .catch((err) => {
      carte.innerHTML = '';
      carte.appendChild(el('p', 'cl-champ__erreur', err.message));
    });
  return carte;
}
