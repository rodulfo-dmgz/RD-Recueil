// Menu de commandes (refonte de l'interface, phase 3) : Ctrl+K (ou Cmd+K) ouvre une
// fenêtre où l'on tape pour aller à une page, lancer une action ou retrouver un
// client, un contact, une demande (mêmes données que la recherche de la barre du
// haut). Flèches pour choisir, Entrée pour valider, Échap pour fermer. Réservé au
// personnel : l'en-tête ne la configure pas pour un client.
import { el, icone } from './dashboard-ui.js';
import { filtrerCommandes } from '../engine/commandes.js';
import { chargerDonneesRecherche } from '../services/recherche.js';
import { rechercher, termeValide, LONGUEUR_MIN_RECHERCHE } from '../engine/recherche.js';

let config = null; // { liens, actions, admin } : remplacé à chaque rendu de l'en-tête
let fermerEnCours = null;

// liens : [{ href, icone, libelle }] ; actions : [{ id, libelle, icone, mots?, href? , executer? }]
export function configurerPalette(nouvelle) {
  config = nouvelle;
}

// Une seule écoute pour toute la session (l'en-tête est recréé à chaque navigation).
if (!window.__paletteRaccourciAttache) {
  window.__paletteRaccourciAttache = true;
  document.addEventListener('keydown', (evenement) => {
    if (!(evenement.ctrlKey || evenement.metaKey) || evenement.altKey || evenement.key.toLowerCase() !== 'k') return;
    if (!config) return;
    evenement.preventDefault();
    if (fermerEnCours) fermerEnCours();
    else ouvrirPalette();
  });
}

