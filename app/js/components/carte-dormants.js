// Bloc "Clients dormants" du tableau de bord (CRM, lot E) : les clients qui ont
// déjà acheté, n'ont aucune demande en cours et sont sans activité depuis 12 mois
// ou plus. Absent quand il n'y en a aucun. Le CA historique n'est montré qu'à
// l'admin.
import { el, icone, lienBouton } from './dashboard-ui.js';
import { clientsDormants, libelleInactivite, SEUIL_DORMANT_DEFAUT } from '../engine/dormants.js';
import { formaterMontant } from '../engine/finance.js';

const MAX_LIGNES = 5;

export function construireCarteDormants(clients, { avecFinance = false, maintenant = new Date() } = {}) {
  const dormants = clientsDormants(clients, { mois: SEUIL_DORMANT_DEFAUT, maintenant });
  if (dormants.length === 0) return null;

  const carte = el('section', 'db-carte');
  const titre = el('h2', 'db-titre');
  titre.append(icone('moon'), el('span', null, `${dormants.length} client${dormants.length > 1 ? 's' : ''} dormant${dormants.length > 1 ? 's' : ''}`));
  carte.appendChild(titre);
  carte.appendChild(el('p', 'texte-doux', `Déjà acheteurs, sans demande en cours et sans activité depuis ${SEUIL_DORMANT_DEFAUT} mois ou plus.`));

  const liste = el('div', 'db-lignes');
  for (const c of dormants.slice(0, MAX_LIGNES)) {
    const ligne = el('a', 'db-ligne');
    ligne.href = `#/clients/${c.id}`;
    const texte = el('span', 'db-ligne__texte');
    const detail = [libelleInactivite(c.moisInactifs), avecFinance && c.ca_signe > 0 ? `CA signé ${formaterMontant(c.ca_signe)}` : null].filter(Boolean).join(' · ');
    texte.append(el('strong', null, c.raison_sociale), el('small', null, detail));
    ligne.append(texte, icone('arrow-right'));
    liste.appendChild(ligne);
  }
  carte.appendChild(liste);
  carte.appendChild(lienBouton('#/clients/dormants', 'db-btn db-btn--discret db-btn--lien', dormants.length > MAX_LIGNES ? `Voir les ${dormants.length} clients dormants` : 'Créer des relances', 'arrow-right'));
  return carte;
}
