// Tableau de liste commun (refonte de l'interface, phase 2) : colonnes à largeur
// fixe avec défilement horizontal, première colonne figée, cases à cocher
// facultatives, tri par clic sur l'en-tête, ligne de totaux facultative. Le rendu
// visuel est dans css/allure.css (nouvelle allure) ; avec l'allure actuelle,
// c'est un tableau simple.
//
// colonnes : [{ titre, icone, largeur, rendu(ligne), tri(ligne), classe, proto, total(lignes), figee }]
//   rendu : renvoie un nœud, un texte, ou rien (cellule vide).
//   tri   : valeur (texte ou nombre) servant à trier ; sans elle, la colonne n'est pas triable.
//   proto : colonne masquée avec l'allure actuelle.
//   figee : colonne collée à gauche pendant le défilement (une seule, la première).
// id : nom du tableau ; le tri choisi est retenu sous ce nom (il survit à un nouveau rendu de la page).
import { el, icone } from './dashboard-ui.js';
import { trierLignes } from '../engine/tri.js';

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

// Petit bouton « aperçu » (tiroir latéral), visible au survol de la ligne ou au clavier (css/allure.css).
export function boutonApercu(libelle, auClic) {
  const bouton = el('button', 'cl-apercu');
  bouton.type = 'button';
  bouton.setAttribute('aria-label', libelle);
  bouton.appendChild(icone('panel-right-open'));
  bouton.addEventListener('click', (evenement) => {
    evenement.stopPropagation();
    auClic();
  });
  return bouton;
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

// Tri retenu par tableau : { titre, sens: 'asc' | 'desc' }.
const tris = new Map();

// options : { id, colonnes, lignes, cle, libelleLigne, selection, onSelection(ids, coche, toutes), onLigne(ligne), libelleTotal(lignes) }
export function tableauListe({ id, colonnes, lignes, cle = (l) => l.id, libelleLigne = () => 'cette ligne', selection, onSelection, onLigne, libelleTotal }) {
  const defilement = el('div', 'db-table-defilement');
  const avecSelection = Boolean(selection);

  function construire() {
    const etatTri = id ? tris.get(id) : null;
    const colonneTri = etatTri ? colonnes.find((c) => c.titre === etatTri.titre && c.tri) : null;
    const affichees = colonneTri ? trierLignes(lignes, colonneTri.tri, etatTri.sens) : lignes;

    const tableau = el('table', `db-table db-table--dense${avecSelection ? '' : ' sans-selection'}`);

    const ligneTete = el('tr');
    if (avecSelection) {
      const th = el('th', 'col-proto col-selection');
      th.style.setProperty('--w', '32px');
      th.appendChild(
        caseACocher('Tout sélectionner', lignes.length > 0 && lignes.every((l) => selection.has(cle(l))), (coche) => {
          onSelection(lignes.map(cle), coche, true);
          rafraichir();
        })
      );
      ligneTete.appendChild(th);
    }
    for (const colonne of colonnes) {
      const th = marquer(el('th'), colonne);
      th.style.setProperty('--w', `${colonne.largeur}px`);
      const contenu = [];
      if (colonne.icone) {
        const pastille = el('span', 'th-icone');
        pastille.appendChild(icone(colonne.icone));
        contenu.push(pastille);
      }
      contenu.push(document.createTextNode(colonne.titre));
      if (colonne.tri && id) {
        const actif = colonneTri === colonne;
        th.setAttribute('aria-sort', actif ? (etatTri.sens === 'asc' ? 'ascending' : 'descending') : 'none');
        const bouton = el('button', 'th-tri');
        bouton.type = 'button';
        bouton.setAttribute('aria-label', `Trier par ${colonne.titre}`);
        bouton.append(...contenu);
        if (actif) bouton.appendChild(icone(etatTri.sens === 'asc' ? 'arrow-up' : 'arrow-down'));
        bouton.addEventListener('click', () => {
          const sens = actif && etatTri.sens === 'asc' ? 'desc' : 'asc';
          // Troisième clic : retour à l'ordre d'origine.
          if (actif && etatTri.sens === 'desc') tris.delete(id);
          else tris.set(id, { titre: colonne.titre, sens });
          rafraichir();
        });
        th.appendChild(bouton);
      } else {
        th.append(...contenu);
      }
      ligneTete.appendChild(th);
    }
    const tete = el('thead');
    tete.appendChild(ligneTete);

    const corps = el('tbody');
    for (const donnee of affichees) {
      const tr = el('tr');
      if (avecSelection) {
        const idLigne = cle(donnee);
        tr.classList.toggle('ligne-selectionnee', selection.has(idLigne));
        const td = el('td', 'col-proto col-selection');
        td.appendChild(
          caseACocher(`Sélectionner ${libelleLigne(donnee)}`, selection.has(idLigne), (coche) => {
            tr.classList.toggle('ligne-selectionnee', coche);
            onSelection([idLigne], coche, false);
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
    return tableau;
  }

  function rafraichir() {
    defilement.replaceChildren(construire());
    if (window.lucide) window.lucide.createIcons();
  }

  defilement.appendChild(construire());
  return defilement;
}
