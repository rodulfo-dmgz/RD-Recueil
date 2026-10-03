// Outils de la barre de vue d'une liste (refonte, phase 6) : filtres avancés et
// vues enregistrées. Deux boutons à placer dans la barre ; chacun ouvre un panneau.
//
// options : { ecran, definitions, lireContexte(): { recherche }, appliquerContexte({ recherche }), onChange() }
// Retourne { boutonFiltres, boutonVues, filtres() } : filtres() donne les filtres à appliquer
// avec appliquerFiltres (engine/filtres.js).
import { el, icone } from './dashboard-ui.js';
import { afficherToast } from './toast.js';
import { OPERATEURS, SANS_VALEUR, filtreActif, libelleOperateur, nettoyerFiltres } from '../engine/filtres.js';
import { definirTri, lireTri } from './tableau-liste.js';
import { creerVue, listerVues, supprimerVue } from '../services/vues.js';

function creerBouton(nomIcone, libelle) {
  const bouton = el('button', 'db-btn db-btn--discret outils-vue__bouton');
  bouton.type = 'button';
  bouton.setAttribute('aria-haspopup', 'dialog');
  bouton.setAttribute('aria-expanded', 'false');
  bouton.append(icone(nomIcone), el('span', 'outils-vue__libelle', libelle));
  return bouton;
}

// Panneau ouvert sous son bouton ; se ferme par Échap, clic à côté ou nouveau clic sur le bouton.
// Position fixe : la carte de la liste coupe tout ce qui dépasse.
function relierPanneau(bouton, panneau, auOuvrir) {
  panneau.hidden = true;
  // La page est recréée à chaque navigation : on retire les panneaux de la visite précédente.
  document.querySelectorAll(`.outils-panneau[data-id="${panneau.dataset.id}"]`).forEach((ancien) => ancien.remove());
  const fermer = () => {
    panneau.hidden = true;
    bouton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', dehors, true);
    document.removeEventListener('keydown', clavier, true);
    window.removeEventListener('resize', fermer);
    window.removeEventListener('hashchange', fermer);
  };
  const dehors = (evenement) => {
    if (!panneau.contains(evenement.target) && !bouton.contains(evenement.target)) fermer();
  };
  const clavier = (evenement) => {
    if (evenement.key === 'Escape') {
      evenement.stopPropagation();
      fermer();
      bouton.focus();
    }
  };
  bouton.addEventListener('click', () => {
    if (!panneau.hidden) return fermer();
    auOuvrir();
    panneau.hidden = false;
    const place = bouton.getBoundingClientRect();
    panneau.style.top = `${Math.round(place.bottom + 6)}px`;
    panneau.style.left = `${Math.max(8, Math.min(Math.round(place.left), window.innerWidth - panneau.offsetWidth - 8))}px`;
    bouton.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', dehors, true);
    document.addEventListener('keydown', clavier, true);
    window.addEventListener('resize', fermer);
    window.addEventListener('hashchange', fermer);
    panneau.querySelector('select, input, button')?.focus();
  });
  document.body.appendChild(panneau);
  return fermer;
}

