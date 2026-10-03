// Tableau de liste commun (refonte de l'interface, phase 2) : colonnes à largeur
// fixe avec défilement horizontal, première colonne figée, cases à cocher
// facultatives, ligne de totaux facultative. Le rendu visuel est dans css/allure.css
// (nouvelle allure) ; avec l'allure actuelle, c'est un tableau simple.
//
// colonnes : [{ titre, icone, largeur, rendu(ligne), classe, proto, total(lignes), figee }]
//   rendu : renvoie un nœud, un texte, ou rien (cellule vide).
//   proto : colonne masquée avec l'allure actuelle.
//   figee : colonne collée à gauche pendant le défilement (une seule, la première).
import { el, icone } from './dashboard-ui.js';

// Valeur absente : tiret visible avec l'allure actuelle, cellule vide avec la nouvelle.
export const vide = () => el('span', 'vide', '-');

export function caseACocher(libelle, coche, onChange) {
  const input = el('input', 'cl-case-tableau');
  input.type = 'checkbox';
  input.checked = coche;
  input.setAttribute('aria-label', libelle);
  input.addEventListener('click', (evenement) => evenement.stopPropagation());
  input.addEventListener('change', () => onChange(input.checked));
  return input;
}

const marquer = (noeud, colonne) => {
  if (colonne.proto) noeud.classList.add('col-proto');
  if (colonne.figee) noeud.classList.add('col-nom');
  if (colonne.classe) noeud.classList.add(colonne.classe);
  return noeud;
};

const cellule = (colonne, ligne) => {
  const td = marquer(el('td'), colonne);
  const contenu = colonne.rendu(ligne);
  if (contenu instanceof Node) td.appendChild(contenu);
  else if (contenu !== undefined && contenu !== null && contenu !== '') td.textContent = String(contenu);
  else td.appendChild(vide());
  return td;
};

// options : { colonnes, lignes, cle, libelleLigne, selection, onSelection(ids, coche, toutes), onLigne(ligne), libelleTotal(lignes) }
export function tableauListe({ colonnes, lignes, cle = (l) => l.id, libelleLigne = () => 'cette ligne', selection, onSelection, onLigne, libelleTotal }) {
  const avecSelection = Boolean(selection);
  const tableau = el('table', `db-table db-table--dense${avecSelection ? '' : ' sans-selection'}`);

  const ligneTete = el('tr');
  if (avecSelection) {
    const th = el('th', 'col-proto col-selection');
    th.style.setProperty('--w', '32px');
    th.appendChild(caseACocher('Tout sélectionner', lignes.length > 0 && lignes.every((l) => selection.has(cle(l))), (coche) => onSelection(lignes.map(cle), coche, true)));
    ligneTete.appendChild(th);
  }
  for (const colonne of colonnes) {
    const th = marquer(el('th'), colonne);
    th.style.setProperty('--w', `${colonne.largeur}px`);
    if (colonne.icone) {
      const pastille = el('span', 'th-icone');
      pastille.appendChild(icone(colonne.icone));
      th.appendChild(pastille);
    }
    th.appendChild(document.createTextNode(colonne.titre));
    ligneTete.appendChild(th);
  }
  const tete = el('thead');
  tete.appendChild(ligneTete);

  const corps = el('tbody');
  for (const donnee of lignes) {
    const tr = el('tr');
    if (avecSelection) {
      const id = cle(donnee);
      tr.classList.toggle('ligne-selectionnee', selection.has(id));
      const td = el('td', 'col-proto col-selection');
      td.appendChild(
        caseACocher(`Sélectionner ${libelleLigne(donnee)}`, selection.has(id), (coche) => {
          tr.classList.toggle('ligne-selectionnee', coche);
          onSelection([id], coche, false);
        })
      );
      tr.appendChild(td);
    }
    for (const colonne of colonnes) tr.appendChild(cellule(colonne, donnee));
    // Clic sur la ligne : seulement avec la nouvelle allure (l'allure actuelle reste inchangée).
    if (onLigne) {
      tr.addEventListener('click', (evenement) => {
        if (document.body.classList.contains('look-nouveau') && !evenement.target.closest('a, button, input')) onLigne(donnee);
      });
    }
    corps.appendChild(tr);
  }

  tableau.append(tete, corps);

  // Ligne de totaux (nouvelle allure) : libellé sous la première colonne, sommes sous les autres.
  if (libelleTotal || colonnes.some((c) => c.total)) {
    const totaux = el('tr');
    if (avecSelection) totaux.appendChild(el('td', 'col-proto'));
    colonnes.forEach((colonne, index) => {
      const td = el('td', index === 0 ? 'total-libelle' : null);
      if (index === 0 && libelleTotal) td.textContent = libelleTotal(lignes);
      else if (colonne.total) td.textContent = colonne.total(lignes);
      totaux.appendChild(td);
    });
    const pied = el('tfoot');
    pied.appendChild(totaux);
    tableau.appendChild(pied);
  }

  const defilement = el('div', 'db-table-defilement');
  defilement.appendChild(tableau);
  return defilement;
}
