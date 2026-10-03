// Alerte "Données à revoir" du tableau de bord (admin, CRM lot F) : fiches
// sans activité depuis 36 mois ou plus et consentements expirés. Absente
// quand il n'y a rien à revoir.
import { el, icone, lienBouton } from './dashboard-ui.js';
import { donneesARevoir, MOIS_CONSERVATION } from '../engine/consentements.js';

// consentementsExpires : lignes de `consentements` déjà filtrées sur l'expiration.
export function construireCarteDonneesARevoir(clients, consentementsExpires = [], { maintenant = new Date() } = {}) {
  const { fiches } = donneesARevoir({ clients }, { maintenant });
  const nbFiches = fiches.length;
  const nbConsentements = consentementsExpires.length;
  if (nbFiches + nbConsentements === 0) return null;

  const carte = el('section', 'db-carte db-carte--alerte');
  const titre = el('h2', 'db-titre');
  titre.append(icone('shield-alert'), el('span', null, 'Données à revoir'));
  carte.appendChild(titre);
  const lignes = [];
  if (nbFiches > 0) lignes.push(`${nbFiches} fiche${nbFiches > 1 ? 's' : ''} sans activité depuis ${MOIS_CONSERVATION} mois ou plus`);
  if (nbConsentements > 0) lignes.push(`${nbConsentements} consentement${nbConsentements > 1 ? 's' : ''} expiré${nbConsentements > 1 ? 's' : ''}`);
  carte.appendChild(el('p', null, `${lignes.join(' et ')}.`));
  carte.appendChild(lienBouton('#/admin/donnees-a-revoir', 'db-btn db-btn--discret db-btn--lien', 'Examiner', 'arrow-right'));
  return carte;
}
