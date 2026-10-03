// Barre de recherche globale du CRM (lot E), dans la barre du haut pour le
// personnel. Les données se chargent à la première prise de focus ; les
// résultats (clients, contacts, demandes, et factures pour l'admin) s'affichent
// groupés sous le champ, avec navigation au clavier : flèches, Entrée, Échap, et
// "/" pour aller au champ depuis n'importe où.
import { chargerDonneesRecherche } from '../services/recherche.js';
import { rechercher, termeValide, LONGUEUR_MIN_RECHERCHE } from '../engine/recherche.js';
import { el, icone } from './dashboard-ui.js';

const DELAI_FRAPPE_MS = 120;
let compteur = 0;

// Raccourci "/" : une seule écoute pour toute la session (la barre est recréée
// à chaque navigation). Sans effet pendant une saisie dans un champ.
if (!window.__rechercheRaccourciAttache) {
  window.__rechercheRaccourciAttache = true;
  document.addEventListener('keydown', (evenement) => {
    if (evenement.key !== '/' || evenement.ctrlKey || evenement.metaKey || evenement.altKey) return;
    const cible = evenement.target;
    if (cible instanceof HTMLElement && (cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))) return;
    const champ = document.querySelector('.recherche-globale__champ');
    if (!champ) return;
    evenement.preventDefault();
    champ.focus();
  });
}

// conteneur : élément vide où monter la barre ; admin : cherche aussi les factures.
export function monterRechercheGlobale(conteneur, { admin = false } = {}) {
  const id = `recherche-${++compteur}`;
  conteneur.classList.add('recherche-globale');
  conteneur.innerHTML = '';

  const champ = el('input', 'recherche-globale__champ');
  champ.type = 'search';
  champ.placeholder = 'Rechercher…  ( / )';
  champ.autocomplete = 'off';
  champ.setAttribute('role', 'combobox');
  champ.setAttribute('aria-label', 'Recherche globale : clients, contacts, demandes');
  champ.setAttribute('aria-expanded', 'false');
  champ.setAttribute('aria-controls', `${id}-liste`);
  champ.setAttribute('aria-autocomplete', 'list');
  const loupe = icone('search');
  loupe.classList.add('recherche-globale__loupe');
  const liste = el('div', 'recherche-globale__resultats');
  liste.id = `${id}-liste`;
  liste.setAttribute('role', 'listbox');
  liste.hidden = true;
  conteneur.append(loupe, champ, liste);

  let donnees = null;
  let chargement = null;
  let echec = null;
  let liens = []; // éléments <a> des résultats, dans l'ordre d'affichage
  let actif = -1;
  let minuteur = null;

  function ouvrir(ouvert) {
    liste.hidden = !ouvert;
    champ.setAttribute('aria-expanded', String(ouvert));
    if (!ouvert) {
      actif = -1;
      champ.removeAttribute('aria-activedescendant');
    }
  }

  function activer(index) {
    liens.forEach((a, i) => {
      const est = i === index;
      a.classList.toggle('recherche-globale__item--actif', est);
      a.setAttribute('aria-selected', String(est));
    });
    actif = index;
    if (index >= 0) {
      liens[index].scrollIntoView({ block: 'nearest' });
      champ.setAttribute('aria-activedescendant', liens[index].id);
    } else {
      champ.removeAttribute('aria-activedescendant');
    }
  }

  function message(texte, erreur = false) {
    liste.innerHTML = '';
    liens = [];
    liste.appendChild(el('p', erreur ? 'recherche-globale__message cl-champ__erreur' : 'recherche-globale__message texte-doux', texte));
    ouvrir(true);
  }

  function afficher() {
    const terme = champ.value;
    if (!termeValide(terme)) {
      if (terme.trim() === '') return ouvrir(false);
      return message(`Tapez au moins ${LONGUEUR_MIN_RECHERCHE} caractères.`);
    }
    if (echec) return message(`Recherche indisponible : ${echec.message}`, true);
    if (!donnees) {
      charger(); // normalement lancé par le focus ; sécurité si la saisie arrive sans lui
      return message('Chargement…');
    }
    const { total, groupes } = rechercher(donnees, terme);
    liste.innerHTML = '';
    liens = [];
    if (total === 0) return message(`Aucun résultat pour « ${terme.trim()} ».`);
    for (const g of groupes) {
      const section = el('div', 'recherche-globale__groupe');
      section.setAttribute('role', 'group');
      const titre = el('p', 'recherche-globale__titre', g.total > g.items.length ? `${g.titre} (${g.items.length} sur ${g.total})` : g.titre);
      titre.id = `${id}-g-${g.type}`;
      section.setAttribute('aria-labelledby', titre.id);
      section.appendChild(titre);
      for (const item of g.items) {
        const a = el('a', 'recherche-globale__item');
        a.href = item.href;
        a.id = `${id}-o-${liens.length}`;
        a.setAttribute('role', 'option');
        a.setAttribute('aria-selected', 'false');
        a.tabIndex = -1;
        a.appendChild(el('strong', null, item.titre));
        if (item.detail) a.appendChild(el('span', 'texte-doux', item.detail));
        const index = liens.length;
        a.addEventListener('mousemove', () => activer(index));
        a.addEventListener('click', () => {
          ouvrir(false);
          champ.value = '';
        });
        liens.push(a);
        section.appendChild(a);
      }
      liste.appendChild(section);
    }
    ouvrir(true);
    activer(0);
  }

  function charger() {
    if (donnees || chargement) return;
    chargement = chargerDonneesRecherche({ avecFactures: admin })
      .then((d) => {
        donnees = d;
        echec = null;
      })
      .catch((err) => {
        echec = err;
      })
      .finally(() => {
        chargement = null;
        if (document.activeElement === champ) afficher();
      });
  }

  champ.addEventListener('focus', () => {
    echec = null; // un nouvel essai à chaque retour dans le champ après une panne
    charger();
    if (champ.value.trim() !== '') afficher();
  });
  champ.addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(afficher, DELAI_FRAPPE_MS);
  });
  champ.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'ArrowDown' || evenement.key === 'ArrowUp') {
      if (liens.length === 0) return;
      evenement.preventDefault();
      const pas = evenement.key === 'ArrowDown' ? 1 : -1;
      activer((actif + pas + liens.length) % liens.length);
    } else if (evenement.key === 'Enter') {
      if (actif >= 0 && liens[actif]) {
        evenement.preventDefault();
        liens[actif].click(); // le lien s'ouvre comme au clic
      }
    } else if (evenement.key === 'Escape') {
      if (!liste.hidden || champ.value !== '') {
        evenement.preventDefault();
        champ.value = '';
        ouvrir(false);
      }
      champ.blur();
    }
  });
  // Le focus quitte la barre (clic ailleurs, Tab) : on referme. Les liens sont
  // dans le conteneur, donc cliquer un résultat ne ferme pas avant le clic.
  conteneur.addEventListener('focusout', (evenement) => {
    if (!conteneur.contains(evenement.relatedTarget)) ouvrir(false);
  });
  // Un clic sur un résultat peut ne pas déplacer le focus (lien non focusable au clavier) :
  // on empêche le champ de le perdre avant que le clic n'ait lieu.
  liste.addEventListener('mousedown', (evenement) => evenement.preventDefault());

  return { champ };
}
