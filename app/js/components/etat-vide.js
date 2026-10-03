// État vide utile : dit pourquoi il n'y a rien et propose l'action suivante. À
// utiliser à la place d'une simple phrase grise.
import { el, icone } from './dashboard-ui.js';

// action : { libelle, href } (lien) ou { libelle, onClick } (bouton) ; facultative.
export function construireEtatVide({ icone: nomIcone = 'inbox', titre, texte, action } = {}) {
  const bloc = el('div', 'etat-vide');
  const pastille = el('span', 'etat-vide__icone');
  pastille.appendChild(icone(nomIcone));
  bloc.append(pastille, el('p', 'etat-vide__titre', titre));
  if (texte) bloc.appendChild(el('p', 'etat-vide__texte texte-doux', texte));
  if (action) {
    const cible = action.href ? el('a', 'db-btn db-btn--primaire') : el('button', 'db-btn db-btn--primaire');
    if (action.href) cible.href = action.href;
    else cible.type = 'button';
    cible.appendChild(el('span', null, action.libelle));
    if (action.onClick) cible.addEventListener('click', action.onClick);
    bloc.appendChild(cible);
  }
  return bloc;
}
