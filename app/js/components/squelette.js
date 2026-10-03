// Squelettes de chargement : une page fantôme de la forme de l'écran attendu, à
// la place d'un simple texte "Chargement...". Annoncée aux lecteurs d'écran
// comme occupée ; l'animation est coupée si l'utilisateur la refuse.
import { el } from './dashboard-ui.js';

const bloc = (classe) => el('span', `sq-bloc ${classe}`);

function ligneTableau() {
  const ligne = el('div', 'sq-ligne');
  ['sq-bloc--large', 'sq-bloc--moyen', 'sq-bloc--court', 'sq-bloc--moyen'].forEach((c) => ligne.appendChild(bloc(c)));
  return ligne;
}

// type : 'tableau' (titre, barre d'outils, lignes), 'fiche' (titre, cartes de chiffres,
// deux blocs) ou 'liste' (titre et lignes). lignes : nombre de lignes du tableau.
export function squelettePage(type = 'tableau', { lignes = 7 } = {}) {
  const main = el('main', 'db sq');
  main.setAttribute('aria-busy', 'true');
  main.setAttribute('role', 'status');
  main.appendChild(el('span', 'sr-seul', 'Chargement en cours'));
  main.appendChild(bloc('sq-bloc--titre'));

  if (type === 'fiche') {
    const kpis = el('div', 'db-minis');
    for (let i = 0; i < 3; i += 1) kpis.appendChild(el('div', 'db-mini sq-carte', ''));
    main.appendChild(kpis);
    for (let i = 0; i < 2; i += 1) main.appendChild(el('div', 'db-carte sq-carte sq-carte--haute'));
    return main;
  }

  const carte = el('div', 'db-carte');
  if (type === 'tableau') {
    const outils = el('div', 'sq-outils');
    outils.append(bloc('sq-bloc--champ'), bloc('sq-bloc--bouton'));
    carte.appendChild(outils);
  }
  for (let i = 0; i < lignes; i += 1) carte.appendChild(ligneTableau());
  main.appendChild(carte);
  return main;
}

// Remplace le contenu de `conteneur` par le squelette.
export function afficherSquelette(conteneur, type, options) {
  conteneur.innerHTML = '';
  conteneur.appendChild(squelettePage(type, options));
}