export function ouvrirPalette() {
  if (!config || fermerEnCours) return;
  const precedent = document.activeElement;
  const { liens, actions, admin } = config;
  const commandes = [
    ...liens.map((l) => ({ id: `page:${l.href}`, groupe: 'Aller à', libelle: l.libelle, icone: l.icone, href: l.href })),
    ...actions.map((a) => ({ ...a, groupe: 'Actions' })),
  ];

  const fond = el('div', 'palette-fond');
  const boite = el('div', 'palette');
  boite.setAttribute('role', 'dialog');
  boite.setAttribute('aria-modal', 'true');
  boite.setAttribute('aria-label', 'Menu de commandes');
  const champ = el('input', 'palette__champ');
  champ.type = 'text';
  champ.placeholder = 'Aller à une page, lancer une action, chercher un client…';
  champ.autocomplete = 'off';
  champ.setAttribute('role', 'combobox');
  champ.setAttribute('aria-expanded', 'true');
  champ.setAttribute('aria-controls', 'palette-liste');
  champ.setAttribute('aria-autocomplete', 'list');
  const liste = el('div', 'palette__liste');
  liste.id = 'palette-liste';
  liste.setAttribute('role', 'listbox');
  const pied = el('p', 'palette__pied texte-doux', '↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer');
  boite.append(champ, liste, pied);
  fond.appendChild(boite);
  document.body.appendChild(fond);

  let donnees = null;
  let echec = null;
  let elements = []; // { noeud, lancer }
  let actif = -1;

  function fermer() {
    document.removeEventListener('keydown', surClavier, true);
    fond.remove();
    fermerEnCours = null;
    if (precedent && typeof precedent.focus === 'function' && document.contains(precedent)) precedent.focus();
  }
  fermerEnCours = fermer;

  function lancer(commande) {
    fermer();
    if (commande.executer) commande.executer();
    else if (commande.href) window.location.hash = commande.href;
  }

  function activer(index) {
    elements.forEach((e, i) => {
      e.noeud.classList.toggle('palette__item--actif', i === index);
      e.noeud.setAttribute('aria-selected', String(i === index));
    });
    actif = index;
    if (index >= 0) {
      elements[index].noeud.scrollIntoView({ block: 'nearest' });
      champ.setAttribute('aria-activedescendant', elements[index].noeud.id);
    } else {
      champ.removeAttribute('aria-activedescendant');
    }
  }

  function ajouterItem(parent, { libelle, detail, nomIcone, cible }) {
    const noeud = el('div', 'palette__item');
    noeud.id = `palette-o-${elements.length}`;
    noeud.setAttribute('role', 'option');
    noeud.setAttribute('aria-selected', 'false');
    if (nomIcone) noeud.appendChild(icone(nomIcone));
    noeud.appendChild(el('strong', null, libelle));
    if (detail) noeud.appendChild(el('span', 'texte-doux', detail));
    const index = elements.length;
    noeud.addEventListener('mousemove', () => {
      if (actif !== index) activer(index);
    });
    noeud.addEventListener('click', () => lancer(cible));
    elements.push({ noeud, lancer: () => lancer(cible) });
    parent.appendChild(noeud);
  }

  function groupe(titre) {
    const section = el('div', 'palette__groupe');
    section.setAttribute('role', 'group');
    section.appendChild(el('p', 'palette__titre', titre));
    liste.appendChild(section);
    return section;
  }

  function rendre() {
    const terme = champ.value;
    liste.replaceChildren();
    elements = [];
    const trouvees = filtrerCommandes(commandes, terme);
    for (const nomGroupe of ['Aller à', 'Actions']) {
      const du = trouvees.filter((c) => c.groupe === nomGroupe);
      if (du.length === 0) continue;
      const section = groupe(nomGroupe);
      for (const c of du) ajouterItem(section, { libelle: c.libelle, nomIcone: c.icone, cible: c });
    }
    let messageDonnees = null;
    if (termeValide(terme)) {
      if (echec) messageDonnees = `Recherche des clients indisponible : ${echec.message}`;
      else if (!donnees) messageDonnees = 'Chargement des clients et des demandes…';
      else {
        for (const g of rechercher(donnees, terme, { limite: 4 }).groupes) {
          const section = groupe(g.titre);
          for (const item of g.items) ajouterItem(section, { libelle: item.titre, detail: item.detail, cible: { href: item.href } });
        }
      }
    } else if (terme.trim() !== '' && trouvees.length === 0) {
      messageDonnees = `Tapez au moins ${LONGUEUR_MIN_RECHERCHE} caractères pour chercher un client.`;
    }
    if (messageDonnees) liste.appendChild(el('p', 'palette__message texte-doux', messageDonnees));
    if (elements.length === 0 && !messageDonnees) liste.appendChild(el('p', 'palette__message texte-doux', `Aucun résultat pour « ${terme.trim()} ».`));
    if (window.lucide) window.lucide.createIcons();
    activer(elements.length > 0 ? 0 : -1);
  }

  // Clavier : capté avant le reste de la page tant que la fenêtre est ouverte.
  function surClavier(evenement) {
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      evenement.stopPropagation();
      fermer();
    } else if (evenement.key === 'ArrowDown' || evenement.key === 'ArrowUp') {
      if (elements.length === 0) return;
      evenement.preventDefault();
      activer((actif + (evenement.key === 'ArrowDown' ? 1 : -1) + elements.length) % elements.length);
    } else if (evenement.key === 'Enter') {
      if (actif >= 0) {
        evenement.preventDefault();
        elements[actif].lancer();
      }
    } else if (evenement.key === 'Tab') {
      evenement.preventDefault(); // le focus reste dans le champ
    }
  }
  document.addEventListener('keydown', surClavier, true);
  fond.addEventListener('mousedown', (evenement) => {
    if (evenement.target === fond) fermer();
  });
  champ.addEventListener('input', rendre);

  chargerDonneesRecherche({ avecFactures: admin })
    .then((d) => {
      donnees = d;
    })
    .catch((err) => {
      echec = err;
    })
    .finally(() => {
      if (fermerEnCours === fermer) rendre();
    });

  rendre();
  champ.focus();
}