export function creerOutilsVue({ ecran, definitions, lireContexte = () => ({}), appliquerContexte = () => {}, onChange }) {
  let filtres = [];
  const parCle = new Map(definitions.map((d) => [d.cle, d]));
  const premiereDefinition = () => definitions[0];

  // ─── Filtres ──────────────────────────────────────────────────────────────
  const boutonFiltres = creerBouton('list-filter', 'Filtrer');
  const panneauFiltres = el('div', 'outils-panneau');
  panneauFiltres.dataset.id = `${ecran}-filtres`;
  panneauFiltres.setAttribute('role', 'dialog');
  panneauFiltres.setAttribute('aria-label', 'Filtres');

  function majBoutonFiltres() {
    const n = filtres.filter((f) => filtreActif(f, parCle.get(f.cle))).length;
    boutonFiltres.querySelector('.outils-vue__libelle').textContent = n > 0 ? `Filtrer · ${n}` : 'Filtrer';
    boutonFiltres.classList.toggle('outils-vue__bouton--actif', n > 0);
  }

  function champValeur(filtre, definition) {
    if (SANS_VALEUR.has(filtre.operateur)) return null;
    let champ;
    if (definition.type === 'choix') {
      champ = el('select', 'champ-saisie');
      champ.innerHTML = '<option value="">Choisir…</option>' + definition.choix.map((c) => `<option value="${c.valeur}">${c.libelle}</option>`).join('');
    } else {
      champ = el('input', 'champ-saisie');
      champ.type = definition.type === 'date' ? 'date' : 'text';
      if (definition.type === 'nombre') champ.inputMode = 'decimal';
      champ.placeholder = definition.type === 'texte' ? 'Valeur' : '';
    }
    champ.value = filtre.valeur;
    champ.setAttribute('aria-label', `Valeur du filtre ${definition.libelle}`);
    const evenement = champ.tagName === 'SELECT' ? 'change' : 'input';
    champ.addEventListener(evenement, () => {
      filtre.valeur = champ.value;
      majBoutonFiltres();
      onChange();
    });
    return champ;
  }

  function rendreFiltres() {
    panneauFiltres.replaceChildren();
    if (filtres.length === 0) panneauFiltres.appendChild(el('p', 'texte-doux outils-panneau__vide', 'Aucun filtre. Ajoutez une condition pour réduire la liste.'));
    for (const filtre of filtres) {
      const definition = parCle.get(filtre.cle);
      const ligne = el('div', 'outils-filtre');
      const cle = el('select', 'champ-saisie');
      cle.setAttribute('aria-label', 'Colonne');
      cle.innerHTML = definitions.map((d) => `<option value="${d.cle}">${d.libelle}</option>`).join('');
      cle.value = filtre.cle;
      cle.addEventListener('change', () => {
        const suivante = parCle.get(cle.value);
        filtre.cle = cle.value;
        filtre.operateur = OPERATEURS[suivante.type][0];
        filtre.valeur = '';
        rendreFiltres();
        majBoutonFiltres();
        onChange();
      });
      const operateur = el('select', 'champ-saisie');
      operateur.setAttribute('aria-label', 'Condition');
      operateur.innerHTML = OPERATEURS[definition.type].map((o) => `<option value="${o}">${libelleOperateur(definition.type, o)}</option>`).join('');
      operateur.value = filtre.operateur;
      operateur.addEventListener('change', () => {
        filtre.operateur = operateur.value;
        if (SANS_VALEUR.has(filtre.operateur)) filtre.valeur = '';
        rendreFiltres();
        majBoutonFiltres();
        onChange();
      });
      const retirer = el('button', 'outils-filtre__retirer');
      retirer.type = 'button';
      retirer.setAttribute('aria-label', 'Retirer ce filtre');
      retirer.appendChild(icone('x'));
      retirer.addEventListener('click', () => {
        filtres = filtres.filter((f) => f !== filtre);
        rendreFiltres();
        majBoutonFiltres();
        onChange();
      });
      ligne.append(cle, operateur);
      const valeur = champValeur(filtre, definition);
      if (valeur) ligne.appendChild(valeur);
      ligne.appendChild(retirer);
      panneauFiltres.appendChild(ligne);
    }
    const pied = el('div', 'outils-panneau__pied');
    const ajouter = el('button', 'db-btn db-btn--discret');
    ajouter.type = 'button';
    ajouter.append(icone('plus'), el('span', null, 'Ajouter un filtre'));
    ajouter.addEventListener('click', () => {
      const definition = premiereDefinition();
      filtres.push({ cle: definition.cle, operateur: OPERATEURS[definition.type][0], valeur: '' });
      rendreFiltres();
      [...panneauFiltres.querySelectorAll('.outils-filtre')].at(-1)?.querySelector('select')?.focus();
    });
    pied.appendChild(ajouter);
    if (filtres.length > 0) {
      const effacer = el('button', 'db-btn db-btn--discret', 'Tout effacer');
      effacer.type = 'button';
      effacer.addEventListener('click', () => {
        filtres = [];
        rendreFiltres();
        majBoutonFiltres();
        onChange();
      });
      pied.appendChild(effacer);
    }
    panneauFiltres.appendChild(pied);
    if (window.lucide) window.lucide.createIcons();
  }
  relierPanneau(boutonFiltres, panneauFiltres, rendreFiltres);

  // ─── Vues enregistrées ────────────────────────────────────────────────────
  const boutonVues = creerBouton('bookmark', 'Vues');
  const panneauVues = el('div', 'outils-panneau');
  panneauVues.dataset.id = `${ecran}-vues`;
  panneauVues.setAttribute('role', 'dialog');
  panneauVues.setAttribute('aria-label', 'Vues enregistrées');
  let vues = null; // chargées à la première ouverture

  function appliquerVue(vue) {
    filtres = nettoyerFiltres(vue.filtres, definitions);
    definirTri(ecran, vue.tri && typeof vue.tri === 'object' ? vue.tri : null);
    appliquerContexte({ recherche: vue.recherche ?? '' });
    majBoutonFiltres();
    onChange();
    afficherToast(`Vue « ${vue.nom} » appliquée.`, { type: 'succes' });
  }

  function rendreVues(erreur = null) {
    panneauVues.replaceChildren();
    if (erreur) panneauVues.appendChild(el('p', 'cl-champ__erreur outils-panneau__vide', `Vues indisponibles : ${erreur.message}`));
    else if (vues === null) panneauVues.appendChild(el('p', 'texte-doux outils-panneau__vide', 'Chargement…'));
    else if (vues.length === 0) panneauVues.appendChild(el('p', 'texte-doux outils-panneau__vide', 'Aucune vue enregistrée. Réglez les filtres et le tri, puis enregistrez la vue.'));
    else {
      const liste = el('ul', 'outils-vues');
      for (const vue of vues) {
        const li = el('li', 'outils-vues__ligne');
        const choisir = el('button', 'outils-vues__nom', vue.nom);
        choisir.type = 'button';
        choisir.addEventListener('click', () => {
          appliquerVue(vue);
          rendreVues();
        });
        const retirer = el('button', 'outils-filtre__retirer');
        retirer.type = 'button';
        retirer.setAttribute('aria-label', `Supprimer la vue ${vue.nom}`);
        retirer.appendChild(icone('trash-2'));
        retirer.addEventListener('click', async () => {
          if (!window.confirm(`Supprimer la vue « ${vue.nom} » ?`)) return;
          try {
            await supprimerVue(vue.id);
            vues = vues.filter((v) => v.id !== vue.id);
            rendreVues();
          } catch (err) {
            afficherToast(err.message, { type: 'erreur' });
          }
        });
        li.append(choisir, retirer);
        liste.appendChild(li);
      }
      panneauVues.appendChild(liste);
    }
    const formulaire = el('form', 'outils-panneau__pied outils-vues__nouvelle');
    const nom = el('input', 'champ-saisie');
    nom.type = 'text';
    nom.maxLength = 60;
    nom.placeholder = 'Nom de la vue actuelle';
    nom.setAttribute('aria-label', 'Nom de la vue à enregistrer');
    const enregistrer = el('button', 'db-btn db-btn--primaire', 'Enregistrer');
    enregistrer.type = 'submit';
    formulaire.append(nom, enregistrer);
    formulaire.addEventListener('submit', async (evenement) => {
      evenement.preventDefault();
      if (!nom.value.trim()) return nom.focus();
      enregistrer.disabled = true;
      try {
        const cree = await creerVue({
          ecran,
          nom: nom.value,
          filtres: filtres.filter((f) => filtreActif(f, parCle.get(f.cle))),
          tri: lireTri(ecran),
          recherche: lireContexte().recherche,
        });
        vues = [...(vues ?? []), cree].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        afficherToast(`Vue « ${cree.nom} » enregistrée.`, { type: 'succes' });
        rendreVues();
      } catch (err) {
        afficherToast(err.message, { type: 'erreur' });
        enregistrer.disabled = false;
      }
    });
    panneauVues.appendChild(formulaire);
    if (window.lucide) window.lucide.createIcons();
  }
  relierPanneau(boutonVues, panneauVues, () => {
    rendreVues();
    if (vues === null) {
      listerVues(ecran)
        .then((liste) => {
          vues = liste;
          rendreVues();
        })
        .catch((err) => rendreVues(err));
    }
  });

  majBoutonFiltres();
  return {
    boutonFiltres,
    boutonVues,
    filtres: () => filtres,
    effacer() {
      filtres = [];
      majBoutonFiltres();
    },
  };
}
