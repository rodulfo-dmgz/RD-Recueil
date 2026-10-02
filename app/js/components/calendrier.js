// Calendrier mensuel "Mon planning" : les dates importantes des demandes du
// client (création, réponses envoyées, entretien, signature...). Un clic sur
// une date marquée affiche ce qui s'est passé ce jour-là, pas davantage.
// Styles dans css/dashboard.css, données issues de rpc_jalons.
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

function heure(jalon) {
  if (jalon.type === 'echeance' || jalon.type === 'tache') return '';
  return new Date(jalon.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function construireCalendrier(jalons, { maintenant = new Date() } = {}) {
  const carte = el('section', 'db-carte cal');
  const parJour = jalonsParJour(jalons);
  const aujourdhui = cleJour(maintenant);
  let annee = maintenant.getFullYear();
  let mois = maintenant.getMonth();
  let selection = null;

  function changerMois(delta) {
    mois += delta;
    if (mois < 0) { mois = 11; annee -= 1; }
    if (mois > 11) { mois = 0; annee += 1; }
    selection = null;
    rendre();
  }

  function construireCase(jourCase) {
    if (!jourCase) return el('span', 'cal__case cal__case--vide');
    const evenements = parJour.get(jourCase.cle) ?? [];
    const classes = ['cal__case'];
    if (jourCase.cle === aujourdhui) classes.push('cal__case--aujourdhui');
    if (jourCase.cle === selection) classes.push('cal__case--selection');

    // Seules les dates avec des événements sont cliquables.
    const caseJour = el(evenements.length > 0 ? 'button' : 'span', classes.join(' '));
    caseJour.appendChild(el('span', 'cal__numero', String(jourCase.jour)));
    if (evenements.length > 0) {
      caseJour.type = 'button';
      caseJour.setAttribute('aria-pressed', String(jourCase.cle === selection));
      caseJour.setAttribute('aria-label', `${jourCase.jour}, ${evenements.length} événement(s)`);
      const points = el('span', 'cal__points');
      for (const cat of new Set(evenements.map((e) => categorieJalon(e, maintenant)))) {
        points.appendChild(el('span', `cal__point cal__point--${cat}`));
      }
      caseJour.appendChild(points);
      caseJour.addEventListener('click', () => {
        selection = selection === jourCase.cle ? null : jourCase.cle;
        rendre();
      });
    }
    return caseJour;
  }

  function construireDetail() {
    const detail = el('div', 'cal__detail');
    detail.setAttribute('aria-live', 'polite');
    if (!selection) {
      detail.appendChild(el('p', 'cal__indication texte-doux', 'Cliquez sur une date marquée pour voir ce qui s’est passé ce jour-là.'));
      return detail;
    }
    const [a, m, j] = selection.split('-').map(Number);
    const titre = new Date(a, m - 1, j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    detail.appendChild(el('h3', 'cal__detail-titre', titre.charAt(0).toUpperCase() + titre.slice(1)));
    const liste = el('ul', 'cal__liste');
    for (const e of parJour.get(selection) ?? []) {
      const ligne = el('li', 'cal__evenement');
      ligne.appendChild(el('span', `cal__point cal__point--${categorieJalon(e, maintenant)}`));
      const libelle = el('span', 'cal__libelle');
      const texte = `${e.libelle ?? libelleJalon(e.type)} · ${e.reference}`;
      if (e.href) {
        const lien = el('a', null, texte);
        lien.href = e.href;
        libelle.appendChild(lien);
      } else {
        libelle.textContent = texte;
      }
      ligne.append(el('span', 'cal__date', heure(e)), libelle);
      liste.appendChild(ligne);
    }
    detail.appendChild(liste);
    return detail;
  }

  function rendre() {
    carte.innerHTML = '';

    const titre = el('h2', 'db-titre');
    titre.append(icone('calendar-days'), el('span', null, 'Mon planning'));
    carte.appendChild(el('div', 'cal__entete')).appendChild(titre);

    const navigation = el('div', 'cal__mois');
    navigation.append(
      boutonNavigation('chevron-left', 'Mois précédent', () => changerMois(-1)),
      el('span', 'cal__titre', titreMois(annee, mois)),
      boutonNavigation('chevron-right', 'Mois suivant', () => changerMois(1))
    );
    carte.appendChild(navigation);

    const grille = el('div', 'cal__grille');
    for (const lettre of JOURS) grille.appendChild(el('span', 'cal__jour-semaine', lettre));
    for (const semaine of grilleMois(annee, mois)) {
      for (const jourCase of semaine) grille.appendChild(construireCase(jourCase));
    }
    carte.appendChild(grille);
    carte.appendChild(construireDetail());

    if (window.lucide) window.lucide.createIcons();
  }

  rendre();
  return carte;
}
