// Calendrier mensuel "Mon planning" : les dates importantes des demandes du
// client (création, réponses envoyées, entretien, signature...) - styles dans
// css/dashboard.css, données issues de rpc_jalons.
import { el, icone } from './dashboard-ui.js';
import { jalonsParJour, grilleMois, categorieJalon, libelleJalon, cleJour } from '../engine/jalons.js';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function titreMois(annee, mois) {
  const texte = new Date(annee, mois, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function boutonNavigation(sens, libelle, action) {
  const b = el('button', 'cal__nav');
  b.type = 'button';
  b.setAttribute('aria-label', libelle);
  b.appendChild(icone(sens));
  b.addEventListener('click', action);
  return b;
}

export function construireCalendrier(jalons, { maintenant = new Date() } = {}) {
  const carte = el('section', 'db-carte cal');
  const parJour = jalonsParJour(jalons);
  let annee = maintenant.getFullYear();
  let mois = maintenant.getMonth();

  function rendre() {
    carte.innerHTML = '';

    const entete = el('div', 'cal__entete');
    const titre = el('h2', 'db-titre');
    titre.append(icone('calendar-days'), el('span', null, 'Mon planning'));
    entete.appendChild(titre);
    carte.appendChild(entete);

    const navigation = el('div', 'cal__mois');
    navigation.append(
      boutonNavigation('chevron-left', 'Mois précédent', () => {
        mois -= 1;
        if (mois < 0) { mois = 11; annee -= 1; }
        rendre();
      }),
      el('span', 'cal__titre', titreMois(annee, mois)),
      boutonNavigation('chevron-right', 'Mois suivant', () => {
        mois += 1;
        if (mois > 11) { mois = 0; annee += 1; }
        rendre();
      })
    );
    carte.appendChild(navigation);

    const grille = el('div', 'cal__grille');
    grille.setAttribute('role', 'grid');
    for (const lettre of JOURS) grille.appendChild(el('span', 'cal__jour-semaine', lettre));

    const aujourdhui = cleJour(maintenant);
    const evenementsDuMois = [];
    for (const semaine of grilleMois(annee, mois)) {
      for (const jourCase of semaine) {
        if (!jourCase) {
          grille.appendChild(el('span', 'cal__case cal__case--vide'));
          continue;
        }
        const evenements = parJour.get(jourCase.cle) ?? [];
        evenementsDuMois.push(...evenements);
        const caseJour = el('span', `cal__case${jourCase.cle === aujourdhui ? ' cal__case--aujourdhui' : ''}`);
        caseJour.appendChild(el('span', 'cal__numero', String(jourCase.jour)));
        if (evenements.length > 0) {
          const points = el('span', 'cal__points');
          const categories = [...new Set(evenements.map((e) => categorieJalon(e, maintenant)))];
          for (const cat of categories) points.appendChild(el('span', `cal__point cal__point--${cat}`));
          caseJour.appendChild(points);
          caseJour.title = evenements.map((e) => `${libelleJalon(e.type)} (${e.reference})`).join('\n');
        }
        grille.appendChild(caseJour);
      }
    }
    carte.appendChild(grille);

    const liste = el('ul', 'cal__liste');
    if (evenementsDuMois.length === 0) {
      liste.appendChild(el('li', 'cal__vide texte-doux', 'Aucune date importante ce mois-ci.'));
    }
    for (const e of evenementsDuMois) {
      const ligne = el('li', 'cal__evenement');
      ligne.appendChild(el('span', `cal__point cal__point--${categorieJalon(e, maintenant)}`));
      const date = new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      ligne.append(el('span', 'cal__date', date), el('span', 'cal__libelle', `${libelleJalon(e.type)} · ${e.reference}`));
      liste.appendChild(ligne);
    }
    carte.appendChild(liste);

    if (window.lucide) window.lucide.createIcons();
  }

  rendre();
  return carte;
}
