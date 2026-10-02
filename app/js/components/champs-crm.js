// Petits éléments de formulaire communs aux écrans CRM (fiche client,
// contacts, activité). Chaque champ retourne son conteneur, son champ de
// saisie et l'emplacement de son message d'erreur.
import { el, icone } from './dashboard-ui.js';

export function bouton(classe, texte, nomIcone, action) {
  const b = el('button', classe);
  b.type = 'button';
  if (nomIcone) b.appendChild(icone(nomIcone));
  b.appendChild(el('span', null, texte));
  b.addEventListener('click', action);
  return b;
}

export function champ(libelle, nom, valeur, type = 'text') {
  const wrapper = el('label', 'cl-champ');
  wrapper.appendChild(el('span', 'cl-champ__libelle', libelle));
  const input = el('input', 'champ-saisie');
  input.type = type;
  input.name = nom;
  input.value = valeur ?? '';
  const erreur = el('span', 'cl-champ__erreur');
  erreur.setAttribute('role', 'alert');
  wrapper.append(input, erreur);
  return { wrapper, input, erreur };
}

// options : [{ valeur, libelle }] ; `vide` ajoute un premier choix sans valeur.
export function champSelect(cle, libelle, options, valeur, vide) {
  const wrapper = el('label', 'cl-champ');
  wrapper.appendChild(el('span', 'cl-champ__libelle', libelle));
  const select = el('select', 'champ-saisie');
  select.name = cle;
  const lignes = vide != null ? [{ valeur: '', libelle: vide }, ...options] : options;
  for (const o of lignes) {
    const option = Object.assign(document.createElement('option'), { value: o.valeur, textContent: o.libelle });
    option.selected = o.valeur === (valeur ?? '');
    select.appendChild(option);
  }
  const erreur = el('span', 'cl-champ__erreur');
  erreur.setAttribute('role', 'alert');
  wrapper.append(select, erreur);
  return { wrapper, select, erreur };
}

export function zoneTexte(libelle, nom, valeur, lignes = 3) {
  const wrapper = el('label', 'cl-champ cl-champ--pleine');
  wrapper.appendChild(el('span', 'cl-champ__libelle', libelle));
  const zone = el('textarea', 'champ-saisie cl-notes');
  zone.name = nom;
  zone.rows = lignes;
  zone.value = valeur ?? '';
  wrapper.appendChild(zone);
  return { wrapper, zone };
}

export function caseACocher(libelle, nom, cochee, valeur) {
  const wrapper = el('label', 'cl-case');
  const input = el('input');
  input.type = 'checkbox';
  input.name = nom;
  if (valeur != null) input.value = valeur;
  input.checked = Boolean(cochee);
  wrapper.append(input, el('span', null, libelle));
  return { wrapper, input };
}
